from fastapi.testclient import TestClient

from app.main import _active_challenges, app

client = TestClient(app)


def setup_function() -> None:
    _active_challenges.clear()


def teardown_function() -> None:
    _active_challenges.clear()


def test_create_and_list_pending_challenge() -> None:
    response = client.post(
        "/active/challenges",
        json={
            "user": "alice@example.com",
            "application": "Xenon VPN",
            "location": "London, UK",
            "device_label": "Chrome on Mac",
            "message": "Approve VPN sign-in",
        },
    )

    assert response.status_code == 200
    challenge = response.json()
    assert challenge["status"] == "pending"
    assert challenge["user"] == "alice@example.com"

    list_response = client.get("/active/challenges")
    assert list_response.status_code == 200
    pending = list_response.json()["challenges"]
    assert len(pending) == 1
    assert pending[0]["id"] == challenge["id"]


def test_approve_and_deny_challenges() -> None:
    first = client.post(
        "/active/challenges",
        json={"user": "bob@example.com", "application": "Xenon App"},
    ).json()
    second = client.post(
        "/active/challenges",
        json={"user": "carol@example.com", "application": "Xenon Admin"},
    ).json()

    approve_response = client.post(f"/active/challenges/{first['id']}/approve")
    assert approve_response.status_code == 200
    assert approve_response.json()["status"] == "approved"

    deny_response = client.post(f"/active/challenges/{second['id']}/deny")
    assert deny_response.status_code == 200
    assert deny_response.json()["status"] == "denied"

    approved = client.get("/active/challenges", params={"state": "approved"}).json()["challenges"]
    denied = client.get("/active/challenges", params={"state": "denied"}).json()["challenges"]

    assert {item["id"] for item in approved} == {first["id"]}
    assert {item["id"] for item in denied} == {second["id"]}
