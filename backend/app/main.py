from __future__ import annotations

from datetime import datetime, timezone
import hashlib
import os
import random
from threading import Lock
from typing import Literal
from urllib.parse import quote
from uuid import uuid4

from fastapi import FastAPI
from fastapi import HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from app.core.totp_words import (
    extract_raw_code_from_digest,
    generate_three_word_code,
    generate_totp_hmac,
    integer_to_three_indices,
)

app = FastAPI(title="Xenon Auth Backend", version="0.1.0")


def _load_allowed_origins() -> list[str]:
    # In production, use os.getenv("CORS_ALLOW_ORIGINS")
    # For development/demo purposes, we allow all origins to facilitate 
    # testing across multiple local devices (phone, laptop, etc.) without IP mismatches.
    return ["*"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_load_allowed_origins(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

ChallengeStatus = Literal["pending", "approved", "denied", "expired"]

_ACTIVE_CHALLENGE_TTL_SECONDS = 120
_challenge_lock = Lock()
_active_challenges: dict[str, dict[str, object]] = {}
_enrollment_lock = Lock()
_enrollment_connections: dict[str, dict[str, object]] = {}


class WordPreviewRequest(BaseModel):
    secret_key: str = Field(..., description="Base32 secret key")
    unix_time: int | None = Field(default=None, description="Optional UNIX timestamp")


class SetupUriRequest(BaseModel):
    secret_key: str = Field(..., description="Base32 secret key")
    account_name: str = Field(default="user@xenon", description="Account label shown in authenticator")
    issuer: str = Field(default="Xenon Auth", description="Issuer label shown in authenticator")


class EnrollmentConnectionUpdateRequest(BaseModel):
    secret_key: str = Field(..., description="Base32 secret key")
    account_name: str = Field(..., description="Account label")
    issuer: str = Field(..., description="Issuer label")
    connected: bool = Field(default=True, description="Current enrollment connection state")


class ActiveChallengeCreateRequest(BaseModel):
    user: str = Field(default="unknown.user@xenon", description="User being challenged")
    application: str = Field(default="Xenon Auth Request", description="Service requesting approval")
    location: str = Field(default="Unknown location", description="Login source or location")
    device_label: str = Field(default="Unknown device", description="Originating device label")
    message: str | None = Field(default=None, description="Custom display message")
    verification_code: str | None = Field(
        default=None,
        description="Optional 3-digit code shown on the sign-in screen",
    )
    ttl_seconds: int | None = Field(
        default=None,
        ge=15,
        le=900,
        description="Optional request expiry override in seconds",
    )


class ActiveChallengeApproveRequest(BaseModel):
    verification_code: str = Field(..., description="3-digit code shown during sign-in")


class ActiveChallengeRecord(BaseModel):
    id: str
    user: str
    application: str
    location: str
    device_label: str
    message: str
    verification_code: str
    status: ChallengeStatus
    created_at: int
    expires_at: int
    responded_at: int | None = None


class ActiveChallengePublicRecord(BaseModel):
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
    if payload.verification_code is not None:
        raw_code = payload.verification_code.strip()
    else:
        raw_code = f"{random.randint(0, 999):03d}"
    if len(raw_code) != 3 or not raw_code.isdigit():
        raise HTTPException(status_code=400, detail="verification_code must be a 3-digit string")

    ttl_seconds = payload.ttl_seconds or _ACTIVE_CHALLENGE_TTL_SECONDS

    return {
        "id": challenge_id,
        "user": payload.user,
        "application": payload.application,
        "location": payload.location,
        "device_label": payload.device_label,
        "message": payload.message or f"Approve sign-in for {payload.application}",
        "verification_code": raw_code,
        "status": "pending",
        "created_at": now,
        "expires_at": now + ttl_seconds,
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


def _build_otpauth_uri(secret_key: str, account_name: str, issuer: str) -> str:
    safe_account = quote(account_name.strip() or "user@xenon", safe="")
    safe_issuer = quote(issuer.strip() or "Xenon Auth", safe="")
    safe_secret = secret_key.strip().replace(" ", "").upper()
    if not safe_secret:
        raise HTTPException(status_code=400, detail="secret_key is required")
    return (
        f"otpauth://totp/{safe_issuer}:{safe_account}"
        f"?secret={safe_secret}&issuer={safe_issuer}&algorithm=SHA1&digits=6&period=60"
    )


def _normalize_secret(secret_key: str) -> str:
    return secret_key.strip().replace(" ", "").upper()


def _secret_fingerprint(secret_key: str) -> str:
    normalized = _normalize_secret(secret_key)
    return hashlib.sha256(normalized.encode("utf-8")).hexdigest()[:24]


def _enrollment_key(secret_key: str, account_name: str, issuer: str) -> str:
    return "|".join(
        [
            _secret_fingerprint(secret_key),
            account_name.strip().lower(),
            issuer.strip().lower(),
        ]
    )


def _to_public_challenge(record: dict[str, object]) -> dict[str, object]:
    return ActiveChallengePublicRecord(
        id=str(record["id"]),
        user=str(record["user"]),
        application=str(record["application"]),
        location=str(record["location"]),
        device_label=str(record["device_label"]),
        message=str(record["message"]),
        status=str(record["status"]),
        created_at=int(record["created_at"]),
        expires_at=int(record["expires_at"]),
        responded_at=int(record["responded_at"]) if record["responded_at"] is not None else None,
    ).model_dump()


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
    try:
        digest = generate_totp_hmac(payload.secret_key, for_time=payload.unix_time, time_step=60)
        raw_code = extract_raw_code_from_digest(digest)
        indices = integer_to_three_indices(raw_code)
        words = generate_three_word_code(payload.secret_key, for_time=payload.unix_time, time_step=60)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Invalid secret or request: {exc}") from exc

    return {
        "raw_code": raw_code,
        "indices": list(indices),
        "words": list(words),
    }


@app.post("/enrollment/setup-uri")
def create_setup_uri(payload: SetupUriRequest) -> dict[str, str]:
    uri = _build_otpauth_uri(payload.secret_key, payload.account_name, payload.issuer)
    return {"otpauth_uri": uri}


@app.post("/enrollment/connection")
def update_enrollment_connection(payload: EnrollmentConnectionUpdateRequest) -> dict[str, object]:
    key = _enrollment_key(payload.secret_key, payload.account_name, payload.issuer)
    now = _now_unix()
    with _enrollment_lock:
        _enrollment_connections[key] = {
            "connected": payload.connected,
            "updated_at": now,
        }
    return {"connected": payload.connected, "updated_at": now}


@app.get("/enrollment/connection-status")
def get_enrollment_connection_status(secret_key: str, account_name: str, issuer: str) -> dict[str, object]:
    key = _enrollment_key(secret_key, account_name, issuer)
    with _enrollment_lock:
        record = _enrollment_connections.get(key)
    if record is None:
        return {"connected": False, "updated_at": None}
    return {"connected": bool(record["connected"]), "updated_at": record["updated_at"]}


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
            _to_public_challenge(record)
            for record in sorted(
                _active_challenges.values(),
                key=lambda item: int(item["created_at"]),
                reverse=True,
            )
            if normalized_state == "all" or record["status"] == normalized_state
        ]

    return {"challenges": challenges}


@app.post("/active/challenges", response_model=ActiveChallengePublicRecord)
def create_active_challenge(payload: ActiveChallengeCreateRequest) -> dict[str, object]:
    record = _create_challenge(payload)
    with _challenge_lock:
        _active_challenges[record["id"]] = record
    return _to_public_challenge(record)


@app.post("/active/challenges/{challenge_id}/approve", response_model=ActiveChallengePublicRecord)
def approve_active_challenge(challenge_id: str, payload: ActiveChallengeApproveRequest) -> dict[str, object]:
    record = _get_challenge_or_404(challenge_id)
    if record["status"] != "pending":
        raise HTTPException(status_code=409, detail=f'Challenge is already {record["status"]}')
    if str(record["verification_code"]) != payload.verification_code.strip():
        return _to_public_challenge(_set_challenge_status(challenge_id, "denied"))
    return _to_public_challenge(_set_challenge_status(challenge_id, "approved"))


@app.post("/active/challenges/{challenge_id}/deny", response_model=ActiveChallengePublicRecord)
def deny_active_challenge(challenge_id: str) -> dict[str, object]:
    return _to_public_challenge(_set_challenge_status(challenge_id, "denied"))
