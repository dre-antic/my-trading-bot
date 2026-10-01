from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field


Operator = Literal["<", "<=", ">", ">=", "==", "crosses_above", "crosses_below"]
Logic = Literal["all", "any"]
Side = Literal["buy", "sell"]
IndicatorName = Literal[
    "close",
    "open",
    "high",
    "low",
    "volume",
    "rsi",
    "sma",
    "ema",
    "macd_line",
    "macd_signal",
    "macd_hist",
    "bb_upper",
    "bb_mid",
    "bb_lower",
    "atr",
    "volume_sma",
]


class Condition(BaseModel):
    id: str
    indicator: IndicatorName
    operator: Operator
    description: str
    period: int | None = None
    fast_period: int | None = None
    slow_period: int | None = None
    signal_period: int | None = None
    std_dev: float | None = None
    value: float | None = None
    compare_indicator: IndicatorName | None = None
    compare_period: int | None = None


class RuleGroup(BaseModel):
    logic: Logic = "all"
    conditions: list[Condition] = Field(default_factory=list)


class RiskSettings(BaseModel):
    quote_amount: float = 10.0
    max_open_positions: int = 1
    stop_loss_pct: float | None = None
    take_profit_pct: float | None = None
    stop_loss_atr: float | None = None
    risk_reward: float | None = None


class StrategyCriteria(BaseModel):
    name: str
    summary: str
    symbols: list[str] = Field(default_factory=lambda: ["BTC/USDT"])
    timeframe: str = "1h"
    direction: Literal["long"] = "long"
    entry: RuleGroup = Field(default_factory=RuleGroup)
    exit: RuleGroup = Field(default_factory=RuleGroup)
    risk: RiskSettings = Field(default_factory=RiskSettings)
    uncompiled: list[str] = Field(default_factory=list)
    source_excerpts: list[str] = Field(default_factory=list)
    confidence: float = 0.0

    def english_rules(self) -> list[str]:
        lines: list[str] = []
        symbols = ", ".join(self.symbols)
        lines.append(f"Watch {symbols} on the {self.timeframe} chart.")
        if self.entry.conditions:
            join = " AND " if self.entry.logic == "all" else " OR "
            lines.append("Enter a long when " + join.join(c.description for c in self.entry.conditions) + ".")
        if self.exit.conditions:
            join = " AND " if self.exit.logic == "all" else " OR "
            lines.append("Exit when " + join.join(c.description for c in self.exit.conditions) + ".")
        risk = self.risk
        money = [f"size each paper trade at {risk.quote_amount:g} USDT"]
        if risk.stop_loss_pct is not None:
            money.append(f"stop loss {risk.stop_loss_pct:g}%")
        if risk.take_profit_pct is not None:
            money.append(f"take profit {risk.take_profit_pct:g}%")
        if risk.stop_loss_atr is not None:
            money.append(f"stop loss {risk.stop_loss_atr:g} ATR")
        if risk.max_open_positions:
            money.append(f"max {risk.max_open_positions} open position(s)")
        lines.append("Risk: " + "; ".join(money) + ".")
        return lines


class ConditionResult(BaseModel):
    id: str
    description: str
    passed: bool
    left_value: float | None = None
    right_value: float | None = None
    detail: str = ""


class Evaluation(BaseModel):
    symbol: str
    timeframe: str
    price: float
    entry_ready: bool
    exit_ready: bool
    entry_results: list[ConditionResult] = Field(default_factory=list)
    exit_results: list[ConditionResult] = Field(default_factory=list)
    stop_hit: bool = False
    take_profit_hit: bool = False
    reasons: list[str] = Field(default_factory=list)


class TradeRecord(BaseModel):
    id: str
    strategy_id: str
    symbol: str
    side: Side
    amount: float
    price: float
    quote_amount: float
    reason: list[str] = Field(default_factory=list)
    paper: bool = True
    created_at: str
    pnl: float | None = None
