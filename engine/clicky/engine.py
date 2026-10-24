from __future__ import annotations

from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from typing import Any
from uuid import uuid4

STARTING_CASH = 10_000.0
MIN_CLICK_USD = 1.0
MAX_CLICK_USD = 5_000.0
RSI_PERIOD = 14
RSI_OVERSOLD = 30.0
RSI_OVERBOUGHT = 70.0

ASSETS: dict[str, dict[str, str]] = {
    "BTC": {"id": "bitcoin", "name": "Bitcoin"},
    "ETH": {"id": "ethereum", "name": "Ethereum"},
    "SOL": {"id": "solana", "name": "Solana"},
}


class ClickyError(ValueError):
    """User-facing validation error."""


def utc_now() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def new_id() -> str:
    return uuid4().hex[:12]


def wilder_rsi(closes: list[float], period: int = RSI_PERIOD) -> float | None:
    if len(closes) < period + 1:
        return None
    avg_gain = 0.0
    avg_loss = 0.0
    for i in range(1, period + 1):
        delta = closes[i] - closes[i - 1]
        avg_gain += max(delta, 0.0)
        avg_loss += max(-delta, 0.0)
    avg_gain /= period
    avg_loss /= period
    for i in range(period + 1, len(closes)):
        delta = closes[i] - closes[i - 1]
        avg_gain = (avg_gain * (period - 1) + max(delta, 0.0)) / period
        avg_loss = (avg_loss * (period - 1) + max(-delta, 0.0)) / period
    if avg_loss == 0:
        return 100.0
    rs = avg_gain / avg_loss
    return 100.0 - (100.0 / (1.0 + rs))


def _confidence(rsi_value: float | None, change_24h: float | None) -> int:
    if rsi_value is None:
        if change_24h is None:
            return 35
        return min(80, 40 + int(abs(change_24h) * 3))
    distance = abs(rsi_value - 50.0)
    return min(92, 40 + int(distance * 1.4))


def advise(
    symbol: str,
    price: float,
    change_24h: float | None,
    closes: list[float] | None = None,
) -> dict[str, Any]:
    symbol = symbol.upper()
    if symbol not in ASSETS:
        raise ClickyError(f"Unknown symbol {symbol}")
    rsi_value = wilder_rsi(closes or [])
    if rsi_value is not None and rsi_value < RSI_OVERSOLD:
        action = "buy"
        reason = f"RSI is {rsi_value:.0f} — washed out. I'd tap BUY small, not hero-size."
    elif rsi_value is not None and rsi_value > RSI_OVERBOUGHT:
        action = "sell"
        reason = f"RSI is {rsi_value:.0f} — stretched. I'd take chips off or sit on my hands."
    elif change_24h is not None and change_24h <= -4:
        action = "buy"
        reason = f"{symbol} is down {change_24h:.1f}% today. Dip, not a gift. Size small."
    elif change_24h is not None and change_24h >= 6:
        action = "sell"
        reason = f"{symbol} ripped {change_24h:.1f}% today. Don't chase the green candle."
    else:
        action = "hold"
        extra = f" RSI {rsi_value:.0f}." if rsi_value is not None else ""
        reason = f"{symbol} is mid-range.{extra} I'd wait for a cleaner tap."
    return {
        "symbol": symbol,
        "price": price,
        "change_24h": change_24h,
        "rsi": None if rsi_value is None else round(rsi_value, 1),
        "action": action,
        "confidence": _confidence(rsi_value, change_24h),
        "reason": reason,
    }


@dataclass
class Lot:
    qty: float
    avg_price: float


@dataclass
class Click:
    id: str
    ts: str
    side: str
    symbol: str
    usd: float
    price: float
    qty: float
    realized_pnl: float
    note: str


@dataclass
class Message:
    id: str
    ts: str
    role: str
    text: str


@dataclass
class Book:
    cash: float = STARTING_CASH
    lots: dict[str, Lot] = field(default_factory=dict)
    clicks: list[Click] = field(default_factory=list)
    messages: list[Message] = field(default_factory=list)

    def position_value(self, prices: dict[str, float]) -> float:
        total = 0.0
        for symbol, lot in self.lots.items():
            total += lot.qty * prices.get(symbol, lot.avg_price)
        return total

    def equity(self, prices: dict[str, float]) -> float:
        return self.cash + self.position_value(prices)

    def unrealized(self, prices: dict[str, float]) -> float:
        pnl = 0.0
        for symbol, lot in self.lots.items():
            pnl += lot.qty * (prices.get(symbol, lot.avg_price) - lot.avg_price)
        return pnl

    def realized(self) -> float:
        return sum(click.realized_pnl for click in self.clicks)

    def to_public(self, prices: dict[str, float]) -> dict[str, Any]:
        lots = []
        for symbol, lot in sorted(self.lots.items()):
            mark = prices.get(symbol, lot.avg_price)
            lots.append(
                {
                    "symbol": symbol,
                    "qty": lot.qty,
                    "avg_price": lot.avg_price,
                    "mark": mark,
                    "value": lot.qty * mark,
                    "pnl": lot.qty * (mark - lot.avg_price),
                }
            )
        return {
            "cash": self.cash,
            "equity": self.equity(prices),
            "unrealized": self.unrealized(prices),
            "realized": self.realized(),
            "lots": lots,
            "clicks": [asdict(click) for click in self.clicks[:40]],
            "messages": [asdict(message) for message in self.messages[-40:]],
        }

    def to_state(self) -> dict[str, Any]:
        return {
            "cash": self.cash,
            "lots": {symbol: asdict(lot) for symbol, lot in self.lots.items()},
            "clicks": [asdict(click) for click in self.clicks],
            "messages": [asdict(message) for message in self.messages],
        }

    @classmethod
    def from_state(cls, raw: dict[str, Any] | None) -> Book:
        if not raw:
            return cls()
        lots = {
            symbol: Lot(qty=float(lot["qty"]), avg_price=float(lot["avg_price"]))
            for symbol, lot in raw.get("lots", {}).items()
            if float(lot.get("qty", 0)) > 0
        }
        clicks = [Click(**item) for item in raw.get("clicks", [])]
        messages = [Message(**item) for item in raw.get("messages", [])]
        return cls(
            cash=float(raw.get("cash", STARTING_CASH)),
            lots=lots,
            clicks=clicks,
            messages=messages,
        )


def _validate_click(symbol: str, usd: float, price: float) -> tuple[str, float]:
    symbol = symbol.upper()
    if symbol not in ASSETS:
        raise ClickyError(f"Unknown symbol {symbol}")
    if price <= 0:
        raise ClickyError("Price is not ready yet")
    if usd < MIN_CLICK_USD:
        raise ClickyError(f"Minimum tap is ${MIN_CLICK_USD:.0f}")
    if usd > MAX_CLICK_USD:
        raise ClickyError(f"Maximum tap is ${MAX_CLICK_USD:.0f}")
    return symbol, float(usd)


def react_to_click(side: str, advice: dict[str, Any] | None, realized_pnl: float) -> str:
    action = (advice or {}).get("action")
    if side == "buy" and action == "buy":
        return "Aligned. That's the tap I wanted."
    if side == "sell" and action == "sell":
        return "Good take. Lock it and breathe."
    if side == "buy" and action == "sell":
        return "You're fading me. Fine — keep it small."
    if side == "sell" and action == "buy":
        return "Selling the dip. I wouldn't, but it's your book."
    if realized_pnl > 0:
        return f"Pocketed ${realized_pnl:.2f}. Clicky likes green."
    if realized_pnl < 0:
        return f"Cut ${abs(realized_pnl):.2f}. Alive beats stubborn."
    return "Logged. Paper only — no real money moved."


def click_buy(book: Book, symbol: str, usd: float, price: float, advice: dict[str, Any] | None = None) -> Click:
    symbol, usd = _validate_click(symbol, usd, price)
    if usd > book.cash + 1e-9:
        raise ClickyError(f"Only ${book.cash:.2f} cash left")
    qty = usd / price
    lot = book.lots.get(symbol)
    if lot:
        new_qty = lot.qty + qty
        lot.avg_price = (lot.qty * lot.avg_price + usd) / new_qty
        lot.qty = new_qty
    else:
        book.lots[symbol] = Lot(qty=qty, avg_price=price)
    book.cash -= usd
    fill = Click(
        id=new_id(),
        ts=utc_now(),
        side="buy",
        symbol=symbol,
        usd=usd,
        price=price,
        qty=qty,
        realized_pnl=0.0,
        note=react_to_click("buy", advice, 0.0),
    )
    book.clicks.insert(0, fill)
    return fill


def click_sell(book: Book, symbol: str, usd: float, price: float, advice: dict[str, Any] | None = None) -> Click:
    symbol, usd = _validate_click(symbol, usd, price)
    lot = book.lots.get(symbol)
    if not lot or lot.qty <= 0:
        raise ClickyError(f"No {symbol} to sell")
    qty = min(lot.qty, usd / price)
    remainder_value = (lot.qty - qty) * price
    if remainder_value < 0.50:
        qty = lot.qty
    usd = qty * price
    realized = qty * (price - lot.avg_price)
    lot.qty -= qty
    if lot.qty <= 1e-12:
        book.lots.pop(symbol, None)
    book.cash += usd
    fill = Click(
        id=new_id(),
        ts=utc_now(),
        side="sell",
        symbol=symbol,
        usd=usd,
        price=price,
        qty=qty,
        realized_pnl=realized,
        note=react_to_click("sell", advice, realized),
    )
    book.clicks.insert(0, fill)
    return fill


def add_message(book: Book, role: str, text: str) -> Message:
    message = Message(id=new_id(), ts=utc_now(), role=role, text=text)
    book.messages.append(message)
    if len(book.messages) > 80:
        book.messages = book.messages[-80:]
    return message


def reset_book() -> Book:
    book = Book()
    add_message(
        book,
        "clicky",
        "Fresh paper. $10,000, zero positions. Tap ASK when you want my take. Buy and sell only move this fake wallet.",
    )
    return book


def reply(message: str, book: Book, markets: list[dict[str, Any]], advice: dict[str, Any]) -> str:
    text = " ".join(message.strip().split())
    if not text:
        return "Tap a thought in. I'm right here."
    lower = text.lower()
    symbol = advice["symbol"]
    price = advice["price"]
    if any(word in lower for word in ("buy now", "sell now", "place", "execute", "order")):
        return "I don't fire trades from chat. Hit BUY or SELL — that's the click."
    if lower in {"hi", "hey", "hello", "yo", "sup"}:
        return f"Hey. {symbol} is ${price:,.2f}. {advice['reason']}"
    if "how" in lower and any(word in lower for word in ("work", "use", "this")):
        return (
            "Three pads. ASK gets my take. BUY and SELL move paper cash. "
            "Add this page to your home screen and it feels like a real phone app."
        )
    if any(word in lower for word in ("book", "wallet", "pnl", "position", "bag")):
        lots = book.lots
        if not lots:
            return f"Cash ${book.cash:,.2f}. No bags yet. {advice['reason']}"
        bits = [f"{sym} {lot.qty:.6f} @ ${lot.avg_price:,.2f}" for sym, lot in lots.items()]
        return f"Cash ${book.cash:,.2f}. " + " · ".join(bits)
    if "reset" in lower:
        return "If you want a clean slate, use Reset paper on the book screen."
    if "rsi" in lower or "signal" in lower or "advice" in lower or "should" in lower:
        return advice["reason"]
    if any(name.lower() in lower for name in ASSETS) or any(asset["name"].lower() in lower for asset in ASSETS.values()):
        return f"{symbol} ${price:,.2f}. {advice['reason']}"
    if "price" in lower or "market" in lower:
        quotes = [f"{item['symbol']} ${item['price']:,.2f}" for item in markets]
        return " · ".join(quotes) + f". On {symbol}: {advice['reason']}"
    return advice["reason"]
