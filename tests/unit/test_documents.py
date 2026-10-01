from tradingbot.documents import extract_document


def test_plain_text_extract():
    extracted = extract_document(filename="style.txt", data=b"I trade bitcoin on the hourly chart. Buy when RSI is below 30.")
    assert "bitcoin" in extracted.text.lower()


def test_pasted_text():
    extracted = extract_document(text="  hello trading style with enough characters to pass the floor  ")
    assert extracted.text.startswith("hello")
