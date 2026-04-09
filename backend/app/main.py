from __future__ import annotations

from datetime import datetime, timezone
from threading import Lock
from typing import Literal
from uuid import uuid4

from fastapi import FastAPI
from pydantic import BaseModel, Field

from app.core.totp_words import (
    extract_raw_code_from_digest,
    generate_three_word_code,
    generate_totp_hmac,
    integer_to_three_indices,
)

app = FastAPI(title="Xenon Auth Backend", version="0.1.0")

ChallengeStatus = Literal["pending", "approved", "denied", "expired"]

_ACTIVE_CHALLENGE_TTL_SECONDS = 120
_challenge_lock = Lock()
_active_challenges: dict[str, dict[str, object]] = {}


class WordPreviewRequest(BaseModel):
    secret_key: str = Field(..., description="Base32 secret key")
    unix_time: int | None = Field(default=None, description="Optional UNIX timestamp")


class ActiveChallengeCreateRequest(BaseModel):
    user: str = Field(default="demo.user@xenon.local", description="User being challenged")
    application: str = Field(default="Xenon VPN", description="Service requesting approval")
    location: str = Field(default="Browser sign-in", description="Login source or location")
    device_label: str = Field(default="Demo device", description="Originating device label")
    message: str | None = Field(default=None, description="Custom display message")


class ActiveChallengeRecord(BaseModel):
    id: str
    user: str
    application: str
    location: str
    device_label: str
    message: str
    status: ChallengeStatus
    created_at: int
    expires_at: int
    responded_at: int | None = None


def _now_unix() -> int:
    return int(datetime.now(timezone.utc).timestamp())


def _create_challenge(payload: ActiveChallengeCreateRequest) -> dict[str, object]:
    now = _now_unix()
    challenge_id = uuid4().hex[:12]
    return {
        "id": challenge_id,
        "user": payload.user,
        "application": payload.application,
        "location": payload.location,
        "device_label": payload.device_label,
        "message": payload.message or f"Approve sign-in for {payload.application}",
        "status": "pending",
        "created_at": now,
        "expires_at": now + _ACTIVE_CHALLENGE_TTL_SECONDS,
        "responded_at": None,
    }


def _expire_if_needed(record: dict[str, object]) -> None:
    if record["status"] == "pending" and _now_unix() >= int(record["expires_at"]):
        record["status"] = "expired"
        record["responded_at"] = _now_unix()


def _get_challenge_or_404(challenge_id: str) -> dict[str, object]:
    with _challenge_lock:
        record = _active_challenges.get(challenge_id)
        if record is None:
            from fastapi import HTTPException

            raise HTTPException(status_code=404, detail="Challenge not found")
        _expire_if_needed(record)
        return record


def _set_challenge_status(challenge_id: str, status: ChallengeStatus) -> dict[str, object]:
    with _challenge_lock:
        record = _active_challenges.get(challenge_id)
        if record is None:
            from fastapi import HTTPException

            raise HTTPException(status_code=404, detail="Challenge not found")
        _expire_if_needed(record)
        if record["status"] != "pending":
            from fastapi import HTTPException

            raise HTTPException(status_code=409, detail=f'Challenge is already {record["status"]}')
        record["status"] = status
        record["responded_at"] = _now_unix()
        return record


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/preview/words")
def preview_words(payload: WordPreviewRequest) -> dict[str, object]:
    digest = generate_totp_hmac(payload.secret_key, for_time=payload.unix_time, time_step=60)
    raw_code = extract_raw_code_from_digest(digest)
    indices = integer_to_three_indices(raw_code)
    words = generate_three_word_code(payload.secret_key, for_time=payload.unix_time, time_step=60)

    return {
        "raw_code": raw_code,
        "indices": list(indices),
        "words": list(words),
    }


@app.get("/active/challenges")
def list_active_challenges(state: str = "pending") -> dict[str, object]:
    normalized_state = state.lower().strip()
    if normalized_state not in {"pending", "approved", "denied", "expired", "all"}:
        from fastapi import HTTPException

        raise HTTPException(status_code=400, detail="Invalid challenge state")

    with _challenge_lock:
        for record in _active_challenges.values():
            _expire_if_needed(record)

        challenges = [
            ActiveChallengeRecord(**record).model_dump()
            for record in sorted(
                _active_challenges.values(),
                key=lambda item: int(item["created_at"]),
                reverse=True,
            )
            if normalized_state == "all" or record["status"] == normalized_state
        ]

    return {"challenges": challenges}


@app.post("/active/challenges", response_model=ActiveChallengeRecord)
def create_active_challenge(payload: ActiveChallengeCreateRequest) -> dict[str, object]:
    record = _create_challenge(payload)
    with _challenge_lock:
        _active_challenges[record["id"]] = record
    return record


@app.post("/active/challenges/demo", response_model=ActiveChallengeRecord)
def create_demo_active_challenge() -> dict[str, object]:
    return create_active_challenge(
        ActiveChallengeCreateRequest(
            user="demo.user@xenon.local",
            application="Xenon Demo Portal",
            location="Browser sign-in",
            device_label="Demo browser",
            message="Approve the demo sign-in attempt",
        )
    )


@app.post("/active/challenges/{challenge_id}/approve", response_model=ActiveChallengeRecord)
def approve_active_challenge(challenge_id: str) -> dict[str, object]:
    return _set_challenge_status(challenge_id, "approved")


@app.post("/active/challenges/{challenge_id}/deny", response_model=ActiveChallengeRecord)
def deny_active_challenge(challenge_id: str) -> dict[str, object]:
    return _set_challenge_status(challenge_id, "denied")
