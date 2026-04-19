locals {
  # Hash of source-file contents only (not mtimes). archive_file's output_md5
  # churns every apply because zip entries embed mtimes; hashing the source
  # files directly keeps the bucket-object name stable across re-applies.
  fn_source_files = fileset("${path.module}/function_source", "**")
  fn_source_included = [
    for f in local.fn_source_files : f
    if !can(regex("^(tests/|__pycache__/|requirements-dev\\.txt$|\\.venv/)", f))
  ]
  fn_source_hash = substr(sha256(join("", [
    for f in local.fn_source_included :
    "${f}:${filesha256("${path.module}/function_source/${f}")}"
  ])), 0, 16)
}

data "archive_file" "fn_source" {
  type        = "zip"
  source_dir  = "${path.module}/function_source"
  output_path = "${path.module}/.build/function_source.zip"
  excludes    = ["tests", "tests/*", ".venv", ".venv/*", "requirements-dev.txt", "__pycache__", "__pycache__/*"]
}

resource "google_storage_bucket" "fn_source" {
  project  = var.project_id
  name     = "${var.project_id}-${var.name_prefix}-source"
  location = var.region

  uniform_bucket_level_access = true
  force_destroy               = true

  depends_on = [google_project_service.apis]
}

resource "google_storage_bucket_object" "fn_source" {
  name   = "function_source-${local.fn_source_hash}.zip"
  bucket = google_storage_bucket.fn_source.name
  source = data.archive_file.fn_source.output_path
}

resource "google_cloudfunctions2_function" "kill_switch" {
  project  = var.project_id
  location = var.region
  name     = local.function_name

  build_config {
    runtime     = "python312"
    entry_point = "kill_billing"

    source {
      storage_source {
        bucket = google_storage_bucket.fn_source.name
        object = google_storage_bucket_object.fn_source.name
      }
    }
  }

  service_config {
    max_instance_count    = 1
    min_instance_count    = 0
    available_memory      = "256M"
    timeout_seconds       = 60
    service_account_email = google_service_account.fn.email

    environment_variables = {
      TARGET_PROJECT_ID = var.project_id
      DRY_RUN           = tostring(var.dry_run)
    }
  }

  event_trigger {
    trigger_region = var.region
    event_type     = "google.cloud.pubsub.topic.v1.messagePublished"
    # Kill is idempotent (we check current state before acting) and error-alert-backed,
    # so retries aren't needed for safety — and a permanent bug (IAM gap, API outage)
    # would otherwise retry for up to 7 days. Investigate + re-publish manually.
    retry_policy          = "RETRY_POLICY_DO_NOT_RETRY"
    pubsub_topic          = google_pubsub_topic.budget.id
    service_account_email = google_service_account.fn.email
  }

  depends_on = [
    google_project_iam_member.fn_invoker,
    google_project_iam_member.fn_event_receiver,
    google_project_iam_member.fn_billing,
    google_service_account_iam_member.pubsub_token_creator,
  ]
}
