output "budget_topic" {
  description = "Pub/Sub topic receiving budget events (publish to this for manual tests)."
  value       = google_pubsub_topic.budget.id
}

output "function_name" {
  description = "Cloud Function name."
  value       = google_cloudfunctions2_function.kill_switch.name
}

output "function_sa" {
  description = "Runtime service account email."
  value       = google_service_account.fn.email
}

output "notification_channel" {
  description = "Email notification channel resource ID. Verify email at first apply."
  value       = google_monitoring_notification_channel.email.id
}

output "notify_email" {
  description = "Email that receives kill-confirmation and error alerts."
  value       = var.notify_email
  sensitive   = true
}

output "dry_run" {
  description = "Whether the kill switch is in dry-run mode (true = armed-safe, false = live)."
  value       = var.dry_run
}
