from __future__ import annotations

from typing import Any

import pandas as pd

from tradingbot.indicators import add_indicators, series_for
from tradingbot.schema import Condition, ConditionResult, Evaluation, StrategyCriteria


def _last_two(series: pd.Series) -> tuple[float | None, float | None]:
    clean = series.dropna()
    if clean.empty:
        return None, None
    current = float(clean.iloc[-1])
    prev = float(clean.iloc[-2]) if len(clean) > 1 else None
    return prev, current


def evaluate_condition(df: pd.DataFrame, condition: Condition) -> ConditionResult:
    left = series_for(df, condition.indicator, condition.period)
    prev_left, cur_left = _last_two(left)

    if condition.value is not None:
        prev_right, cur_right = condition.value, condition.value
    elif condition.compare_indicator:
        right = series_for(
            df,
            condition.compare_indicator,
            condition.compare_period or condition.period,
        )
        prev_right, cur_right = _last_two(right)
    else:
        return ConditionResult(
            id=condition.id,
            description=condition.description,
            passed=False,
            detail="Condition is missing a comparison value.",
        )

    passed = False
    op = condition.operator
    if cur_left is None or cur_right is None:
        passed = False
    elif op == "<":
        passed = cur_left < cur_right
    elif op == "<=":
        passed = cur_left <= cur_right
    elif op == ">":
        passed = cur_left > cur_right
    elif op == ">=":
        passed = cur_left >= cur_right
    elif op == "==":
        passed = abs(cur_left - cur_right) < 1e-9
    elif op == "crosses_above":
        passed = prev_left is not None and prev_right is not None and prev_left <= prev_right and cur_left > cur_right
    elif op == "crosses_below":
        passed = prev_left is not None and prev_right is not None and prev_left >= prev_right and cur_left < cur_right

    left_txt = "n/a" if cur_left is None else f"{cur_left:.4g}"
    right_txt = "n/a" if cur_right is None else f"{cur_right:.4g}"
    return ConditionResult(
        id=condition.id,
        description=condition.description,
        passed=bool(passed),
        left_value=cur_left,
        right_value=cur_right,
        detail=f"{left_txt} {op.replace('_', ' ')} {right_txt}",
    )


def _group_passed(results: list[ConditionResult], logic: str) -> bool:
    if not results:
        return False
    if logic == "any":
        return any(item.passed for item in results)
    return all(item.passed for item in results)


def evaluate_strategy(
    criteria: StrategyCriteria,
    candles: list[dict[str, Any]],
    *,
    position: dict[str, Any] | None = None,
) -> Evaluation:
    df = pd.DataFrame(candles)
    if df.empty:
        raise ValueError("No market candles were returned.")
    df = add_indicators(df)
    price = float(df["close"].iloc[-1])
    symbol = criteria.symbols[0]

    entry_results = [evaluate_condition(df, cond) for cond in criteria.entry.conditions]
    exit_results = [evaluate_condition(df, cond) for cond in criteria.exit.conditions]
    entry_ready = _group_passed(entry_results, criteria.entry.logic)
    exit_ready = _group_passed(exit_results, criteria.exit.logic)

    stop_hit = False
    take_profit_hit = False
    reasons: list[str] = []
    if position:
        entry_price = float(position["entry_price"])
        sl = criteria.risk.stop_loss_pct
        tp = criteria.risk.take_profit_pct
        if sl is not None and price <= entry_price * (1 - sl / 100):
            stop_hit = True
            reasons.append(f"Stop loss {sl:g}% hit ({price:.4g} vs entry {entry_price:.4g})")
        if tp is not None and price >= entry_price * (1 + tp / 100):
            take_profit_hit = True
            reasons.append(f"Take profit {tp:g}% hit ({price:.4g} vs entry {entry_price:.4g})")
        if criteria.risk.stop_loss_atr:
            atr = float(df["atr_14"].dropna().iloc[-1]) if df["atr_14"].dropna().shape[0] else None
            if atr is not None and price <= entry_price - criteria.risk.stop_loss_atr * atr:
                stop_hit = True
                reasons.append(f"ATR stop hit ({criteria.risk.stop_loss_atr:g} × ATR {atr:.4g})")

    if entry_ready and not position:
        reasons.extend(item.detail for item in entry_results if item.passed)
    if (exit_ready or stop_hit or take_profit_hit) and position:
        reasons.extend(item.detail for item in exit_results if item.passed)

    return Evaluation(
        symbol=symbol,
        timeframe=criteria.timeframe,
        price=price,
        entry_ready=entry_ready and not position,
        exit_ready=(exit_ready or stop_hit or take_profit_hit) and bool(position),
        entry_results=entry_results,
        exit_results=exit_results,
        stop_hit=stop_hit,
        take_profit_hit=take_profit_hit,
        reasons=reasons,
    )
