# Backtesting guide

`runBacktest` applies commission, spread, and slippage in basis points. Fill policy is `next_open` or `close`.

Metrics: total/annualized return, volatility, Sharpe, Sortino, Calmar, max drawdown, win/loss, profit factor, expectancy, exposure, turnover, equity curve.

Anti-overfit:

- train/test split
- walk-forward windows
- Monte Carlo shuffle of trade P/L
- minimum sample-size warning
- parameter sensitivity helper

Results are labeled `resultKind: backtest`. They are not paper or live results.
