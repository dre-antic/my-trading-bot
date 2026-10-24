from __future__ import annotations

import argparse
import os
from pathlib import Path
from typing import Any

from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from clicky.engine import (
    ASSETS,
    Book,
    ClickyError,
    add_message,
    advise,
    click_buy,
    click_sell,
    reply,
    reset_book,
)
from clicky.prices import fetch_markets, market_for, price_map
from clicky.store import Store, default_db_path

WEB_DIR = Path(__file__).resolve().parent / "web"
DEFAULT_HOST = os.environ.get("CLICKY_HOST", "0.0.0.0")
DEFAULT_PORT = int(os.environ.get("CLICKY_PORT", "8765"))


class ClickBody(BaseModel):
    side: str
    symbol: str = "BTC"
    usd: float = Field(default=25.0, ge=1, le=5000)


class AskBody(BaseModel):
    message: str = ""
    symbol: str = "BTC"


def create_app(store: Store | None = None) -> FastAPI:
    app = FastAPI(title="Clicky", version="0.1.0")
    app.state.store = store or Store()

    def load() -> Book:
        return app.state.store.load_book()

    def save(book: Book) -> None:
        app.state.store.save_book(book)

    async def snapshot(symbol: str = "BTC") -> dict[str, Any]:
        markets = await fetch_markets()
        symbol = symbol.upper()
        if symbol not in ASSETS:
            raise HTTPException(status_code=400, detail=f"Unknown symbol {symbol}")
        market = market_for(markets, symbol)
        advice = advise(symbol, market["price"], market.get("change_24h"), market.get("closes") or [])
        book = load()
        if not book.messages:
            book = reset_book()
            save(book)
        prices = price_map(markets)
        source = "live" if all(item.get("source") == "live" for item in markets) else "demo"
        return {
            "markets": markets,
            "advice": advice,
            "book": book.to_public(prices),
            "source": source,
            "paper": True,
        }

    @app.get("/api/health")
    async def health() -> dict[str, Any]:
        return {"ok": True, "name": "clicky"}

    @app.get("/api/state")
    async def state(symbol: str = "BTC") -> dict[str, Any]:
        return await snapshot(symbol)

    @app.post("/api/ask")
    async def ask(body: AskBody) -> dict[str, Any]:
        data = await snapshot(body.symbol)
        book = load()
        add_message(book, "you", body.message.strip() or "What should I do?")
        text = reply(body.message, book, data["markets"], data["advice"])
        add_message(book, "clicky", text)
        save(book)
        data["book"] = book.to_public(price_map(data["markets"]))
        data["reply"] = text
        return data

    @app.post("/api/click")
    async def click(body: ClickBody) -> dict[str, Any]:
        data = await snapshot(body.symbol)
        book = load()
        market = market_for(data["markets"], body.symbol)
        try:
            if body.side == "buy":
                fill = click_buy(book, body.symbol, body.usd, market["price"], data["advice"])
            elif body.side == "sell":
                fill = click_sell(book, body.symbol, body.usd, market["price"], data["advice"])
            else:
                raise ClickyError("Tap BUY or SELL")
        except ClickyError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc
        add_message(book, "clicky", fill.note)
        save(book)
        data["book"] = book.to_public(price_map(data["markets"]))
        data["fill"] = {
            "id": fill.id,
            "side": fill.side,
            "symbol": fill.symbol,
            "usd": fill.usd,
            "price": fill.price,
            "qty": fill.qty,
            "realized_pnl": fill.realized_pnl,
            "note": fill.note,
        }
        data["advice"] = advise(
            body.symbol,
            market["price"],
            market.get("change_24h"),
            market.get("closes") or [],
        )
        return data

    @app.post("/api/reset")
    async def reset(symbol: str = "BTC") -> dict[str, Any]:
        book = reset_book()
        save(book)
        return await snapshot(symbol)

    @app.get("/")
    async def index() -> FileResponse:
        return FileResponse(WEB_DIR / "index.html")

    app.mount("/", StaticFiles(directory=WEB_DIR, html=True), name="web")
    return app


app = create_app()


def main() -> None:
    parser = argparse.ArgumentParser(description="Clicky phone AI")
    parser.add_argument("--host", default=DEFAULT_HOST)
    parser.add_argument("--port", type=int, default=DEFAULT_PORT)
    parser.add_argument("--db", default=os.environ.get("CLICKY_DB") or str(default_db_path()))
    args = parser.parse_args()
    store = Store(Path(args.db))
    application = create_app(store)
    try:
        import uvicorn
    except ImportError as exc:  # pragma: no cover
        raise SystemExit("uvicorn is required to launch Clicky") from exc
    print(f"Clicky is on http://{args.host}:{args.port}")
    print("On your phone (same Wi-Fi): open that URL, then Add to Home Screen.")
    uvicorn.run(application, host=args.host, port=args.port, log_level="info")
