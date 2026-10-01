from __future__ import annotations

from pathlib import Path

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from tradingbot.broker import PaperBroker
from tradingbot.compiler import compile_strategy
from tradingbot.config import live_trading_enabled, make_market, make_store
from tradingbot.db import Store
from tradingbot.documents import extract_document
from tradingbot.engine import run_scan
from tradingbot.market import FixtureMarket
from tradingbot.schema import StrategyCriteria

WEB_DIR = Path(__file__).resolve().parent / "web"
EXAMPLES_DIR = Path(__file__).resolve().parent.parent / "examples"

store: Store
broker: PaperBroker


class TextIn(BaseModel):
    text: str
    filename: str | None = "pasted.txt"


class CriteriaIn(BaseModel):
    criteria: dict


class ActivateIn(BaseModel):
    active: bool = True


def _load_broker(db: Store) -> PaperBroker:
    snap = db.get_state("broker", None)
    paper = PaperBroker()
    if not snap:
        return paper
    paper.cash = float(snap.get("cash", paper.cash))
    paper.positions = {item["symbol"]: item for item in snap.get("positions", [])}
    return paper


def _persist_broker() -> None:
    store.set_state("broker", broker.snapshot())


def create_app() -> FastAPI:
    global store, broker
    store = make_store()
    broker = _load_broker(store)
    app = FastAPI(title="My Trading Bot", version="0.1.0")

    @app.get("/api/health")
    def health() -> dict:
        return {"ok": True, "live_trading": live_trading_enabled()}

    @app.get("/api/desk")
    def desk() -> dict:
        return {
            "broker": broker.snapshot(),
            "live_trading": live_trading_enabled(),
            "strategies": store.list_strategies(),
            "trades": store.list_trades()[:50],
        }

    @app.get("/api/examples")
    def examples() -> list[dict]:
        items = []
        if EXAMPLES_DIR.exists():
            for path in sorted(EXAMPLES_DIR.glob("*.md")):
                text = path.read_text(encoding="utf-8")
                heading = next((line.lstrip("# ").strip() for line in text.splitlines() if line.strip()), path.stem)
                items.append({"slug": path.stem, "name": heading, "text": text})
        return items

    @app.get("/api/strategies")
    def list_strategies() -> list[dict]:
        return store.list_strategies()

    @app.get("/api/strategies/{strategy_id}")
    def get_strategy(strategy_id: str) -> dict:
        try:
            return store.get_strategy(strategy_id)
        except KeyError as exc:
            raise HTTPException(404, "Strategy not found") from exc

    @app.post("/api/strategies/upload")
    async def upload_strategy(file: UploadFile = File(...)) -> dict:
        data = await file.read()
        try:
            extracted = extract_document(filename=file.filename or "upload.txt", data=data)
            return _save_from_text(extracted.text, extracted.filename, extracted.warning)
        except ValueError as exc:
            raise HTTPException(400, str(exc)) from exc

    @app.post("/api/strategies/from-text")
    def from_text(payload: TextIn) -> dict:
        try:
            extracted = extract_document(filename=payload.filename or "pasted.txt", text=payload.text)
            return _save_from_text(extracted.text, extracted.filename, extracted.warning)
        except ValueError as exc:
            raise HTTPException(400, str(exc)) from exc

    @app.put("/api/strategies/{strategy_id}")
    def update_strategy(strategy_id: str, payload: CriteriaIn) -> dict:
        try:
            store.get_strategy(strategy_id)
        except KeyError as exc:
            raise HTTPException(404, "Strategy not found") from exc
        criteria = StrategyCriteria.model_validate(payload.criteria)
        return store.update_criteria(strategy_id, criteria)

    @app.post("/api/strategies/{strategy_id}/activate")
    def activate(strategy_id: str, payload: ActivateIn) -> dict:
        try:
            return store.set_active(strategy_id, payload.active)
        except KeyError as exc:
            raise HTTPException(404, "Strategy not found") from exc

    @app.post("/api/desk/reset")
    def reset_desk() -> dict:
        global broker
        broker = PaperBroker()
        store.set_state("broker", broker.snapshot())
        store.clear_trades()
        return broker.snapshot()

    @app.post("/api/strategies/{strategy_id}/scan")
    def scan(strategy_id: str, demo: bool = False) -> dict:
        try:
            row = store.get_strategy(strategy_id)
        except KeyError as exc:
            raise HTTPException(404, "Strategy not found") from exc
        criteria = StrategyCriteria.model_validate(row["criteria"])
        if not criteria.entry.conditions:
            raise HTTPException(
                400,
                "This style did not compile into entry criteria yet. Edit the rules or upload a clearer document.",
            )
        market = FixtureMarket() if demo else make_market()
        try:
            candles = market.ohlcv(criteria.symbols[0], criteria.timeframe)
        except Exception as exc:
            raise HTTPException(502, f"Could not fetch market data: {exc}") from exc
        outcome = run_scan(
            strategy_id=strategy_id,
            criteria=criteria,
            candles=candles,
            broker=broker,
            tape="demo" if demo else "live",
        )
        result = outcome.as_dict()
        result["demo"] = demo
        result["broker"] = broker.snapshot()
        store.save_scan(strategy_id, result)
        if outcome.trade:
            store.save_trade(outcome.trade)
        _persist_broker()
        return result

    @app.get("/api/trades")
    def trades(strategy_id: str | None = None) -> list[dict]:
        return store.list_trades(strategy_id)

    if WEB_DIR.exists():
        app.mount("/", StaticFiles(directory=WEB_DIR, html=True), name="web")
    return app


def _save_from_text(text: str, filename: str, warning: str | None) -> dict:
    criteria = compile_strategy(text, filename=filename)
    warnings = []
    if warning:
        warnings.append(warning)
    if not criteria.entry.conditions:
        warnings.append("No entry criteria could be compiled. Keep the language specific: indicator, comparison, number.")
    if criteria.uncompiled:
        warnings.append(f"{len(criteria.uncompiled)} line(s) could not be turned into a checkable rule.")
    saved = store.save_strategy(
        name=criteria.name,
        source_filename=filename,
        source_text=text,
        criteria=criteria,
        warnings=warnings,
    )
    return saved


app = create_app()
