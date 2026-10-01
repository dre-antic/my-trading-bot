from __future__ import annotations

import argparse
import json
import os
from pathlib import Path

import uvicorn

from tradingbot.compiler import compile_strategy
from tradingbot.documents import read_path
from tradingbot.engine import run_scan
from tradingbot.market import FixtureMarket, PublicBinanceMarket


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Compile a trading style and paper-trade the criteria.")
    sub = parser.add_subparsers(dest="cmd", required=True)

    compile_p = sub.add_parser("compile", help="Turn a style document into JSON criteria")
    compile_p.add_argument("path")

    scan_p = sub.add_parser("scan", help="Compile a document and scan once")
    scan_p.add_argument("path")
    scan_p.add_argument("--demo", action="store_true", help="Use a falling demo tape so RSI setups can fire")

    serve_p = sub.add_parser("serve", help="Open the local trading desk")
    serve_p.add_argument("--host", default=os.environ.get("TRADINGBOT_HOST", "127.0.0.1"))
    serve_p.add_argument("--port", type=int, default=int(os.environ.get("TRADINGBOT_PORT", "8765")))

    args = parser.parse_args(argv)

    if args.cmd == "compile":
        extracted = read_path(Path(args.path))
        criteria = compile_strategy(extracted.text, filename=extracted.filename)
        print(json.dumps(criteria.model_dump(), indent=2))
        print("\nHow the bot will trade:")
        for line in criteria.english_rules():
            print(f"  - {line}")
        return 0

    if args.cmd == "scan":
        from tradingbot.broker import PaperBroker

        extracted = read_path(Path(args.path))
        criteria = compile_strategy(extracted.text, filename=extracted.filename)
        market = FixtureMarket() if args.demo else PublicBinanceMarket()
        candles = market.ohlcv(criteria.symbols[0], criteria.timeframe)
        outcome = run_scan(
            strategy_id="cli",
            criteria=criteria,
            candles=candles,
            broker=PaperBroker(),
            tape="demo" if args.demo else "live",
        )
        print(outcome.message)
        print(json.dumps(outcome.as_dict(), indent=2))
        return 0

    if args.cmd == "serve":
        uvicorn.run("tradingbot.app:app", host=args.host, port=args.port, reload=False)
        return 0

    return 1


if __name__ == "__main__":
    raise SystemExit(main())
