from __future__ import annotations

import pandas as pd


def wilder_rsi(close: pd.Series, period: int = 14) -> pd.Series:
    delta = close.diff()
    gain = delta.clip(lower=0.0)
    loss = -delta.clip(upper=0.0)
    avg_gain = gain.ewm(alpha=1 / period, min_periods=period, adjust=False).mean()
    avg_loss = loss.ewm(alpha=1 / period, min_periods=period, adjust=False).mean()
    rsi = 100 - (100 / (1 + avg_gain / avg_loss.replace(0, pd.NA)))
    rsi = rsi.mask((avg_loss == 0) & (avg_gain > 0), 100.0)
    rsi = rsi.mask((avg_gain == 0) & (avg_loss == 0), 50.0)
    return rsi.astype(float)


def add_indicators(df: pd.DataFrame) -> pd.DataFrame:
    out = df.copy()
    close = out["close"].astype(float)
    high = out["high"].astype(float)
    low = out["low"].astype(float)
    volume = out["volume"].astype(float)

    for period in {7, 14, 21}:
        out[f"rsi_{period}"] = wilder_rsi(close, period)

    for period in {9, 20, 21, 50, 100, 200}:
        out[f"sma_{period}"] = close.rolling(period).mean()
        out[f"ema_{period}"] = close.ewm(span=period, adjust=False).mean()

    ema12 = close.ewm(span=12, adjust=False).mean()
    ema26 = close.ewm(span=26, adjust=False).mean()
    macd_line = ema12 - ema26
    macd_signal = macd_line.ewm(span=9, adjust=False).mean()
    out["macd_line"] = macd_line
    out["macd_signal"] = macd_signal
    out["macd_hist"] = macd_line - macd_signal

    bb_mid = close.rolling(20).mean()
    bb_std = close.rolling(20).std()
    out["bb_mid"] = bb_mid
    out["bb_upper"] = bb_mid + 2 * bb_std
    out["bb_lower"] = bb_mid - 2 * bb_std

    prev_close = close.shift(1)
    tr = pd.concat(
        [(high - low).abs(), (high - prev_close).abs(), (low - prev_close).abs()],
        axis=1,
    ).max(axis=1)
    out["atr_14"] = tr.rolling(14).mean()
    out["volume_sma_20"] = volume.rolling(20).mean()
    return out


def series_for(df: pd.DataFrame, name: str, period: int | None = None) -> pd.Series:
    if name in {"close", "open", "high", "low", "volume"}:
        return df[name].astype(float)
    if name == "rsi":
        col = f"rsi_{period or 14}"
        if col not in df:
            df[col] = wilder_rsi(df["close"].astype(float), period or 14)
        return df[col]
    if name in {"sma", "ema"}:
        col = f"{name}_{period or 20}"
        if col not in df:
            close = df["close"].astype(float)
            p = period or 20
            df[col] = close.rolling(p).mean() if name == "sma" else close.ewm(span=p, adjust=False).mean()
        return df[col]
    if name in {"macd_line", "macd_signal", "macd_hist", "bb_upper", "bb_mid", "bb_lower"}:
        if name not in df.columns:
            df = add_indicators(df)
        return df[name]
    if name == "atr":
        col = f"atr_{period or 14}"
        if col not in df:
            df = add_indicators(df)
            return df["atr_14"] if col not in df.columns else df[col]
        return df[col]
    if name == "volume_sma":
        col = f"volume_sma_{period or 20}"
        if col not in df:
            df[col] = df["volume"].astype(float).rolling(period or 20).mean()
        return df[col]
    raise KeyError(f"Unknown indicator {name}")
