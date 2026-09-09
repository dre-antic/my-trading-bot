from aivideostudio.safety import check_prompt


def test_normal_prompt_allowed():
    r = check_prompt("Create a 60-second educational video explaining why the sky appears blue.")
    assert r["allowed"] is True


def test_voice_clone_blocked():
    r = check_prompt("Clone the voice of a famous actor without permission")
    assert r["allowed"] is False
