from app.services.key_phrases import phrase_for_round
from app.services.round_key import (
    fragments_for_phrase,
    keys_match,
    scramble_key,
    word_lengths,
)


def test_scramble_keeps_letters_but_not_order():
    scrambled = scramble_key("PHISHING PAYLOAD", team_code="DGH-009", round_number=2)

    assert scrambled != "PHISHING PAYLOAD"
    assert sorted(scrambled.replace(" ", "")) == sorted("PHISHINGPAYLOAD")


def test_scramble_hides_the_word_boundaries():
    scrambled = scramble_key("PHISHING PAYLOAD", team_code="DGH-009", round_number=2)

    assert " " not in scrambled.strip()


def test_scramble_is_deterministic_per_team_and_round():
    first = scramble_key("ACCESS DENIED", team_code="DGH-009", round_number=3)
    second = scramble_key("ACCESS DENIED", team_code="DGH-009", round_number=3)
    other_team = scramble_key("ACCESS DENIED", team_code="DGH-001", round_number=3)

    assert first == second
    assert first != other_team


def test_word_lengths_describe_the_answer_shape():
    assert word_lengths("PHISHING PAYLOAD") == [8, 7]


def test_fragments_cover_every_letter_exactly_once():
    fragments = fragments_for_phrase("PHISHING PAYLOAD", team_code="DGH-009", count=5)

    assert len(fragments) == 5
    assert sorted("".join(fragments)) == sorted("PHISHINGPAYLOAD")


def test_fragments_are_deterministic_and_never_spell_the_answer():
    args = ("PHISHING PAYLOAD", "DGH-009", 5)
    assert fragments_for_phrase(*args) == fragments_for_phrase(*args)
    assert "".join(fragments_for_phrase(*args)) != "PHISHINGPAYLOAD"


def test_keys_match_ignores_case_and_spacing():
    assert keys_match("  phishing   payload ", "PHISHING PAYLOAD")
    assert keys_match("PHISHINGPAYLOAD", "PHISHING PAYLOAD")
    assert not keys_match("PAYLOAD PHISHING", "PHISHING PAYLOAD")


def test_phrase_bank_values_round_trip_through_the_key_helpers():
    phrase, _hint = phrase_for_round("DGH-009", 1)
    scrambled = scramble_key(phrase, team_code="DGH-009", round_number=1)

    assert sorted(scrambled.replace(" ", "")) == sorted(phrase.replace(" ", ""))
    assert keys_match(phrase.lower(), phrase)
