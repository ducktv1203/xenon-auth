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
            "verification_code": "321",
        },
    )

    assert response.status_code == 200
    challenge = response.json()
    assert challenge["status"] == "pending"
    assert challenge["user"] == "alice@example.com"
    assert challenge["verification_code"] == "321"

    list_response = client.get("/active/challenges")
    assert list_response.status_code == 200
    pending = list_response.json()["challenges"]
    assert len(pending) == 1
    assert pending[0]["id"] == challenge["id"]


def test_approve_and_deny_challenges() -> None:
    first = client.post(
        "/active/challenges",
        json={"user": "bob@example.com", "application": "Xenon App", "verification_code": "123"},
    ).json()
    second = client.post(
        "/active/challenges",
        json={"user": "carol@example.com", "application": "Xenon Admin", "verification_code": "456"},
    ).json()

    approve_response = client.post(
        f"/active/challenges/{first['id']}/approve",
        json={"verification_code": "123"},
    )
    assert approve_response.status_code == 200
    assert approve_response.json()["status"] == "approved"

    deny_response = client.post(f"/active/challenges/{second['id']}/deny")
    assert deny_response.status_code == 200
    assert deny_response.json()["status"] == "denied"

    approved = client.get("/active/challenges", params={"state": "approved"}).json()["challenges"]
    denied = client.get("/active/challenges", params={"state": "denied"}).json()["challenges"]

    assert {item["id"] for item in approved} == {first["id"]}
    assert {item["id"] for item in denied} == {second["id"]}


def test_approve_wrong_verification_code_auto_denies() -> None:
    challenge = client.post(
        "/active/challenges",
        json={"user": "dina@example.com", "application": "Xenon Admin", "verification_code": "777"},
    ).json()

    response = client.post(
        f"/active/challenges/{challenge['id']}/approve",
        json={"verification_code": "123"},
    )

    assert response.status_code == 200
    assert response.json()["status"] == "denied"


def test_create_challenge_with_custom_ttl() -> None:
    response = client.post(
        "/active/challenges",
        json={
            "user": "erin@example.com",
            "application": "Xenon Portal",
            "ttl_seconds": 300,
        },
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["expires_at"] - payload["created_at"] == 300


def test_setup_uri_endpoint() -> None:
    response = client.post(
        "/enrollment/setup-uri",
        json={
            "secret_key": "JBSWY3DPEHPK3PXP",
            "account_name": "alice@example.com",
            "issuer": "Xenon Auth",
        },
    )

    assert response.status_code == 200
    payload = response.json()
    assert "otpauth://totp/" in payload["otpauth_uri"]
    assert "secret=JBSWY3DPEHPK3PXP" in payload["otpauth_uri"]


def test_preview_words_rejects_invalid_secret() -> None:
    response = client.post(
        "/preview/words",
        json={
            "secret_key": "invalid!",
        },
    )

    assert response.status_code == 400
