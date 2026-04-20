locals {
  required_apis = [
    # cloudresourcemanager must be enabled manually BEFORE first apply —
    # terraform itself calls it to read/write service states, so it can't
    # bootstrap it. Listed here so it's tracked and won't drift after the
    # initial manual enable. See README "Prerequisites".
    "cloudresourcemanager.googleapis.com",
    "cloudbilling.googleapis.com",
    "billingbudgets.googleapis.com",
    "cloudfunctions.googleapis.com",
    "cloudbuild.googleapis.com",
    "pubsub.googleapis.com",
    "logging.googleapis.com",
    "monitoring.googleapis.com",
    "run.googleapis.com",
    "artifactregistry.googleapis.com",
    "eventarc.googleapis.com",
  ]
}

resource "google_project_service" "apis" {
  for_each = toset(local.required_apis)

  project            = var.project_id
  service            = each.value
  disable_on_destroy = false
}
