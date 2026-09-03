import pytest

from app.services.key_phrases import PHRASE_BANKS, phrase_for_round


def test_every_mcq_round_has_a_bank():
    assert set(PHRASE_BANKS) == {1, 2, 3}
    for round_number, bank in PHRASE_BANKS.items():
        assert len(bank) >= 4, round_number


def test_phrases_are_upper_case_words_only():
    for bank in PHRASE_BANKS.values():
        for phrase, hint in bank:
            assert phrase == phrase.upper()
            assert phrase.replace(" ", "").isalpha()
            assert hint.strip()


def test_phrase_is_deterministic_per_team_and_round():
    assert phrase_for_round("DGH-009", 1) == phrase_for_round("DGH-009", 1)
    assert phrase_for_round("DGH-009", 1) != phrase_for_round("DGH-009", 2)


def test_phrase_varies_between_teams():
    picks = {phrase_for_round(f"DGH-{number:03d}", 1)[0] for number in range(40)}
    assert len(picks) > 1


def test_unknown_round_raises():
    with pytest.raises(KeyError):
        phrase_for_round("DGH-009", 9)
