from __future__ import annotations

from typing import Any

from tradingbot.broker import PaperBroker
from tradingbot.evaluator import evaluate_strategy
from tradingbot.schema import Evaluation, StrategyCriteria, TradeRecord


class ScanOutcome:
    def __init__(
        self,
        evaluation: Evaluation,
        trade: TradeRecord | None,
        action: str,
        message: str,
    ) -> None:
        self.evaluation = evaluation
        self.trade = trade
        self.action = action
        self.message = message

    def as_dict(self) -> dict[str, Any]:
        return {
            "action": self.action,
            "message": self.message,
            "evaluation": self.evaluation.model_dump(),
            "trade": self.trade.model_dump() if self.trade else None,
        }


def run_scan(
    *,
    strategy_id: str,
    criteria: StrategyCriteria,
    candles: list[dict[str, Any]],
    broker: PaperBroker,
) -> ScanOutcome:
    symbol = criteria.symbols[0]
    position = broker.position(symbol)
    evaluation = evaluate_strategy(criteria, candles, position=position)

    if evaluation.entry_ready:
        if len(broker.positions) >= criteria.risk.max_open_positions:
            return ScanOutcome(
                evaluation,
                None,
                "blocked",
                "Entry criteria passed, but the max open-position limit is already filled.",
            )
        trade = broker.buy(
            strategy_id=strategy_id,
            symbol=symbol,
            price=evaluation.price,
            quote_amount=criteria.risk.quote_amount,
            reason=evaluation.reasons or [item.description for item in evaluation.entry_results if item.passed],
        )
        return ScanOutcome(
            evaluation,
            trade,
            "buy",
            f"Paper BUY {symbol} at {evaluation.price:.4g} because the compiled entry criteria passed.",
        )

    if evaluation.exit_ready and position:
        trade = broker.sell(
            strategy_id=strategy_id,
            symbol=symbol,
            price=evaluation.price,
            reason=evaluation.reasons or [item.description for item in evaluation.exit_results if item.passed],
        )
        pnl = trade.pnl or 0.0
        return ScanOutcome(
            evaluation,
            trade,
            "sell",
            f"Paper SELL {symbol} at {evaluation.price:.4g} (P&L {pnl:+.4g} USDT).",
        )

    return ScanOutcome(
        evaluation,
        None,
        "wait",
        "Criteria checked. No trade — waiting for the next valid setup.",
    )
