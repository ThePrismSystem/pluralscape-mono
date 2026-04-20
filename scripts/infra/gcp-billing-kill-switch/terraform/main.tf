terraform {
  required_version = ">= 1.5"

  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 7.0"
    }
    google-beta = {
      source  = "hashicorp/google-beta"
      version = "~> 7.0"
    }
    archive = {
      source  = "hashicorp/archive"
      version = "~> 2.4"
    }
  }
}

provider "google" {
  project = var.project_id
  region  = var.region

  # user_project_override + billing_project tell the provider to send
  # project_id as the quota project for API calls. Without this, APIs
  # that require a quota project (billingbudgets, serviceusage, ...)
  # reject user-ADC requests with 403 "quota project not set".
  user_project_override = true
  billing_project       = var.project_id
}

provider "google-beta" {
  project = var.project_id
  region  = var.region

  user_project_override = true
  billing_project       = var.project_id
}

locals {
  topic_name      = "${var.name_prefix}-budget"
  function_name   = "${var.name_prefix}-fn"
  sa_account_id   = "${var.name_prefix}-sa"
  budget_name     = "${var.name_prefix}-budget"
  log_metric_name = "${var.name_prefix}_disabled"
  success_policy  = "${var.name_prefix}-success"
  error_policy    = "${var.name_prefix}-errors"
  channel_name    = "${var.name_prefix}-email"
}

data "google_project" "target" {
  project_id = var.project_id
}
