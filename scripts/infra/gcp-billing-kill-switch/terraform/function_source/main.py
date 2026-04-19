"""GCP billing kill switch — detaches billing from the project on budget event."""

from __future__ import annotations

import base64
import json
import os

from google.cloud.billing import CloudBillingClient, ProjectBillingInfo

PROJECT_ID = os.environ["TARGET_PROJECT_ID"]


def _dry_run() -> bool:
    return os.environ.get("DRY_RUN", "false").lower() == "true"


def _emit(event: str, severity: str = "INFO", **fields) -> None:
    print(json.dumps({"severity": severity, "event": event, **fields}), flush=True)


def kill_billing(cloud_event) -> None:
    """Entrypoint. Triggered by Pub/Sub event from a billing budget."""
    raw = cloud_event.data["message"]["data"]
    payload = json.loads(base64.b64decode(raw))

    cost = float(payload["costAmount"])
    budget = float(payload["budgetAmount"])

    if cost < budget:
        _emit("threshold_not_crossed", cost=cost, budget=budget)
        return

    client = CloudBillingClient()
    project_name = f"projects/{PROJECT_ID}"
    current = client.get_project_billing_info(name=project_name)

    if not current.billing_account_name:
        _emit("billing_already_detached", project=PROJECT_ID)
        return

    if _dry_run():
        _emit("dry_run_would_disable", project=PROJECT_ID, cost=cost, budget=budget)
        return

    client.update_project_billing_info(
        name=project_name,
        project_billing_info=ProjectBillingInfo(billing_account_name=""),
    )
    _emit("billing_disabled", project=PROJECT_ID, cost=cost, budget=budget)
