from clicky.engine import (
    Book,
    ClickyError,
    advise,
    click_buy,
    click_sell,
    reply,
    reset_book,
    wilder_rsi,
)
import pytest


def falling_closes():
    return [100 - i for i in range(20)]


def rising_closes():
    return [80 + i for i in range(20)]


def test_rsi_flags_a_washout():
    assert wilder_rsi(falling_closes()) < 20


def test_rsi_flags_a_stretch():
    assert wilder_rsi(rising_closes()) > 80


def test_advise_buy_when_oversold():
    take = advise("BTC", 90, -2.0, falling_closes())
    assert take["action"] == "buy"
    assert take["rsi"] < 30


def test_advise_sell_when_overbought():
    take = advise("ETH", 200, 1.0, rising_closes())
    assert take["action"] == "sell"


def test_advise_rejects_unknown_symbol():
    with pytest.raises(ClickyError):
        advise("XYZ", 1, 0, [])


def test_buy_spends_cash_and_opens_a_lot():
    book = Book()
    fill = click_buy(book, "BTC", 100, 50)
    assert fill.qty == 2
    assert book.cash == 9900
    assert book.lots["BTC"].avg_price == 50


def test_second_buy_averages_in():
    book = Book()
    click_buy(book, "BTC", 100, 50)
    click_buy(book, "BTC", 100, 150)
    assert book.lots["BTC"].qty == pytest.approx(2 + 100 / 150)
    assert book.lots["BTC"].avg_price == pytest.approx(200 / book.lots["BTC"].qty)


def test_buy_rejects_empty_wallet():
    book = Book(cash=5)
    with pytest.raises(ClickyError, match="cash"):
        click_buy(book, "BTC", 25, 100)


def test_sell_rejects_empty_bag():
    book = Book()
    with pytest.raises(ClickyError, match="No BTC"):
        click_sell(book, "BTC", 25, 100)


def test_sell_realizes_pnl_and_can_flatten():
    book = Book()
    click_buy(book, "SOL", 100, 10)
    fill = click_sell(book, "SOL", 200, 20)
    assert fill.realized_pnl == pytest.approx(100)
    assert "SOL" not in book.lots
    assert book.cash == pytest.approx(10100)


def test_sell_flattens_dust_left_by_a_price_tick():
    book = Book()
    click_buy(book, "BTC", 25, 100)
    fill = click_sell(book, "BTC", 25, 101)
    assert "BTC" not in book.lots
    assert fill.usd == pytest.approx(25.25)


def test_equity_marks_open_lots():
    book = Book()
    click_buy(book, "ETH", 1000, 100)
    assert book.equity({"ETH": 120}) == pytest.approx(10200)


def test_chat_refuses_to_place_orders():
    book = Book()
    take = advise("BTC", 100, 0, [100] * 20)
    text = reply("buy now please", book, [{"symbol": "BTC", "price": 100}], take)
    assert "BUY" in text
    assert book.cash == 10_000


def test_reset_restores_starting_cash():
    book = Book(cash=12)
    book = reset_book()
    assert book.cash == 10_000
    assert book.messages[-1].role == "clicky"
