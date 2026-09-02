from app.services.round_gate import ROUND_COUNT, requires_gate


def test_round_one_is_always_open_and_later_rounds_need_a_gate():
    assert not requires_gate(1)
    assert requires_gate(2)
    assert requires_gate(3)
    assert requires_gate(4)
    assert ROUND_COUNT == 4
