# Strategy DSL

JSON AST evaluated deterministically.

```
IF / AND / OR / NOT / THEN (THEN is the action side: entry, exit, stop, target)
```

Nodes:

- `{ op: "and"|"or", args: RuleExpr[] }`
- `{ op: "not", arg: RuleExpr }`
- `{ op: "cmp", left, cmp, right }`
- `{ op: "crosses_above"|"crosses_below", left, right }`

References: indicators (`sma`, `ema`, `rsi`, `macd`, `atr`, Bollinger, `vwap`, `adx`, stochastic, support/resistance), OHLC, volume, account fields, literals.

The evaluator returns `passed`, `missing`, and a reason string. Missing data is **not** treated as a match. Unclear natural language becomes `NEEDS_CLARIFICATION`.
