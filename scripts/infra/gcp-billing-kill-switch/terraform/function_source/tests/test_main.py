import json
from unittest.mock import MagicMock, patch

import pytest


def _last_log(capsys) -> dict:
    out = capsys.readouterr().out.strip().splitlines()
    assert out, "expected structured log output"
    return json.loads(out[-1])


def _logs(capsys) -> list[dict]:
    return [json.loads(line) for line in capsys.readouterr().out.strip().splitlines()]


@patch("main.CloudBillingClient")
def test_threshold_not_crossed_is_noop(mock_client_cls, budget_event, capsys):
    import main

    main.kill_billing(budget_event(cost=0.5, budget=1.0))

    mock_client_cls.return_value.get_project_billing_info.assert_not_called()
    mock_client_cls.return_value.update_project_billing_info.assert_not_called()
    log = _last_log(capsys)
    assert log["event"] == "threshold_not_crossed"
    assert log["severity"] == "INFO"
    assert log["cost"] == 0.5
    assert log["budget"] == 1.0


@patch("main.CloudBillingClient")
def test_already_detached_is_noop(mock_client_cls, budget_event, monkeypatch, capsys):
    monkeypatch.setenv("DRY_RUN", "false")
    import main

    client = mock_client_cls.return_value
    client.get_project_billing_info.return_value = MagicMock(billing_account_name="")

    main.kill_billing(budget_event(cost=1.0, budget=1.0))

    client.update_project_billing_info.assert_not_called()
    assert _last_log(capsys)["event"] == "billing_already_detached"


@patch("main.CloudBillingClient")
def test_dry_run_does_not_call_update(mock_client_cls, budget_event, monkeypatch, capsys):
    monkeypatch.setenv("DRY_RUN", "true")
    import main

    client = mock_client_cls.return_value
    client.get_project_billing_info.return_value = MagicMock(
        billing_account_name="billingAccounts/XXXXXX-XXXXXX-XXXXXX"
    )

    main.kill_billing(budget_event(cost=1.0, budget=1.0))

    client.update_project_billing_info.assert_not_called()
    log = _last_log(capsys)
    assert log["event"] == "dry_run_would_disable"
    assert log["project"] == "test-project"


@patch("main.CloudBillingClient")
def test_kill_detaches_billing(mock_client_cls, budget_event, monkeypatch, capsys):
    monkeypatch.setenv("DRY_RUN", "false")
    import main

    client = mock_client_cls.return_value
    client.get_project_billing_info.return_value = MagicMock(
        billing_account_name="billingAccounts/XXXXXX-XXXXXX-XXXXXX"
    )

    main.kill_billing(budget_event(cost=1.5, budget=1.0))

    client.update_project_billing_info.assert_called_once()
    call = client.update_project_billing_info.call_args
    assert call.kwargs["name"] == "projects/test-project"
    assert call.kwargs["project_billing_info"].billing_account_name == ""

    log = _last_log(capsys)
    assert log["event"] == "billing_disabled"
    assert log["severity"] == "INFO"
    assert log["project"] == "test-project"
    assert log["cost"] == 1.5
    assert log["budget"] == 1.0


@patch("main.CloudBillingClient")
def test_missing_cost_amount_raises(mock_client_cls, raw_budget_event):
    import main

    with pytest.raises(KeyError):
        main.kill_billing(raw_budget_event(b'{"budgetAmount": 1.0}'))
    mock_client_cls.return_value.update_project_billing_info.assert_not_called()


@patch("main.CloudBillingClient")
def test_missing_budget_amount_raises(mock_client_cls, raw_budget_event):
    import main

    with pytest.raises(KeyError):
        main.kill_billing(raw_budget_event(b'{"costAmount": 2.0}'))
    mock_client_cls.return_value.update_project_billing_info.assert_not_called()


@patch("main.CloudBillingClient")
def test_non_numeric_cost_raises(mock_client_cls, raw_budget_event):
    import main

    with pytest.raises(ValueError):
        main.kill_billing(raw_budget_event(b'{"costAmount": "abc", "budgetAmount": 1.0}'))
    mock_client_cls.return_value.update_project_billing_info.assert_not_called()


@patch("main.CloudBillingClient")
def test_get_billing_info_api_failure_propagates(mock_client_cls, budget_event, monkeypatch):
    monkeypatch.setenv("DRY_RUN", "false")
    import main

    client = mock_client_cls.return_value
    client.get_project_billing_info.side_effect = RuntimeError("boom")

    with pytest.raises(RuntimeError, match="boom"):
        main.kill_billing(budget_event(cost=1.5, budget=1.0))
    client.update_project_billing_info.assert_not_called()


@patch("main.CloudBillingClient")
def test_update_billing_info_api_failure_propagates(mock_client_cls, budget_event, monkeypatch, capsys):
    monkeypatch.setenv("DRY_RUN", "false")
    import main

    client = mock_client_cls.return_value
    client.get_project_billing_info.return_value = MagicMock(
        billing_account_name="billingAccounts/XXXXXX-XXXXXX-XXXXXX"
    )
    client.update_project_billing_info.side_effect = RuntimeError("api down")

    with pytest.raises(RuntimeError, match="api down"):
        main.kill_billing(budget_event(cost=1.5, budget=1.0))

    # billing_disabled must NOT have been logged — detach did not succeed
    events = [log["event"] for log in _logs(capsys)]
    assert "billing_disabled" not in events
