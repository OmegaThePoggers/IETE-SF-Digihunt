from app.services.round_key import keys_match, scramble_key


def test_scramble_preserves_characters_and_layout():
    plain = "DIGI-AB-7Z-Q4"
    scrambled = scramble_key(plain, team_code="KH-2048", round_number=1)

    assert scrambled != plain
    assert scrambled.startswith("DIGI-")
    assert [len(b) for b in scrambled.split("-")] == [len(b) for b in plain.split("-")]
    assert sorted(scrambled.replace("-", "")) == sorted(plain.replace("-", ""))


def test_scramble_is_deterministic_per_team_and_round():
    a = scramble_key("DIGI-AB-7Z-Q4", team_code="KH-2048", round_number=1)
    b = scramble_key("DIGI-AB-7Z-Q4", team_code="KH-2048", round_number=1)
    c = scramble_key("DIGI-AB-7Z-Q4", team_code="KH-2048", round_number=2)

    assert a == b
    assert a != c


def test_scramble_differs_between_teams():
    a = scramble_key("DIGI-AB-7Z-Q4", team_code="KH-2048", round_number=1)
    b = scramble_key("DIGI-AB-7Z-Q4", team_code="KH-9999", round_number=1)

    assert a != b


def test_keys_match_is_case_and_whitespace_insensitive():
    assert keys_match("  digi-ab-7z-q4 ", "DIGI-AB-7Z-Q4")
    assert not keys_match("DIGI-AB-7Z-Q5", "DIGI-AB-7Z-Q4")
