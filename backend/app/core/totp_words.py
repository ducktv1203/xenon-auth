from __future__ import annotations

import base64
import hashlib
import hmac
import random
import struct
import time
from typing import Sequence

from mnemonic import Mnemonic

BIP39_WORD_COUNT = 2048


def _decode_base32_secret(secret_key: str) -> bytes:
    normalized = secret_key.strip().replace(" ", "").upper()
    missing_padding = (-len(normalized)) % 8
    normalized += "=" * missing_padding
    return base64.b32decode(normalized, casefold=True)


def load_bip39_wordlist() -> list[str]:
    words = Mnemonic("english").wordlist
    if len(words) != BIP39_WORD_COUNT:
        raise ValueError("BIP-39 word list length is not 2048")
    return words


def generate_totp_hmac(secret_key: str, for_time: int | None = None, time_step: int = 60) -> bytes:
    if for_time is None:
        for_time = int(time.time())

    key = _decode_base32_secret(secret_key)
    counter = for_time // time_step
    counter_bytes = struct.pack(">Q", counter)
    return hmac.new(key, counter_bytes, hashlib.sha1).digest()


def extract_raw_code_from_digest(hmac_digest: bytes) -> int:
    if len(hmac_digest) < 20:
        raise ValueError("Expected a SHA-1 HMAC digest")

    offset = hmac_digest[-1] & 0x0F
    return struct.unpack(">I", hmac_digest[offset : offset + 4])[0]


def integer_to_three_indices(raw_code: int) -> tuple[int, int, int]:
    index1 = raw_code % BIP39_WORD_COUNT
    index2 = (raw_code // BIP39_WORD_COUNT) % BIP39_WORD_COUNT
    index3 = (raw_code // (BIP39_WORD_COUNT**2)) % BIP39_WORD_COUNT

    indices = [index1, index2, index3]
    used: set[int] = set()

    # Keep the requested base mapping, then resolve collisions deterministically.
    for i, idx in enumerate(indices):
        candidate = idx
        while candidate in used:
            candidate = (candidate + 1 + ((raw_code >> (i * 7)) & 0x3F)) % BIP39_WORD_COUNT
        indices[i] = candidate
        used.add(candidate)

    return indices[0], indices[1], indices[2]


def build_hybrid_lexicon(custom_words: Sequence[str] | None = None) -> list[str]:
    defaults = load_bip39_wordlist()
    if not custom_words:
        return defaults

    normalized_custom = [w.strip().lower() for w in custom_words if w and w.strip()]
    if len(normalized_custom) > BIP39_WORD_COUNT:
        raise ValueError("Custom word list cannot exceed 2048 entries")

    unique_custom: list[str] = []
    seen: set[str] = set()
    for word in normalized_custom:
        if word not in seen:
            unique_custom.append(word)
            seen.add(word)

    remaining = [word for word in defaults if word not in seen]
    filled = unique_custom + remaining
    return filled[:BIP39_WORD_COUNT]


def deterministic_shuffle(words: Sequence[str], secret_key: str) -> list[str]:
    if len(words) != BIP39_WORD_COUNT:
        raise ValueError("Word list must contain exactly 2048 items")

    seed_bytes = hashlib.sha256(secret_key.encode("utf-8")).digest()
    rng = random.Random(int.from_bytes(seed_bytes, byteorder="big"))
    shuffled = list(words)

    for i in range(len(shuffled) - 1, 0, -1):
        j = rng.randint(0, i)
        shuffled[i], shuffled[j] = shuffled[j], shuffled[i]

    return shuffled


def generate_three_word_code(
    secret_key: str,
    for_time: int | None = None,
    custom_words: Sequence[str] | None = None,
    time_step: int = 60,
) -> tuple[str, str, str]:
    digest = generate_totp_hmac(secret_key, for_time=for_time, time_step=time_step)
    raw_code = extract_raw_code_from_digest(digest)
    lexicon = deterministic_shuffle(build_hybrid_lexicon(custom_words), secret_key)
    i1, i2, i3 = integer_to_three_indices(raw_code)
    return lexicon[i1], lexicon[i2], lexicon[i3]
