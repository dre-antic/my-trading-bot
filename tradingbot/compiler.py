from __future__ import annotations

import re
from pathlib import Path
from uuid import uuid4

from tradingbot.schema import Condition, RiskSettings, RuleGroup, StrategyCriteria

SYMBOL_ALIASES = {
    "bitcoin": "BTC/USDT",
    "btc": "BTC/USDT",
    "btcusdt": "BTC/USDT",
    "ethereum": "ETH/USDT",
    "ether": "ETH/USDT",
    "eth": "ETH/USDT",
    "ethusdt": "ETH/USDT",
    "solana": "SOL/USDT",
    "sol": "SOL/USDT",
    "solusdt": "SOL/USDT",
    "xrp": "XRP/USDT",
    "dogecoin": "DOGE/USDT",
    "doge": "DOGE/USDT",
    "cardano": "ADA/USDT",
    "ada": "ADA/USDT",
    "bnb": "BNB/USDT",
}

TIMEFRAME_PATTERNS: list[tuple[str, str]] = [
    (r"\b1[\s-]*min(?:ute)?s?\b", "1m"),
    (r"\b5[\s-]*min(?:ute)?s?\b", "5m"),
    (r"\b15[\s-]*min(?:ute)?s?\b", "15m"),
    (r"\b30[\s-]*min(?:ute)?s?\b", "30m"),
    (r"\b4[\s-]*h(?:our)?s?\b", "4h"),
    (r"\bh4\b", "4h"),
    (r"\b1[\s-]*h(?:our)?s?\b", "1h"),
    (r"\bhourly\b", "1h"),
    (r"\b60[\s-]*min(?:ute)?s?\b", "1h"),
    (r"\bdaily\b", "1d"),
    (r"\b1[\s-]*d(?:ay)?s?\b", "1d"),
    (r"\bday(?:time)? chart\b", "1d"),
    (r"\bweekly\b", "1w"),
    (r"\b1[\s-]*w(?:eek)?s?\b", "1w"),
]

ENTRY_HINTS = re.compile(
    r"\b(buy|long|enter|entry|entries|open a position|when to buy|setup)\b",
    re.I,
)
EXIT_HINTS = re.compile(
    r"\b(sell|exit|exits|close the position|take profit|when to sell|stop)\b",
    re.I,
)
SHORT_HINTS = re.compile(r"\b(short|sell short|go short)\b", re.I)

SECTION_ENTRY = re.compile(r"^(entry|entries|buy rules|longs?|when to (buy|enter)|setups?)\b", re.I)
SECTION_EXIT = re.compile(r"^(exit|exits|sell rules|when to (sell|exit)|targets?)\b", re.I)
SECTION_RISK = re.compile(r"^(risk|money management|position sizing|risk management)\b", re.I)
SECTION_MARKET = re.compile(r"^(market|markets|instrument|instruments|pairs?|symbols?|universe)\b", re.I)


def _cid() -> str:
    return "c_" + uuid4().hex[:8]


def _clean(text: str) -> str:
    text = text.replace("\r\n", "\n").replace("\r", "\n")
    text = text.replace("“", '"').replace("”", '"').replace("’", "'")
    text = re.sub(r"[ \t]+", " ", text)
    return text.strip()


def _sentences(text: str) -> list[str]:
    parts: list[str] = []
    for raw_line in text.split("\n"):
        line = raw_line.strip().lstrip("•*-–—").strip()
        line = re.sub(r"^\d+[.)]\s+", "", line)
        if not line or set(line) <= set("-_=*#"):
            continue
        for piece in re.split(r"(?<=[.!?])\s+|\s*;\s+|\s+\band then\b\s+", line, flags=re.I):
            piece = piece.strip(" .")
            if piece:
                parts.append(piece)
    return parts


def _split_and(sentence: str) -> list[str]:
    if " and " not in sentence.lower():
        return [sentence]
    bits = re.split(r"\s+\band\b\s+", sentence, flags=re.I)
    if len(bits) == 1:
        return [sentence]
    # Keep splits that still look like conditions; otherwise keep original.
    useful = []
    for bit in bits:
        if _looks_like_condition(bit) or len(bits) == 2:
            useful.append(bit)
    return useful or [sentence]


def _looks_like_condition(text: str) -> bool:
    return bool(
        re.search(
            r"\b(rsi|ema|sma|macd|bollinger|atr|volume|price|close|overbought|oversold|cross)\b",
            text,
            re.I,
        )
    )


def extract_name(text: str, filename: str | None = None) -> str:
    for line in text.split("\n"):
        line = line.strip()
        heading = re.match(r"^#{1,3}\s+(.+)$", line)
        if heading:
            return heading.group(1).strip()
        labeled = re.match(r"^(?:strategy(?: name)?|name|title|style)\s*[:\-]\s*(.+)$", line, re.I)
        if labeled:
            return labeled.group(1).strip()
    if filename:
        stem = Path(filename).stem.replace("_", " ").replace("-", " ").strip()
        if stem:
            return stem.title()
    return "Uploaded trading style"


def extract_symbols(text: str) -> list[str]:
    found: list[str] = []
    seen: set[str] = set()

    def add(symbol: str) -> None:
        symbol = symbol.upper().replace(" ", "")
        if "/" not in symbol:
            if symbol.endswith("USDT"):
                symbol = symbol[:-4] + "/USDT"
            else:
                symbol = symbol + "/USDT"
        if symbol not in seen:
            seen.add(symbol)
            found.append(symbol)

    for match in re.finditer(r"\b([A-Za-z]{2,5})\s*/\s*(USDT|USD|BTC|ETH)\b", text, re.I):
        add(f"{match.group(1)}/{match.group(2)}")
    for match in re.finditer(r"\b([A-Z]{2,5})USDT\b", text):
        add(match.group(1) + "/USDT")
    lower = text.lower()
    # Longer aliases first so "bitcoin" wins over stray "btc" inside other words — aliases are whole words.
    for alias, symbol in sorted(SYMBOL_ALIASES.items(), key=lambda kv: len(kv[0]), reverse=True):
        if re.search(rf"\b{re.escape(alias)}\b", lower):
            add(symbol)
    return found or ["BTC/USDT"]


def extract_timeframe(text: str) -> str:
    lower = text.lower()
    for pattern, tf in TIMEFRAME_PATTERNS:
        if re.search(pattern, lower):
            return tf
    match = re.search(r"\b(\d+)\s*m\b", lower)
    if match and match.group(1) in {"1", "3", "5", "15", "30"}:
        return f"{match.group(1)}m"
    return "1h"


def _ma_name(raw: str | None) -> str:
    token = (raw or "ema").lower()
    if token in {"sma", "simple"}:
        return "sma"
    return "ema"


def parse_rsi(text: str) -> Condition | None:
    period_first = re.search(
        r"(?:rsi\s*(?:\(|\s*)?(?P<p1>\d{1,3})?(?:\))?|(?P<p2>\d{1,3})\s*[-\s]?period\s+rsi)",
        text,
        re.I,
    )
    period = None
    if period_first:
        period = int(period_first.group("p1") or period_first.group("p2") or 14)
    cmp_below = re.search(
        r"rsi[^\n]{0,40}?(?:below|under|less than|<(?!=)|drops? below|falls? below)\s*(?P<v>\d{1,3}(?:\.\d+)?)",
        text,
        re.I,
    )
    cmp_above = re.search(
        r"rsi[^\n]{0,40}?(?:above|over|greater than|>(?!=)|rises? above|goes? above)\s*(?P<v>\d{1,3}(?:\.\d+)?)",
        text,
        re.I,
    )
    if cmp_below:
        value = float(cmp_below.group("v"))
        p = period or 14
        return Condition(
            id=_cid(),
            indicator="rsi",
            period=p,
            operator="<",
            value=value,
            description=f"RSI({p}) is below {value:g}",
        )
    if cmp_above:
        value = float(cmp_above.group("v"))
        p = period or 14
        return Condition(
            id=_cid(),
            indicator="rsi",
            period=p,
            operator=">",
            value=value,
            description=f"RSI({p}) is above {value:g}",
        )
    if re.search(r"\boversold\b", text, re.I):
        p = period or 14
        return Condition(
            id=_cid(),
            indicator="rsi",
            period=p,
            operator="<",
            value=30.0,
            description=f"RSI({p}) is oversold (below 30)",
        )
    if re.search(r"\boverbought\b", text, re.I):
        p = period or 14
        return Condition(
            id=_cid(),
            indicator="rsi",
            period=p,
            operator=">",
            value=70.0,
            description=f"RSI({p}) is overbought (above 70)",
        )
    return None


def parse_ma(text: str) -> Condition | None:
    golden = re.search(r"\bgolden\s+cross\b", text, re.I)
    if golden:
        return Condition(
            id=_cid(),
            indicator="sma",
            period=50,
            operator="crosses_above",
            compare_indicator="sma",
            compare_period=200,
            description="50 SMA crosses above 200 SMA (golden cross)",
        )
    death = re.search(r"\bdeath\s+cross\b", text, re.I)
    if death:
        return Condition(
            id=_cid(),
            indicator="sma",
            period=50,
            operator="crosses_below",
            compare_indicator="sma",
            compare_period=200,
            description="50 SMA crosses below 200 SMA (death cross)",
        )

    ma_cross = re.search(
        r"(?P<p1>\d{1,3})\s*(?P<t1>ema|sma|ma)\s+crosses\s+(?P<dir>above|below)\s+(?:the\s+)?(?P<p2>\d{1,3})\s*(?P<t2>ema|sma|ma)",
        text,
        re.I,
    )
    if ma_cross:
        left = _ma_name(ma_cross.group("t1"))
        right = _ma_name(ma_cross.group("t2"))
        op = "crosses_above" if ma_cross.group("dir").lower() == "above" else "crosses_below"
        p1 = int(ma_cross.group("p1"))
        p2 = int(ma_cross.group("p2"))
        return Condition(
            id=_cid(),
            indicator=left,  # type: ignore[arg-type]
            period=p1,
            operator=op,  # type: ignore[arg-type]
            compare_indicator=right,  # type: ignore[arg-type]
            compare_period=p2,
            description=f"{p1} {left.upper()} {op.replace('_', ' ')} {p2} {right.upper()}",
        )

    price_cross = re.search(
        r"(?:price|close|it)?\s*crosses\s+(?P<dir>above|below)\s+(?:the\s+)?(?P<p>\d{1,3})\s*(?:period\s+)?(?P<t>ema|sma|ma)\b",
        text,
        re.I,
    )
    if price_cross:
        ma = _ma_name(price_cross.group("t"))
        period = int(price_cross.group("p"))
        op = "crosses_above" if price_cross.group("dir").lower() == "above" else "crosses_below"
        return Condition(
            id=_cid(),
            indicator="close",
            operator=op,  # type: ignore[arg-type]
            compare_indicator=ma,  # type: ignore[arg-type]
            compare_period=period,
            description=f"price {op.replace('_', ' ')} the {period} {ma.upper()}",
        )

    above = re.search(
        r"(?:price|close|the close)?\s*(?:is\s+|closes?\s+)?(?:above|over|>)\s*(?:the\s+)?(?P<p>\d{1,3})\s*(?:period\s+)?(?P<t>ema|sma|ma)\b",
        text,
        re.I,
    )
    below = re.search(
        r"(?:price|close|the close)?\s*(?:is\s+|closes?\s+)?(?:below|under|<)\s*(?:the\s+)?(?P<p>\d{1,3})\s*(?:period\s+)?(?P<t>ema|sma|ma)\b",
        text,
        re.I,
    )
    if above:
        ma = _ma_name(above.group("t"))
        period = int(above.group("p"))
        return Condition(
            id=_cid(),
            indicator="close",
            operator=">",
            compare_indicator=ma,  # type: ignore[arg-type]
            compare_period=period,
            description=f"price is above the {period} {ma.upper()}",
        )
    if below:
        ma = _ma_name(below.group("t"))
        period = int(below.group("p"))
        return Condition(
            id=_cid(),
            indicator="close",
            operator="<",
            compare_indicator=ma,  # type: ignore[arg-type]
            compare_period=period,
            description=f"price is below the {period} {ma.upper()}",
        )
    return None


def parse_macd(text: str) -> Condition | None:
    if not re.search(r"\bmacd\b", text, re.I):
        return None
    if re.search(r"crosses\s+above", text, re.I):
        return Condition(
            id=_cid(),
            indicator="macd_line",
            fast_period=12,
            slow_period=26,
            signal_period=9,
            operator="crosses_above",
            compare_indicator="macd_signal",
            description="MACD line crosses above the signal line",
        )
    if re.search(r"crosses\s+below", text, re.I):
        return Condition(
            id=_cid(),
            indicator="macd_line",
            fast_period=12,
            slow_period=26,
            signal_period=9,
            operator="crosses_below",
            compare_indicator="macd_signal",
            description="MACD line crosses below the signal line",
        )
    if re.search(r"histogram.{0,20}(positive|above zero|>\s*0)", text, re.I) or re.search(
        r"turns?\s+positive", text, re.I
    ):
        return Condition(
            id=_cid(),
            indicator="macd_hist",
            fast_period=12,
            slow_period=26,
            signal_period=9,
            operator=">",
            value=0.0,
            description="MACD histogram is positive",
        )
    if re.search(r"histogram.{0,20}(negative|below zero|<\s*0)", text, re.I) or re.search(
        r"turns?\s+negative", text, re.I
    ):
        return Condition(
            id=_cid(),
            indicator="macd_hist",
            fast_period=12,
            slow_period=26,
            signal_period=9,
            operator="<",
            value=0.0,
            description="MACD histogram is negative",
        )
    return None


def parse_bollinger(text: str) -> Condition | None:
    if not re.search(r"\bbollinger\b", text, re.I):
        return None
    if re.search(r"lower", text, re.I):
        op: str = "<=" if re.search(r"touch|at|hit", text, re.I) else "<"
        return Condition(
            id=_cid(),
            indicator="close",
            operator=op,  # type: ignore[arg-type]
            compare_indicator="bb_lower",
            period=20,
            std_dev=2.0,
            description="price is at or below the lower Bollinger Band",
        )
    if re.search(r"upper", text, re.I):
        op = ">=" if re.search(r"touch|at|hit", text, re.I) else ">"
        return Condition(
            id=_cid(),
            indicator="close",
            operator=op,  # type: ignore[arg-type]
            compare_indicator="bb_upper",
            period=20,
            std_dev=2.0,
            description="price is at or above the upper Bollinger Band",
        )
    return None


def parse_volume(text: str) -> Condition | None:
    if re.search(r"volume\s+(spike|surges?|expand)", text, re.I) or re.search(
        r"volume\s+(is\s+)?(above|greater than|>)\s*(its\s+|the\s+)?(average|sma|20)",
        text,
        re.I,
    ):
        return Condition(
            id=_cid(),
            indicator="volume",
            operator=">",
            compare_indicator="volume_sma",
            compare_period=20,
            description="volume is above its 20-period average",
        )
    return None


def parse_conditions(text: str) -> list[Condition]:
    found: list[Condition] = []
    parsers = (parse_rsi, parse_macd, parse_bollinger, parse_ma, parse_volume)
    for clause in _split_and(text):
        for parser in parsers:
            cond = parser(clause)
            if cond:
                found.append(cond)
                break
    # Deduplicate by description
    unique: list[Condition] = []
    seen: set[str] = set()
    for cond in found:
        if cond.description not in seen:
            seen.add(cond.description)
            unique.append(cond)
    return unique


def parse_risk(text: str) -> RiskSettings:
    risk = RiskSettings()
    sl = re.search(
        r"(?:stop[\s-]?loss|sl)(?:\s+(?:of|at|:))?\s*(\d+(?:\.\d+)?)\s*%",
        text,
        re.I,
    ) or re.search(r"(\d+(?:\.\d+)?)\s*%\s*stop", text, re.I)
    if sl:
        risk.stop_loss_pct = float(sl.group(1))
    tp = re.search(
        r"(?:take[\s-]?profit|tp)(?:\s+(?:of|at|:))?\s*(\d+(?:\.\d+)?)\s*%",
        text,
        re.I,
    ) or re.search(r"(\d+(?:\.\d+)?)\s*%\s*(?:target|take profit)", text, re.I)
    if tp:
        risk.take_profit_pct = float(tp.group(1))
    rr = re.search(
        r"(?:risk[\s-]?reward|r\s*:\s*r|rr)(?:\s+(?:of|ratio))?\s*(\d+(?:\.\d+)?)\s*:\s*(\d+(?:\.\d+)?)",
        text,
        re.I,
    ) or re.search(r"\b(\d+(?:\.\d+)?)\s*:\s*(\d+(?:\.\d+)?)\s*(?:rr|r\b)", text, re.I)
    if rr:
        left = float(rr.group(1))
        right = float(rr.group(2))
        risk.risk_reward = right / left if left else None
        if risk.stop_loss_pct and not risk.take_profit_pct and risk.risk_reward:
            risk.take_profit_pct = round(risk.stop_loss_pct * risk.risk_reward, 4)
    atr_sl = re.search(r"stop[^\n]{0,48}?(\d+(?:\.\d+)?)\s*atr", text, re.I)
    if atr_sl:
        risk.stop_loss_atr = float(atr_sl.group(1))
    size = re.search(
        r"\$\s*(\d+(?:\.\d+)?)\s*(?:per trade|usdt|usd)?",
        text,
        re.I,
    ) or re.search(
        r"(\d+(?:\.\d+)?)\s*(?:usdt|usd|dollars)\s*(?:per trade)?",
        text,
        re.I,
    )
    if size:
        risk.quote_amount = float(size.group(1))
    if re.search(r"\b(one|1)\s+position\s+at a time\b", text, re.I) or re.search(
        r"max(?:imum)?\s+(\d+)\s+positions?", text, re.I
    ):
        max_pos = re.search(r"max(?:imum)?\s+(\d+)\s+positions?", text, re.I)
        risk.max_open_positions = int(max_pos.group(1)) if max_pos else 1
    return risk


def _header_match(line: str) -> tuple[str | None, str | None]:
    """Return (section, leftover_rule_text). Leftover is None when the line is only a heading."""
    for kind, pattern in (
        ("entry", SECTION_ENTRY),
        ("exit", SECTION_EXIT),
        ("risk", SECTION_RISK),
        ("market", SECTION_MARKET),
    ):
        match = pattern.match(line)
        if not match:
            continue
        after = line[match.end() :]
        leftover = after.lstrip(" :").strip()
        if not leftover:
            return kind, None
        if after.lstrip().startswith(":"):
            return kind, leftover
        # "Exit when RSI..." is a rule, not a section title.
        return None, None
    return None, None


def _sectionize(text: str) -> dict[str, str]:
    buckets = {"entry": [], "exit": [], "risk": [], "market": [], "other": []}
    current = "other"
    for line in text.split("\n"):
        stripped = line.strip().lstrip("#").strip()
        if not stripped:
            continue
        kind, leftover = _header_match(stripped)
        if kind:
            current = kind
            if leftover:
                buckets[current].append(leftover)
            continue
        buckets[current].append(stripped)
    return {key: "\n".join(lines) for key, lines in buckets.items()}


def _inferred_bucket(condition: Condition) -> str:
    desc = condition.description.lower()
    if (
        condition.operator == "crosses_below"
        or "overbought" in desc
        or "death cross" in desc
    ):
        return "exit"
    if (
        condition.operator in {"<", "<=", "crosses_above"}
        or "oversold" in desc
        or "golden cross" in desc
        or "below" in desc
    ):
        return "entry"
    return "exit"


def compile_strategy(text: str, filename: str | None = None) -> StrategyCriteria:
    """Turn a trading-style document into machine-checkable trade criteria."""
    text = _clean(text)
    if not text:
        raise ValueError("The document is empty. Paste or upload your trading style first.")

    sections = _sectionize(text)
    name = extract_name(text, filename)
    symbols = extract_symbols(text)
    timeframe = extract_timeframe(text)
    risk = parse_risk(text)

    entry_conditions: list[Condition] = []
    exit_conditions: list[Condition] = []
    uncompiled: list[str] = []
    excerpts: list[str] = []

    def classify_sentence(sentence: str, default: str | None) -> str | None:
        if default:
            return default
        if ENTRY_HINTS.search(sentence) and not EXIT_HINTS.search(sentence):
            return "entry"
        if EXIT_HINTS.search(sentence) and not ENTRY_HINTS.search(sentence):
            return "exit"
        if SHORT_HINTS.search(sentence):
            return "exit"
        return None

    planned = [
        (sections["entry"], "entry"),
        (sections["exit"], "exit"),
        (sections["other"], None),
        (sections["market"], None),
        (sections["risk"], None),
    ]

    seen_desc: set[str] = set()
    for blob, default_bucket in planned:
        if not blob:
            continue
        for sentence in _sentences(blob):
            conditions = parse_conditions(sentence)
            if not conditions:
                title = sentence.strip("# ").strip()
                if title.lower() == name.lower():
                    continue
                if re.search(
                    r"stop[\s-]?loss|take[\s-]?profit|per trade|position at a time|risk reward|\$\s*\d",
                    sentence,
                    re.I,
                ) and not _looks_like_condition(sentence):
                    continue
                if _looks_like_condition(sentence) or (default_bucket and len(sentence) > 12):
                    uncompiled.append(sentence)
                continue
            excerpts.append(sentence)
            bucket = classify_sentence(sentence, default_bucket)
            if bucket is None:
                for cond in conditions:
                    if cond.description in seen_desc:
                        continue
                    seen_desc.add(cond.description)
                    if _inferred_bucket(cond) == "entry":
                        entry_conditions.append(cond)
                    else:
                        exit_conditions.append(cond)
                continue
            target = entry_conditions if bucket == "entry" else exit_conditions
            for cond in conditions:
                if cond.description in seen_desc:
                    continue
                seen_desc.add(cond.description)
                target.append(cond)

    # If the writer only described an entry, still try to infer a classic RSI exit.
    if entry_conditions and not exit_conditions:
        for cond in list(entry_conditions):
            if cond.indicator == "rsi" and cond.operator == "<" and cond.value is not None:
                mirror = Condition(
                    id=_cid(),
                    indicator="rsi",
                    period=cond.period or 14,
                    operator=">",
                    value=70.0 if cond.value <= 40 else 100 - cond.value,
                    description=f"RSI({cond.period or 14}) is above {70 if cond.value <= 40 else 100 - cond.value:g}",
                )
                if mirror.description not in seen_desc:
                    exit_conditions.append(mirror)
                    seen_desc.add(mirror.description)

    total_rules = len(entry_conditions) + len(exit_conditions)
    usable = 1 if (risk.stop_loss_pct or risk.take_profit_pct or risk.quote_amount) else 0
    denom = max(total_rules + len(uncompiled) + usable, 1)
    confidence = round(min(1.0, (total_rules + usable) / denom), 2)
    if total_rules == 0:
        confidence = 0.15 if symbols else 0.0

    summary_bits = [f"{name} on {', '.join(symbols)} ({timeframe})"]
    if entry_conditions:
        summary_bits.append(f"{len(entry_conditions)} entry rule(s)")
    if exit_conditions:
        summary_bits.append(f"{len(exit_conditions)} exit rule(s)")
    summary = " · ".join(summary_bits)

    return StrategyCriteria(
        name=name,
        summary=summary,
        symbols=symbols,
        timeframe=timeframe,
        entry=RuleGroup(logic="all", conditions=entry_conditions),
        exit=RuleGroup(logic="any", conditions=exit_conditions),
        risk=risk,
        uncompiled=uncompiled,
        source_excerpts=excerpts[:12],
        confidence=confidence,
    )
