import base64
import json
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))


@pytest.fixture(autouse=True)
def _isolate_env(monkeypatch):
    # Required at import time by main.py
    monkeypatch.setenv("TARGET_PROJECT_ID", "test-project")
    # Cleared so test order can't leak state between cases
    monkeypatch.delenv("DRY_RUN", raising=False)


def make_event(cost: float, budget: float):
    payload = json.dumps({"costAmount": cost, "budgetAmount": budget}).encode()
    return _event_from_bytes(payload)


def make_raw_event(raw: bytes):
    return _event_from_bytes(raw)


def _event_from_bytes(raw: bytes):
    encoded = base64.b64encode(raw).decode()

    class FakeEvent:
        data = {"message": {"data": encoded}}

    return FakeEvent()


@pytest.fixture
def budget_event():
    return make_event


@pytest.fixture
def raw_budget_event():
    return make_raw_event
