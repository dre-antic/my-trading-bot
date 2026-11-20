The monitor emails you on the pass that first sees a competitor below your price. It checks every 15 minutes. Remove the daily report job if it is already scheduled.

The two scrapers already written stay. Each one becomes a fetcher for this alerter. The two sites that are blocking us are named in `paused_sources`, and the loop skips them. A site that still returns a normal product page can be registered the same way as the first two.

The mail goes out on the check that first sees the lower price. At a 15-minute interval, that is within 15 minutes of the new price appearing on the page. `POLL_SECONDS` at the top of `monitor.py` is that interval.

## When mail goes out

Your price lives on each SKU as `my_price`. Comparison is exact, in one currency, on the same basis the current scrapers already use (item price, or item plus shipping). Mail goes out when their price is strictly under yours.

| Their price | Your price | Already alerted at | Result |
| --- | --- | --- | --- |
| 24.00 | 24.00 | — | no email |
| 23.99 | 24.00 | — | email |
| 23.80 | 24.00 | 23.99 | no email; the further drop is $0.19 |
| 23.49 | 24.00 | 23.99 | email; the further drop is $0.50 |
| 24.00 | 24.00 | 23.99 | no email; that alert closes |
| 23.50 | 24.00 | closed | email; this is a new undercut |

One email per source per SKU. The open alert is stored in `data/alert_state.json`. A restart reads that file and stays quiet while the same undercut is still open. The first pass sends mail if someone is already below you when the monitor starts. Set `FOLLOWUP_DROP` to a very large number when you want mail only on the first crossing.

A fetcher that times out or cannot find a price logs a line on stderr. The next pass tries that fetch again.

## Sites that are blocking us

Put those two names in `paused_sources`. The loop skips a paused name for the whole run.

If a registered source later answers 403 or 429, or comes back as a challenge page with no price, that source pauses itself. You get one mail, "Price source paused." Retries then wait 15 minutes, then 1 hour, then 6 hours. You get one more mail when prices start coming back. `robots.txt` is checked for `PRICE_MONITOR_UA` before a fetch; a disallow pauses that source the same way. A `robots.txt` that itself returns 403 is treated as a disallow.

A changed page (HTTP 200, selector no longer matches) is a parser fix, and the stderr line from `SourceError` is the signal. A 404 is a bad URL. A 403, a 429, or a browser-check page stays paused. The durable way to cover a paused seller is that site's product feed or official API, or a price feed you already license.

Tell me the status code and the title of the page those two sites return. That is enough to decide "fix the parser" versus "leave it paused."

## Drop-in files

Standard library only. Run it from the project root. Save this as `config/products.json` and replace the placeholders with your SKUs, your prices, and the real URLs. `delta` and `echo` stand in for the two blocked sites:

```json
{
  "paused_sources": ["delta", "echo"],
  "products": [
    {
      "sku": "sku-100",
      "name": "Example product",
      "my_price": "24.00",
      "urls": {
        "alpha": "https://alpha.example/products/sku-100",
        "bravo": "https://bravo.example/products/sku-100",
        "charlie": "https://charlie.example/products/sku-100",
        "delta": "https://delta.example/products/sku-100",
        "echo": "https://echo.example/products/sku-100"
      }
    }
  ]
}
```

Wrap each scraper that still gets a normal page. `scrape_alpha` is the function you already have; point that name at the real one. Do the same for the second site. Leave a blocked site out of this dict even if a scraper for it already exists.

```python
from decimal import Decimal

from monitor import Offer, SourceBlocked, SourceError, utcnow


def fetch_alpha(product, url):
    try:
        raw_price = scrape_alpha(url)
    except SourceBlocked:
        raise
    except SourceError:
        raise
    except Exception as exc:
        status = getattr(exc, "status", None) or getattr(exc, "status_code", None)
        if status in (403, 429):
            raise SourceBlocked(url) from exc
        raise SourceError(url) from exc
    if raw_price is None:
        raise SourceError(url)
    return Offer(
        sku=product.sku,
        competitor="Alpha",
        price=Decimal(str(raw_price)),
        url=url,
        fetched_at=utcnow(),
    )
```

Register it inside `build_fetchers` in `monitor.py`:

```python
return {
    "alpha": fetch_alpha,
    "bravo": fetch_bravo,
}
```

The dict key must match the key under `urls`.

SMTP settings live in the environment: `SMTP_HOST`, `SMTP_PORT` (587, or 465 for implicit TLS), `SMTP_USER`, `SMTP_PASSWORD`, `ALERT_FROM`, `ALERT_TO`. Set `PRICE_MONITOR_UA` to something like `PriceMonitor/1.0 (+mailto:you@example.com)` with a mailbox you actually read.

One pass, printed to the terminal:

```bash
ALERT_DRY_RUN=1 ALERT_ONCE=1 python3 monitor.py
```

Then run `python3 monitor.py` under a process manager. A systemd unit can load the secrets from a root-only file:

```ini
[Service]
WorkingDirectory=/opt/price-monitor
ExecStart=/usr/bin/python3 monitor.py
Environment=PRICE_MONITOR_UA=PriceMonitor/1.0 (+mailto:you@example.com)
EnvironmentFile=/etc/price-monitor.env
Restart=on-failure
```

## monitor.py

```python
"""Competitor undercut alerts.

Poll registered price fetchers and email when a competitor is below your price.
A source that returns SourceBlocked, or whose robots.txt disallows the bot,
is paused with backoff.

Environment:
  SMTP_HOST, SMTP_PORT (default 587; 465 uses implicit TLS),
  SMTP_USER, SMTP_PASSWORD (optional when the server needs no login),
  ALERT_FROM, ALERT_TO
  ALERT_DRY_RUN=1   print mail instead of sending
  ALERT_ONCE=1      check once and exit
  PRICE_MONITOR_UA  contact-bearing user agent for robots.txt checks
"""

from __future__ import annotations

import json
import os
import smtplib
import socket
import sys
import time
import urllib.robotparser
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from email.message import EmailMessage
from pathlib import Path
from typing import Callable, Optional
from urllib.parse import urlparse

STATE_PATH = Path("data/alert_state.json")
CONFIG_PATH = Path("config/products.json")
POLL_SECONDS = 15 * 60
FOLLOWUP_DROP = Decimal("0.50")
BACKOFF_SECONDS = (15 * 60, 60 * 60, 6 * 60 * 60)
USER_AGENT = os.environ.get(
    "PRICE_MONITOR_UA",
    "PriceMonitor/1.0 (+mailto:you@example.com)",
)


class SourceBlocked(Exception):
    """The site refused the fetch (HTTP 403 or 429, or a challenge page)."""


class SourceError(Exception):
    """The fetch or the parse failed for this product."""


@dataclass(frozen=True)
class Product:
    sku: str
    name: str
    my_price: Decimal
    urls: dict[str, str]


@dataclass(frozen=True)
class Offer:
    sku: str
    competitor: str
    price: Decimal
    url: str
    fetched_at: datetime


Fetcher = Callable[[Product, str], Offer]
Sender = Callable[[str, str], None]
AllowUrl = Callable[[str], bool]


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def money(value: Decimal) -> str:
    return f"{value.quantize(Decimal('0.01'))}"


def as_money(value: object) -> Decimal:
    if isinstance(value, Decimal):
        return value
    return Decimal(str(value))


def load_products(path: Path) -> tuple[list[Product], set[str]]:
    raw = json.loads(path.read_text())
    products = [
        Product(
            sku=item["sku"],
            name=item["name"],
            my_price=Decimal(str(item["my_price"])),
            urls=dict(item.get("urls") or {}),
        )
        for item in raw["products"]
    ]
    paused = set(raw.get("paused_sources") or [])
    return products, paused


def load_state(path: Path) -> dict:
    if not path.exists():
        return {"alerts": {}, "sources": {}}
    return json.loads(path.read_text())


def save_state(path: Path, state: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(".json.tmp")
    tmp.write_text(json.dumps(state, indent=2, sort_keys=True))
    tmp.replace(path)


def alert_key(source: str, sku: str) -> str:
    return f"{source}|{sku}"


def decide(previous: Optional[dict], price: Decimal, my_price: Decimal) -> str:
    """Return 'alert', 'clear', or 'hold'.

    alert — first time this source is under your price, or the price has
            fallen by at least FOLLOWUP_DROP from the price last emailed.
    clear — price is back at or above yours after an open alert.
    hold  — no email.
    """
    if price >= my_price:
        if previous and previous.get("below"):
            return "clear"
        return "hold"
    if not previous or not previous.get("below"):
        return "alert"
    alerted_raw = previous.get("alerted_price")
    if not alerted_raw:
        return "alert"
    if Decimal(alerted_raw) - price >= FOLLOWUP_DROP:
        return "alert"
    return "hold"


def send_email(subject: str, body: str) -> None:
    if os.environ.get("ALERT_DRY_RUN") == "1":
        print(subject)
        print(body)
        print("---")
        return

    message = EmailMessage()
    message["Subject"] = subject
    message["From"] = os.environ["ALERT_FROM"]
    message["To"] = os.environ["ALERT_TO"]
    message.set_content(body)
    host = os.environ["SMTP_HOST"]
    port = int(os.environ.get("SMTP_PORT", "587"))
    client = smtplib.SMTP_SSL if port == 465 else smtplib.SMTP
    with client(host, port, timeout=30) as smtp:
        if port != 465:
            smtp.starttls()
        user = os.environ.get("SMTP_USER")
        if user:
            smtp.login(user, os.environ["SMTP_PASSWORD"])
        smtp.send_message(message)


def source_ready(health: dict, now: datetime) -> bool:
    nxt = health.get("next_try_at")
    if not nxt:
        return True
    return now >= datetime.fromisoformat(nxt)


def mark_blocked(health: dict, now: datetime) -> dict:
    failures = int(health.get("failures") or 0) + 1
    index = min(failures - 1, len(BACKOFF_SECONDS) - 1)
    delay = BACKOFF_SECONDS[index]
    return {
        "failures": failures,
        "next_try_at": (now + timedelta(seconds=delay)).isoformat(),
        "outage_notified": bool(health.get("outage_notified")),
    }


def mark_ok() -> dict:
    return {"failures": 0, "next_try_at": None, "outage_notified": False}


def robots_allows(url: str, cache: dict[str, urllib.robotparser.RobotFileParser]) -> bool:
    parts = urlparse(url)
    if parts.scheme not in ("http", "https") or not parts.netloc:
        return False
    origin = f"{parts.scheme}://{parts.netloc}"
    parser = cache.get(origin)
    if parser is None:
        parser = urllib.robotparser.RobotFileParser()
        parser.set_url(origin + "/robots.txt")
        socket.setdefaulttimeout(20)
        parser.read()
        cache[origin] = parser
    return parser.can_fetch(USER_AGENT, url)


def make_robots_check() -> AllowUrl:
    cache: dict[str, urllib.robotparser.RobotFileParser] = {}

    def allow(url: str) -> bool:
        try:
            return robots_allows(url, cache)
        except Exception as exc:
            print(f"robots.txt check failed for {url}: {exc}", file=sys.stderr)
            return True

    return allow


def _pause_source(name: str, health: dict, sources: dict, now: datetime, send: Sender, reason: str) -> None:
    updated = mark_blocked(health, now)
    sources[name] = updated
    if updated["outage_notified"]:
        return
    send(
        f"Price source paused: {name}",
        (
            f"{name} is paused until {updated['next_try_at']}.\n"
            f"Reason: {reason}\n"
            f"The other sources are still checked.\n"
            f"A product feed or official API is the durable way to cover {name}.\n"
        ),
    )
    updated["outage_notified"] = True
    sources[name] = updated


def _deliver(
    product: Product,
    source: str,
    offer: Offer,
    price: Decimal,
    alerts: dict,
    now: datetime,
    send: Sender,
) -> None:
    label = offer.competitor or source
    k = alert_key(source, product.sku)
    previous = alerts.get(k)
    action = decide(previous, price, product.my_price)
    if action == "hold":
        current = dict(previous or {})
        current["last_seen_price"] = str(price)
        current["last_seen_at"] = now.isoformat()
        alerts[k] = current
        return
    if action == "clear":
        alerts[k] = {
            "below": False,
            "alerted_price": None,
            "last_alert_at": None,
            "last_seen_price": str(price),
            "last_seen_at": now.isoformat(),
        }
        return

    delta = product.my_price - price
    subject = f"Undercut: {product.name} — {label} at {money(price)}"
    checked = offer.fetched_at or now
    body = (
        f"{label} lists {product.name} ({product.sku}) at {money(price)}.\n"
        f"Your price is {money(product.my_price)}, so they are {money(delta)} under you.\n"
        f"URL: {offer.url}\n"
        f"Checked: {checked.isoformat()}\n"
    )
    send(subject, body)
    alerts[k] = {
        "below": True,
        "alerted_price": str(price),
        "last_alert_at": now.isoformat(),
        "last_seen_price": str(price),
        "last_seen_at": now.isoformat(),
    }


def run_once(
    products: list[Product],
    fetchers: dict[str, Fetcher],
    paused: set[str],
    state: dict,
    allow_url: AllowUrl = lambda url: True,
    send: Sender = send_email,
    now: Optional[datetime] = None,
) -> None:
    now = now or utcnow()
    alerts = state.setdefault("alerts", {})
    sources = state.setdefault("sources", {})

    for name, fetch in fetchers.items():
        if name in paused:
            continue
        health = dict(sources.get(name) or {})
        if not source_ready(health, now):
            continue

        checked = 0
        disallowed = 0
        pending: list[tuple[Product, Offer, Decimal]] = []
        blocked = False
        for product in products:
            url = product.urls.get(name)
            if not url:
                continue
            checked += 1
            if not allow_url(url):
                disallowed += 1
                continue
            try:
                offer = fetch(product, url)
            except SourceBlocked:
                blocked = True
                break
            except SourceError as exc:
                print(f"{name} {product.sku}: {exc}", file=sys.stderr)
                continue
            if offer.price is None:
                print(f"{name} {product.sku}: empty price", file=sys.stderr)
                continue
            price = as_money(offer.price)
            if price <= 0:
                print(f"{name} {product.sku}: non-positive price {price}", file=sys.stderr)
                continue
            pending.append((product, offer, price))

        # Prices already parsed in this pass are real, even if a later URL
        # on the same site is refused. Deliver those, then pause.
        if pending and not blocked:
            if health.get("outage_notified"):
                send(
                    f"Price source resumed: {name}",
                    f"{name} is returning prices again.\n",
                )
            sources[name] = mark_ok()
        for product, offer, price in pending:
            _deliver(product, name, offer, price, alerts, now, send)

        if blocked:
            _pause_source(
                name,
                health,
                sources,
                now,
                send,
                "the site refused the request (403, 429, or a challenge page)",
            )
        elif checked > 0 and disallowed == checked:
            _pause_source(
                name,
                health,
                sources,
                now,
                send,
                f"robots.txt disallows {USER_AGENT}",
            )


def build_fetchers() -> dict[str, Fetcher]:
    """Register scrapers that still receive a normal product page.

    Each fetcher takes (product, url) and returns an Offer.
    Raise SourceBlocked on HTTP 403 or 429, or when the page is a challenge
    page with no price. Raise SourceError on a timeout or a parse miss.

    Wrap the two scrapers already written here. Leave the blocked sites out
    of this dict and name them in config paused_sources.
    """
    return {
        # "alpha": fetch_alpha,
        # "bravo": fetch_bravo,
    }


def main() -> None:
    dry = os.environ.get("ALERT_DRY_RUN") == "1"
    if not dry:
        missing = [key for key in ("SMTP_HOST", "ALERT_FROM", "ALERT_TO") if not os.environ.get(key)]
        if missing:
            raise SystemExit("Set " + ", ".join(missing) + ", or run with ALERT_DRY_RUN=1")

    products, paused = load_products(CONFIG_PATH)
    fetchers = build_fetchers()
    allow_url = make_robots_check()
    once = os.environ.get("ALERT_ONCE") == "1"
    while True:
        state = load_state(STATE_PATH)
        run_once(products, fetchers, paused, state, allow_url=allow_url)
        save_state(STATE_PATH, state)
        if once:
            return
        time.sleep(POLL_SECONDS)


if __name__ == "__main__":
    main()
```

## What I need from you to finish the remaining fetchers

- The five domains, which two are blocking, and the HTTP status plus page title you get from those two.
- For each SKU: your price, and the product URL on each site that still returns a page.
- The inbox that should receive the alerts. Set the SMTP password in `SMTP_PASSWORD` in the environment on the machine that sends the mail.

With that, the next edit is the fetcher list: register every site that still serves a product page, and keep the other two on `paused_sources`.
