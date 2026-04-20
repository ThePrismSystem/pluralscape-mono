# GCP Billing Kill Switch

Auto-detaches billing from a single GCP project when month-to-date spend exceeds
a threshold (default **$1 USD**). Confirms the kill via email.

## How it works

```
Month-to-date spend > threshold
  → GCP Billing evaluates budget (multi-hour cadence — NOT real-time)
  → Budget publishes to Pub/Sub topic
  → Cloud Function receives, detaches billing via updateBillingInfo
  → Function logs event=billing_disabled
  → Log-based metric → alert policy → email to notify_email
```

> **Latency caveat.** Budget evaluation runs on GCP's schedule (typically every
> few hours), so this is a _soft_ cap, not an instant cutoff. Spend can keep
> accruing between the threshold being crossed and the next budget evaluation.
> Sized to the Crowdin → Google Translate free-tier use case where the worst
> realistic overshoot is single-digit dollars.

## What this creates

All resources live inside `var.project_id` (and the linked billing account):

- 1 Pub/Sub topic (`<name_prefix>-budget`) — budget delivery
- 1 GCS bucket (`<project>-<name_prefix>-source`) — function source zip
- 1 Cloud Functions Gen 2 (`<name_prefix>-fn`, python312, max 1 instance)
- 1 service account (`<name_prefix>-sa`) with `roles/billing.projectManager`
  on the target project plus `roles/run.invoker` and `roles/eventarc.eventReceiver`
- 1 billing budget on `billing_account_id`, scoped to this project only
- 1 log-based metric + 2 alert policies (success + error) + 1 email channel
- 11 service APIs enabled (see `apis.tf`)

## Cost

The kill switch itself is designed to fit within GCP's always-free tier:
Cloud Functions Gen 2, Pub/Sub, Cloud Logging, and Cloud Monitoring all
have free monthly quotas that comfortably cover a single function invoked
a handful of times per month. Cloud Storage charges a few cents per month
for the source bucket. There is no free tier for **billing budgets** but
they are themselves free to create.

## Prerequisites

- `gcloud` CLI authenticated as a user with:
  - `roles/owner` (or equivalent) on the target project
  - `roles/billing.admin` on the billing account
- `terraform` >= 1.5
- Python 3.12 (only needed to run unit tests locally)

## Deploy

1. Authenticate Application Default Credentials. Terraform's google provider
   uses ADC, not your `gcloud` session, and the billingbudgets API requires a
   quota project — without it, `terraform apply` fails with a 403:

   ```bash
   gcloud config set project <project-id>
   gcloud auth application-default login
   gcloud auth application-default set-quota-project <project-id>
   ```

   Use the same `<project-id>` you'll set as `project_id` in `terraform.tfvars`.
   Setting the active project up front lets the later `gcloud` commands in
   this README run without `--project` flags.

2. Enable the Cloud Resource Manager API **once, by hand**. Terraform itself
   calls this API to read/write service states, so it can't bootstrap it:

   ```bash
   gcloud services enable cloudresourcemanager.googleapis.com --project=<project-id>
   ```

   Wait ~30-60 seconds for propagation before continuing.

3. Provide variables. Two options:

   **Option A — `terraform.tfvars` file:**

   ```bash
   cd terraform
   cp terraform.tfvars.example terraform.tfvars
   $EDITOR terraform.tfvars
   ```

   **Option B — `TF_VAR_*` env vars** (works with direnv, 1Password CLI, etc.):

   ```bash
   export TF_VAR_project_id=<project-id>
   export TF_VAR_billing_account_id=01ABCD-23EFGH-456IJK
   export TF_VAR_notify_email=you@example.com
   ```

   You can mix both — tfvars file sets defaults, env vars override per-shell.

   Find your billing account ID with:

   ```bash
   gcloud billing accounts list
   ```

4. Initial deploy **in dry-run mode** (the default):

   ```bash
   terraform init
   terraform plan
   terraform apply
   ```

   This first apply sends a verification email to `notify_email` for the
   monitoring channel — see step 5.

5. **Verify the email notification channel**: GCP sends a verification email
   to `notify_email` during the first apply. Click the link in that email.
   Until verified, alerts will **not** deliver — the kill could fire silently.

6. **Test the pipeline in dry-run**:

   ```bash
   TOPIC=$(terraform output -raw budget_topic)

   gcloud pubsub topics publish "$TOPIC" --message='{
     "budgetDisplayName": "billing-kill-budget",
     "costAmount": 2.0,
     "budgetAmount": 1.0,
     "currencyCode": "USD"
   }'
   ```

   Then in Cloud Logging, filter by the function name and confirm a log entry
   with `jsonPayload.event="dry_run_would_disable"` appears within a minute or
   two (first invocation adds ~30-60s of cold start).

7. **Arm** the kill switch:

   ```bash
   terraform apply -var dry_run=false
   ```

   Confirm the output shows `dry_run = false`.

## End-to-end test (optional, destructive)

The dry-run pipeline test in step 6 above exercises every component
**except** the final `updateBillingInfo` call. The only way to fully
verify the live path is to let the threshold actually trigger — which
detaches billing and breaks any service depending on it.

If you decide to do this:

1. Run `terraform apply -var dry_run=false` to arm the switch.
2. Generate enough billable activity to cross the threshold (e.g., make
   `threshold_usd` very small first, then incur a tiny billable cost).
3. Wait for the next budget evaluation — typically a few hours, sometimes
   longer. There is no way to force this.
4. Confirm: project shows "billing disabled" in the GCP console, the
   success email arrives, and `jsonPayload.event="billing_disabled"`
   appears in Cloud Logging.
5. Recover (see below) and reset `threshold_usd` if you changed it.

For most callers the dry-run test is sufficient confidence — skip this.

## Recovery after a kill

```bash
gcloud beta billing projects link <project-id> \
  --billing-account=<billing-account-id>
```

> **Re-trigger risk.** Budgets track _month-to-date_ spend. If you re-link
> billing while month-to-date spend is still above `threshold_usd`, the next
> budget evaluation will fire the kill again within hours. Either wait for
> the month to roll over, or `terraform apply -var threshold_usd=<higher>`
> before re-linking.

The kill switch auto-rearms on the next billing cycle (budgets reset
month-to-date).

## Teardown

```bash
cd terraform
terraform destroy
```

This removes the budget, Pub/Sub, function, SA, metric, and alert policies.
It does NOT re-attach billing if the kill already fired.

## Running unit tests

```bash
cd terraform/function_source
python3 -m venv .venv
.venv/bin/pip install -r requirements-dev.txt
.venv/bin/pytest tests/ -v
```
