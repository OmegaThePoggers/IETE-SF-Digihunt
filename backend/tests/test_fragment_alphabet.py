import random

from app.services.question_gen import FRAGMENT_ALPHABET, _fragment

AMBIGUOUS = set("O0I1")


def test_fragment_alphabet_excludes_lookalike_characters():
    assert AMBIGUOUS.isdisjoint(set(FRAGMENT_ALPHABET))


def test_generated_fragments_only_use_the_safe_alphabet():
    rng = random.Random(7)
    for _ in range(200):
        fragment = _fragment(rng)
        assert len(fragment) == 2
        assert set(fragment) <= set(FRAGMENT_ALPHABET)
