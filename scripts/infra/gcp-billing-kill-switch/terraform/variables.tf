variable "project_id" {
  description = "Target project whose billing will be detached on trigger."
  type        = string
}

variable "billing_account_id" {
  description = "Billing account ID (e.g., 01ABCD-23EFGH-456IJK). The target project is linked to this account."
  type        = string
}

variable "notify_email" {
  description = "Email recipient for kill-confirmation and error alerts."
  type        = string

  validation {
    condition     = can(regex("^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$", var.notify_email))
    error_message = "notify_email must be a valid email address."
  }
}

variable "threshold_usd" {
  description = "Month-to-date spend threshold in whole USD that triggers the kill."
  type        = number
  default     = 1

  validation {
    condition     = floor(var.threshold_usd) == var.threshold_usd && var.threshold_usd > 0
    error_message = "threshold_usd must be a positive whole number (fractional dollars not supported)."
  }
}

variable "dry_run" {
  description = "When true, function logs its intent but does not actually detach billing."
  type        = bool
  default     = true
}

variable "region" {
  description = "Region for Cloud Function and Pub/Sub."
  type        = string
  default     = "us-central1"
}

variable "name_prefix" {
  description = "Prefix applied to all resource names."
  type        = string
  default     = "billing-kill"
}
