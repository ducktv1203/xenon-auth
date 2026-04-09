from app.core.totp_words import BIP39_WORD_COUNT, integer_to_three_indices


def test_integer_mapping_matches_formula_when_unique() -> None:
    raw_code = 2_345_678_901

    expected_1 = raw_code % BIP39_WORD_COUNT
    expected_2 = (raw_code // BIP39_WORD_COUNT) % BIP39_WORD_COUNT
    expected_3 = (raw_code // (BIP39_WORD_COUNT**2)) % BIP39_WORD_COUNT

    i1, i2, i3 = integer_to_three_indices(raw_code)

    assert i1 == expected_1
    assert i2 == expected_2
    assert i3 == expected_3


def test_integer_mapping_always_returns_three_distinct_indices() -> None:
    # 0 would map to (0, 0, 0) with pure base-2048 decomposition.
    i1, i2, i3 = integer_to_three_indices(0)

    assert len({i1, i2, i3}) == 3
    assert 0 <= i1 < BIP39_WORD_COUNT
    assert 0 <= i2 < BIP39_WORD_COUNT
    assert 0 <= i3 < BIP39_WORD_COUNT
