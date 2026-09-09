from __future__ import annotations

import hashlib
import re
from urllib.parse import quote

import httpx

from .logging_util import setup_logging
from .providers import USER_AGENT, ProviderError

log = setup_logging()

WIKI_API = "https://en.wikipedia.org/w/api.php"
WIKI_REST = "https://en.wikipedia.org/api/rest_v1/page/summary/"
COMMONS = "https://commons.wikimedia.org/w/api.php"


def _client() -> httpx.Client:
    return httpx.Client(timeout=20.0, headers={"User-Agent": USER_AGENT}, follow_redirects=True)


def _topic_from_prompt(prompt: str) -> str:
    p = prompt.strip()
    p = re.sub(r"^(create|make|produce|write|generate)\s+(a|an|the)?\s*", "", p, flags=re.I)
    p = re.sub(
        r"\b(\d+-minute|60-second|short|youtube|tiktok|documentary|video|explaining|about)\b",
        " ",
        p,
        flags=re.I,
    )
    p = re.sub(r"\s+", " ", p).strip(" .")
    return p[:180] or prompt[:180]


def wiki_search(query: str, limit: int = 5) -> list[dict]:
    with _client() as c:
        r = c.get(
            WIKI_API,
            params={
                "action": "query",
                "list": "search",
                "srsearch": query,
                "srlimit": limit,
                "format": "json",
            },
        )
        r.raise_for_status()
        hits = r.json().get("query", {}).get("search", [])
        out = []
        for h in hits:
            title = h.get("title")
            snippet = re.sub("<[^>]+>", "", h.get("snippet") or "")
            out.append(
                {
                    "title": title,
                    "snippet": snippet,
                    "url": f"https://en.wikipedia.org/wiki/{quote(title.replace(' ', '_'))}",
                    "source": "wikipedia",
                    "license": "CC BY-SA 4.0",
                }
            )
        return out


def wiki_summary(title: str) -> dict:
    with _client() as c:
        r = c.get(WIKI_REST + quote(title.replace(" ", "_")))
        if r.status_code != 200:
            return {}
        data = r.json()
        return {
            "title": data.get("title") or title,
            "extract": data.get("extract") or "",
            "url": data.get("content_urls", {}).get("desktop", {}).get("page")
            or f"https://en.wikipedia.org/wiki/{quote(title.replace(' ', '_'))}",
            "image": (data.get("originalimage") or data.get("thumbnail") or {}).get("source"),
            "description": data.get("description") or "",
            "source": "wikipedia",
            "license": "CC BY-SA 4.0",
            "publication_dates": None,
        }


def wiki_extract_sentences(title: str, max_chars: int = 6000) -> str:
    with _client() as c:
        r = c.get(
            WIKI_API,
            params={
                "action": "query",
                "prop": "extracts",
                "explaintext": 1,
                "titles": title,
                "format": "json",
                "exchars": max_chars,
            },
        )
        r.raise_for_status()
        pages = r.json().get("query", {}).get("pages", {})
        for page in pages.values():
            return page.get("extract") or ""
    return ""


def ddg_search(query: str, max_results: int = 6) -> list[dict]:
    try:
        from ddgs import DDGS

        rows = []
        with DDGS() as ddgs:
            for item in ddgs.text(query, max_results=max_results):
                rows.append(
                    {
                        "title": item.get("title") or "",
                        "snippet": item.get("body") or item.get("description") or "",
                        "url": item.get("href") or item.get("url") or "",
                        "source": "web",
                        "license": "unknown-page-text-not-copied",
                    }
                )
        return rows
    except Exception as exc:
        log.info("Web search unavailable (%s). Continuing with Wikipedia.", exc)
        return []


def extract_page(url: str) -> str:
    if not url or "wikipedia.org" in url:
        return ""
    try:
        import trafilatura

        downloaded = trafilatura.fetch_url(url)
        if not downloaded:
            return ""
        return (trafilatura.extract(downloaded, include_comments=False) or "")[:4000]
    except Exception:
        return ""


def _split_claims(text: str) -> list[str]:
    parts = re.split(r"(?<=[.!?])\s+", text.strip())
    claims = []
    for p in parts:
        p = p.strip()
        if len(p) < 40:
            continue
        if p.lower().startswith("references"):
            break
        claims.append(p)
        if len(claims) >= 18:
            break
    return claims


def _conflicts(claims: list[dict]) -> list[dict]:
    found = []
    pairs = [("is", "is not"), ("increase", "decrease"), ("always", "never")]
    texts = [c["text"].lower() for c in claims]
    for a, b in pairs:
        has_a = [c for c, t in zip(claims, texts) if re.search(rf"\b{a}\b", t)]
        has_b = [c for c, t in zip(claims, texts) if re.search(rf"\b{b}\b", t)]
        if has_a and has_b and a != b:
            found.append(
                {
                    "topic": f"{a} vs {b}",
                    "a": has_a[0]["text"],
                    "b": has_b[0]["text"],
                }
            )
    return found[:5]


def research_topic(prompt: str, depth: str = "standard") -> dict:
    topic = _topic_from_prompt(prompt)
    sources: list[dict] = []
    claims: list[dict] = []
    uncertainties: list[str] = []

    try:
        hits = wiki_search(topic, limit=5 if depth == "deep" else 3)
    except Exception as exc:
        log.info("Wikipedia search failed: %s", exc)
        hits = []

    extracts = []
    for hit in hits[:4]:
        try:
            summary = wiki_summary(hit["title"])
            extract = wiki_extract_sentences(hit["title"])
            if summary:
                sources.append({**hit, **{k: summary[k] for k in summary if k not in hit}})
            else:
                sources.append(hit)
            text = extract or summary.get("extract") or hit.get("snippet") or ""
            extracts.append(text)
            for sent in _split_claims(text):
                claims.append(
                    {
                        "id": hashlib.sha1(sent.encode()).hexdigest()[:10],
                        "text": sent,
                        "topic": topic,
                        "source": hit["title"],
                        "source_url": hit["url"],
                        "publication_dates": None,
                        "confidence": 0.82 if len(sent) > 60 else 0.6,
                        "license": "CC BY-SA 4.0",
                    }
                )
        except Exception as exc:
            log.info("Wiki page failed for %s: %s", hit.get("title"), exc)

    web = []
    if depth != "none":
        web = ddg_search(topic, max_results=5 if depth == "deep" else 3)
        for item in web:
            sources.append(item)
            if item.get("snippet"):
                claims.append(
                    {
                        "id": hashlib.sha1(item["snippet"].encode()).hexdigest()[:10],
                        "text": item["snippet"],
                        "topic": topic,
                        "source": item.get("title") or "web",
                        "source_url": item.get("url"),
                        "publication_dates": None,
                        "confidence": 0.55,
                        "license": "snippet-fair-use-research",
                        "needs_verification": True,
                    }
                )
            if depth == "deep" and item.get("url"):
                body = extract_page(item["url"])
                for sent in _split_claims(body)[:3]:
                    claims.append(
                        {
                            "id": hashlib.sha1(sent.encode()).hexdigest()[:10],
                            "text": sent,
                            "topic": topic,
                            "source": item.get("title") or "web",
                            "source_url": item.get("url"),
                            "publication_dates": None,
                            "confidence": 0.5,
                            "needs_verification": True,
                        }
                    )

    # Dedup similar claims
    uniq = []
    seen = set()
    for c in claims:
        key = re.sub(r"\W+", " ", c["text"].lower())[:80]
        if key in seen:
            continue
        seen.add(key)
        uniq.append(c)
    claims = uniq[:24]

    if not claims:
        uncertainties.append("No external sources were reachable. The script will stay conservative and avoid invented facts.")
        claims.append(
            {
                "id": "local_1",
                "text": f"The requested topic is: {topic}. Without live sources, only generally accepted framing will be used.",
                "topic": topic,
                "source": "local",
                "source_url": None,
                "confidence": 0.3,
                "needs_verification": True,
            }
        )

    for c in claims:
        if c.get("confidence", 1) < 0.6:
            uncertainties.append(c["text"][:180])

    report_lines = [f"# Research report: {topic}", ""]
    report_lines.append("## Key claims")
    for c in claims[:12]:
        report_lines.append(f"- {c['text']} ({c.get('source')})")
    report_lines.append("")
    report_lines.append("## Sources")
    for s in sources:
        report_lines.append(f"- {s.get('title')}: {s.get('url')} ({s.get('license')})")
    if uncertainties:
        report_lines.append("")
        report_lines.append("## Uncertainties")
        for u in uncertainties[:8]:
            report_lines.append(f"- {u}")

    return {
        "topic": topic,
        "claims": claims,
        "sources": sources,
        "source_urls": [s.get("url") for s in sources if s.get("url")],
        "publication_dates": [s.get("publication_dates") for s in sources],
        "confidence": round(sum(c.get("confidence", 0.5) for c in claims) / max(len(claims), 1), 2),
        "conflicts": _conflicts(claims),
        "uncertainties": uncertainties[:10],
        "report": "\n".join(report_lines),
        "extracts": extracts,
        "attribution": "Includes material from Wikipedia, licensed under CC BY-SA 4.0.",
    }


def commons_images(query: str, limit: int = 4) -> list[dict]:
    try:
        with _client() as c:
            r = c.get(
                COMMONS,
                params={
                    "action": "query",
                    "generator": "search",
                    "gsrsearch": query,
                    "gsrlimit": limit,
                    "gsrnamespace": 6,
                    "prop": "imageinfo",
                    "iiprop": "url|extmetadata|mime|size",
                    "iiurlwidth": 1920,
                    "format": "json",
                },
            )
            r.raise_for_status()
            pages = r.json().get("query", {}).get("pages", {})
            out = []
            for page in pages.values():
                info = (page.get("imageinfo") or [{}])[0]
                meta = info.get("extmetadata") or {}
                license_short = (meta.get("LicenseShortName") or {}).get("value") or "Unknown"
                out.append(
                    {
                        "title": page.get("title"),
                        "url": info.get("thumburl") or info.get("url"),
                        "page_url": f"https://commons.wikimedia.org/wiki/{quote((page.get('title') or '').replace(' ', '_'))}",
                        "license": license_short,
                        "artist": (meta.get("Artist") or {}).get("value"),
                        "attribution_required": "CC" in license_short or "BY" in license_short,
                    }
                )
            return [x for x in out if x.get("url")]
    except Exception as exc:
        log.info("Commons search failed: %s", exc)
        return []
