resource "google_service_account" "fn" {
  project      = var.project_id
  account_id   = local.sa_account_id
  display_name = "Billing kill switch function runtime"
  description  = "Runtime SA for the billing kill switch Cloud Function. Needs permission to detach billing from the target project."

  depends_on = [google_project_service.apis]
}

# Grant billing.projectManager on the target project so the SA can update its
# billing info (detach). billing.projectManager is a project-level role — it
# grants billing.resourceAssociations.{create,delete,list} scoped to this
# project's billing link. This mirrors GCP's official "disable billing"
# Cloud Function sample.
resource "google_project_iam_member" "fn_billing" {
  project = var.project_id
  role    = "roles/billing.projectManager"
  member  = "serviceAccount:${google_service_account.fn.email}"
}

# Eventarc trigger needs to invoke the Gen 2 function.
resource "google_project_iam_member" "fn_invoker" {
  project = var.project_id
  role    = "roles/run.invoker"
  member  = "serviceAccount:${google_service_account.fn.email}"
}

# Pub/Sub-to-Eventarc on Gen 2 needs the SA to receive events.
resource "google_project_iam_member" "fn_event_receiver" {
  project = var.project_id
  role    = "roles/eventarc.eventReceiver"
  member  = "serviceAccount:${google_service_account.fn.email}"
}

# Gen 2 Pub/Sub triggers require the Pub/Sub service agent to impersonate the
# runtime SA when delivering events. Missing this binding is the most common
# cause of "events published but function never runs" on a fresh project.
resource "google_service_account_iam_member" "pubsub_token_creator" {
  service_account_id = google_service_account.fn.name
  role               = "roles/iam.serviceAccountTokenCreator"
  member             = "serviceAccount:${google_project_service_identity.pubsub.email}"
}
