import random

from app.services.question_gen import GENERATORS, ROUND3_BLUEPRINT


def test_round3_blueprint_covers_stage3_categories():
    categories = [c for c, _ in ROUND3_BLUEPRINT]
    assert categories == [
        "access_control",
        "secure_coding",
        "monitoring",
        "incident_response",
        "crypto_hygiene",
    ]
    assert sum(count for _, count in ROUND3_BLUEPRINT) == 6


def test_every_round3_category_has_a_generator_producing_four_options():
    for category, _ in ROUND3_BLUEPRINT:
        data = GENERATORS[category](random.Random(7))
        assert len(data["options"]) == 4
        assert data["correct_answer"] in data["options"]
        assert data["code_fragment"]
