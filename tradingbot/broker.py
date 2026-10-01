from __future__ import annotations

from uuid import uuid4

from tradingbot.market import utc_now
from tradingbot.schema import TradeRecord


class PaperBroker:
    def __init__(self, starting_cash: float = 10_000.0) -> None:
        self.cash = starting_cash
        self.positions: dict[str, dict] = {}
        self.trades: list[TradeRecord] = []

    def has_position(self, symbol: str) -> bool:
        return symbol in self.positions

    def position(self, symbol: str) -> dict | None:
        return self.positions.get(symbol)

    def buy(
        self,
        *,
        strategy_id: str,
        symbol: str,
        price: float,
        quote_amount: float,
        reason: list[str],
        tape: str = "live",
    ) -> TradeRecord:
        if quote_amount > self.cash:
            quote_amount = self.cash
        if quote_amount <= 0:
            raise ValueError("Not enough paper cash to open a trade.")
        amount = quote_amount / price
        self.cash -= quote_amount
        self.positions[symbol] = {
            "symbol": symbol,
            "side": "buy",
            "amount": amount,
            "entry_price": price,
            "quote_amount": quote_amount,
            "strategy_id": strategy_id,
            "opened_at": utc_now(),
            "tape": tape,
        }
        trade = TradeRecord(
            id=uuid4().hex[:12],
            strategy_id=strategy_id,
            symbol=symbol,
            side="buy",
            amount=amount,
            price=price,
            quote_amount=quote_amount,
            reason=reason,
            paper=True,
            created_at=utc_now(),
        )
        self.trades.append(trade)
        return trade

    def sell(
        self,
        *,
        strategy_id: str,
        symbol: str,
        price: float,
        reason: list[str],
    ) -> TradeRecord:
        pos = self.positions.get(symbol)
        if not pos:
            raise ValueError(f"No open paper position for {symbol}.")
        amount = float(pos["amount"])
        quote = amount * price
        pnl = quote - float(pos["quote_amount"])
        self.cash += quote
        del self.positions[symbol]
        trade = TradeRecord(
            id=uuid4().hex[:12],
            strategy_id=strategy_id,
            symbol=symbol,
            side="sell",
            amount=amount,
            price=price,
            quote_amount=quote,
            reason=reason,
            paper=True,
            created_at=utc_now(),
            pnl=pnl,
        )
        self.trades.append(trade)
        return trade

    def snapshot(self) -> dict:
        return {
            "cash": round(self.cash, 4),
            "positions": list(self.positions.values()),
            "trade_count": len(self.trades),
        }
