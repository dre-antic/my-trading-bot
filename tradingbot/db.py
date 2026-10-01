from __future__ import annotations

import json
import sqlite3
from pathlib import Path
from uuid import uuid4

from tradingbot.market import utc_now
from tradingbot.schema import StrategyCriteria, TradeRecord


class Store:
    def __init__(self, path: Path) -> None:
        path.parent.mkdir(parents=True, exist_ok=True)
        self.path = path
        self._init()

    def connect(self) -> sqlite3.Connection:
        conn = sqlite3.connect(self.path)
        conn.row_factory = sqlite3.Row
        return conn

    def _init(self) -> None:
        with self.connect() as conn:
            conn.executescript(
                """
                CREATE TABLE IF NOT EXISTS strategies (
                    id TEXT PRIMARY KEY,
                    name TEXT NOT NULL,
                    source_filename TEXT,
                    source_text TEXT NOT NULL,
                    criteria_json TEXT NOT NULL,
                    warnings_json TEXT NOT NULL DEFAULT '[]',
                    active INTEGER NOT NULL DEFAULT 0,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL
                );
                CREATE TABLE IF NOT EXISTS trades (
                    id TEXT PRIMARY KEY,
                    strategy_id TEXT NOT NULL,
                    symbol TEXT NOT NULL,
                    side TEXT NOT NULL,
                    amount REAL NOT NULL,
                    price REAL NOT NULL,
                    quote_amount REAL NOT NULL,
                    reason_json TEXT NOT NULL,
                    paper INTEGER NOT NULL DEFAULT 1,
                    pnl REAL,
                    created_at TEXT NOT NULL
                );
                CREATE TABLE IF NOT EXISTS scans (
                    id TEXT PRIMARY KEY,
                    strategy_id TEXT NOT NULL,
                    result_json TEXT NOT NULL,
                    created_at TEXT NOT NULL
                );
                CREATE TABLE IF NOT EXISTS state (
                    key TEXT PRIMARY KEY,
                    value_json TEXT NOT NULL
                );
                """
            )

    def save_strategy(
        self,
        *,
        name: str,
        source_filename: str,
        source_text: str,
        criteria: StrategyCriteria,
        warnings: list[str] | None = None,
    ) -> dict:
        strategy_id = uuid4().hex[:12]
        now = utc_now()
        with self.connect() as conn:
            conn.execute(
                """
                INSERT INTO strategies
                (id, name, source_filename, source_text, criteria_json, warnings_json, active, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?)
                """,
                (
                    strategy_id,
                    name,
                    source_filename,
                    source_text,
                    criteria.model_dump_json(),
                    json.dumps(warnings or []),
                    now,
                    now,
                ),
            )
        return self.get_strategy(strategy_id)

    def update_criteria(self, strategy_id: str, criteria: StrategyCriteria) -> dict:
        with self.connect() as conn:
            conn.execute(
                "UPDATE strategies SET name = ?, criteria_json = ?, updated_at = ? WHERE id = ?",
                (criteria.name, criteria.model_dump_json(), utc_now(), strategy_id),
            )
        return self.get_strategy(strategy_id)

    def set_active(self, strategy_id: str, active: bool) -> dict:
        with self.connect() as conn:
            if active:
                conn.execute("UPDATE strategies SET active = 0")
            conn.execute(
                "UPDATE strategies SET active = ?, updated_at = ? WHERE id = ?",
                (1 if active else 0, utc_now(), strategy_id),
            )
        return self.get_strategy(strategy_id)

    def get_strategy(self, strategy_id: str) -> dict:
        with self.connect() as conn:
            row = conn.execute("SELECT * FROM strategies WHERE id = ?", (strategy_id,)).fetchone()
        if not row:
            raise KeyError(strategy_id)
        return _strategy_row(row)

    def list_strategies(self) -> list[dict]:
        with self.connect() as conn:
            rows = conn.execute("SELECT * FROM strategies ORDER BY created_at DESC").fetchall()
        return [_strategy_row(row) for row in rows]

    def save_trade(self, trade: TradeRecord) -> None:
        with self.connect() as conn:
            conn.execute(
                """
                INSERT INTO trades
                (id, strategy_id, symbol, side, amount, price, quote_amount, reason_json, paper, pnl, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    trade.id,
                    trade.strategy_id,
                    trade.symbol,
                    trade.side,
                    trade.amount,
                    trade.price,
                    trade.quote_amount,
                    json.dumps(trade.reason),
                    1 if trade.paper else 0,
                    trade.pnl,
                    trade.created_at,
                ),
            )

    def list_trades(self, strategy_id: str | None = None) -> list[dict]:
        with self.connect() as conn:
            if strategy_id:
                rows = conn.execute(
                    "SELECT * FROM trades WHERE strategy_id = ? ORDER BY created_at DESC",
                    (strategy_id,),
                ).fetchall()
            else:
                rows = conn.execute("SELECT * FROM trades ORDER BY created_at DESC").fetchall()
        return [_trade_row(row) for row in rows]

    def clear_trades(self) -> None:
        with self.connect() as conn:
            conn.execute("DELETE FROM trades")

    def save_scan(self, strategy_id: str, result: dict) -> None:
        with self.connect() as conn:
            conn.execute(
                "INSERT INTO scans (id, strategy_id, result_json, created_at) VALUES (?, ?, ?, ?)",
                (uuid4().hex[:12], strategy_id, json.dumps(result), utc_now()),
            )

    def get_state(self, key: str, default):
        with self.connect() as conn:
            row = conn.execute("SELECT value_json FROM state WHERE key = ?", (key,)).fetchone()
        if not row:
            return default
        return json.loads(row["value_json"])

    def set_state(self, key: str, value) -> None:
        with self.connect() as conn:
            conn.execute(
                "INSERT INTO state (key, value_json) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value_json = excluded.value_json",
                (key, json.dumps(value)),
            )


def _strategy_row(row: sqlite3.Row) -> dict:
    criteria = json.loads(row["criteria_json"])
    return {
        "id": row["id"],
        "name": row["name"],
        "source_filename": row["source_filename"],
        "source_text": row["source_text"],
        "criteria": criteria,
        "warnings": json.loads(row["warnings_json"]),
        "active": bool(row["active"]),
        "created_at": row["created_at"],
        "updated_at": row["updated_at"],
        "english": StrategyCriteria.model_validate(criteria).english_rules(),
    }


def _trade_row(row: sqlite3.Row) -> dict:
    return {
        "id": row["id"],
        "strategy_id": row["strategy_id"],
        "symbol": row["symbol"],
        "side": row["side"],
        "amount": row["amount"],
        "price": row["price"],
        "quote_amount": row["quote_amount"],
        "reason": json.loads(row["reason_json"]),
        "paper": bool(row["paper"]),
        "pnl": row["pnl"],
        "created_at": row["created_at"],
    }
