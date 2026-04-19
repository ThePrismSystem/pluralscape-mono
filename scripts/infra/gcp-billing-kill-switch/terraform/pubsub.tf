resource "google_pubsub_topic" "budget" {
  project = var.project_id
  name    = local.topic_name

  depends_on = [google_project_service.apis]
}

# Pub/Sub service agent. Needed so we can grant it tokenCreator on the function
# runtime SA below — without this binding, Eventarc delivery fails silently on
# the first apply in a fresh project.
resource "google_project_service_identity" "pubsub" {
  provider = google-beta
  project  = var.project_id
  service  = "pubsub.googleapis.com"

  depends_on = [google_project_service.apis]
}
