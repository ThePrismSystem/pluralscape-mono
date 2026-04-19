resource "google_monitoring_notification_channel" "email" {
  project      = var.project_id
  display_name = local.channel_name
  type         = "email"

  labels = {
    email_address = var.notify_email
  }

  depends_on = [google_project_service.apis]
}

# Log-based metric: increments each time the function emits event=billing_disabled.
resource "google_logging_metric" "billing_disabled" {
  project = var.project_id
  name    = local.log_metric_name

  filter = <<-EOT
    resource.type="cloud_run_revision"
    resource.labels.service_name="${local.function_name}"
    jsonPayload.event="billing_disabled"
  EOT

  metric_descriptor {
    metric_kind = "DELTA"
    value_type  = "INT64"
    unit        = "1"
  }

  depends_on = [google_cloudfunctions2_function.kill_switch]
}

# Alert policy 1: success — fires when the log metric increments.
resource "google_monitoring_alert_policy" "success" {
  project      = var.project_id
  display_name = local.success_policy
  combiner     = "OR"

  conditions {
    display_name = "billing_disabled log observed"

    condition_threshold {
      filter          = "metric.type=\"logging.googleapis.com/user/${local.log_metric_name}\" AND resource.type=\"cloud_run_revision\""
      comparison      = "COMPARISON_GT"
      threshold_value = 0
      duration        = "0s"

      aggregations {
        alignment_period   = "60s"
        per_series_aligner = "ALIGN_COUNT"
      }
    }
  }

  # No alert_strategy.notification_rate_limit here — GCP rejects that block on
  # metric-threshold policies; only log-match policies (like the error alert
  # below) support it. The 60s ALIGN_COUNT window already throttles re-alerts.

  notification_channels = [google_monitoring_notification_channel.email.id]

  documentation {
    content   = "The billing kill switch successfully detached billing from project ${var.project_id}."
    mime_type = "text/markdown"
  }

  depends_on = [google_logging_metric.billing_disabled]
}

# Alert policy 2: errors — fires on any ERROR log from the function.
resource "google_monitoring_alert_policy" "errors" {
  project      = var.project_id
  display_name = local.error_policy
  combiner     = "OR"

  conditions {
    display_name = "Function error log"

    condition_matched_log {
      filter = <<-EOT
        resource.type="cloud_run_revision"
        resource.labels.service_name="${local.function_name}"
        severity="ERROR"
      EOT
    }
  }

  alert_strategy {
    notification_rate_limit {
      period = "300s"
    }
  }

  notification_channels = [google_monitoring_notification_channel.email.id]

  documentation {
    content   = "The billing kill switch function for ${var.project_id} logged an error. If this fired after a budget threshold was crossed, billing may NOT have been detached — investigate immediately."
    mime_type = "text/markdown"
  }

  depends_on = [google_cloudfunctions2_function.kill_switch]
}
