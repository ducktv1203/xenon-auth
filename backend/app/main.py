from __future__ import annotations

from fastapi import FastAPI
from pydantic import BaseModel, Field

from app.core.totp_words import (
    extract_raw_code_from_digest,
    generate_three_word_code,
    generate_totp_hmac,
    integer_to_three_indices,
)

app = FastAPI(title="Xenon Auth Backend", version="0.1.0")


class WordPreviewRequest(BaseModel):
    secret_key: str = Field(..., description="Base32 secret key")
    unix_time: int | None = Field(default=None, description="Optional UNIX timestamp")


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
