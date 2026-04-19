resource "google_billing_budget" "kill_switch" {
  billing_account = var.billing_account_id
  display_name    = local.budget_name

  budget_filter {
    projects = ["projects/${data.google_project.target.number}"]
  }

  amount {
    specified_amount {
      currency_code = "USD"
      units         = tostring(var.threshold_usd)
    }
  }

  threshold_rules {
    threshold_percent = 1.0
    spend_basis       = "CURRENT_SPEND"
  }

  all_updates_rule {
    pubsub_topic   = google_pubsub_topic.budget.id
    schema_version = "1.0"
  }

  depends_on = [google_project_service.apis]
}
