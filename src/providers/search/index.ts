import fs from "node:fs";
import path from "node:path";
import { config } from "../../config/index.js";
import { cache, cacheKey } from "../../cache/index.js";
import { fetchJson } from "../errors.js";
import type { SourceRecord } from "../../types/index.js";

export interface SearchHit {
  title: string;
  url: string;
  snippet: string;
  publisher: string;
  tier: 1 | 2 | 3;
}

const UA = { "user-agent": config.userAgent, accept: "application/json" };

function rankUrl(url: string): 1 | 2 | 3 {
  const u = url.toLowerCase();
  if (
    u.includes(".gov") ||
    u.includes(".edu") ||
    u.includes("wikipedia.org") ||
    u.includes("wikidata.org") ||
    u.includes("archive.org") ||
    u.includes("loc.gov") ||
    u.includes("unesco.org") ||
    u.includes("who.int") ||
    u.includes("un.org")
  )
    return 1;
  if (u.includes("bbc.") || u.includes("nytimes") || u.includes("reuters") || u.includes("theguardian") || u.includes("smithsonian") || u.includes("britannica"))
    return 2;
  return 3;
}

export async function wikipediaSearch(query: string): Promise<SearchHit[]> {
  const key = cacheKey(["wiki-search", query]);
  const hit = cache.get<SearchHit[]>(key);
  if (hit) return hit;
  const url = `https://en.wikipedia.org/w/api.php?${new URLSearchParams({
    action: "query",
    list: "search",
    srsearch: query,
    srlimit: "8",
    format: "json",
    utf8: "1",
  })}`;
  const data = await fetchJson(url, { headers: UA, timeoutMs: 15_000 });
  const hits: SearchHit[] = (data.query?.search ?? []).map((row: { title: string; snippet: string }) => ({
    title: row.title,
    url: `https://en.wikipedia.org/wiki/${encodeURIComponent(row.title.replace(/ /g, "_"))}`,
    snippet: String(row.snippet ?? "").replace(/<[^>]+>/g, ""),
    publisher: "Wikipedia",
    tier: 1 as const,
  }));
  cache.set(key, "search", hits, 12 * 60 * 60 * 1000);
  return hits;
}

export async function wikipediaExtract(title: string): Promise<{ extract: string; url: string; title: string }> {
  const key = cacheKey(["wiki-extract", title]);
  const hit = cache.get<{ extract: string; url: string; title: string }>(key);
  if (hit) return hit;
  const url = `https://en.wikipedia.org/w/api.php?${new URLSearchParams({
    action: "query",
    prop: "extracts",
    explaintext: "1",
    titles: title,
    format: "json",
    redirects: "1",
    exchars: "1800",
  })}`;
  const data = await fetchJson(url, { headers: UA });
  const pages = data.query?.pages ?? {};
  const page = Object.values(pages)[0] as { title?: string; extract?: string; missing?: boolean } | undefined;
  const result = {
    title: page?.title ?? title,
    url: `https://en.wikipedia.org/wiki/${encodeURIComponent((page?.title ?? title).replace(/ /g, "_"))}`,
    extract: page?.extract ?? "",
  };
  cache.set(key, "search", result, 12 * 60 * 60 * 1000);
  return result;
}

export async function wikidataSearch(query: string): Promise<SearchHit[]> {
  const key = cacheKey(["wd", query]);
  const hit = cache.get<SearchHit[]>(key);
  if (hit) return hit;
  try {
    const url = `https://www.wikidata.org/w/api.php?${new URLSearchParams({
      action: "wbsearchentities",
      search: query,
      language: "en",
      format: "json",
      limit: "5",
    })}`;
    const data = await fetchJson(url, { headers: UA });
    const hits: SearchHit[] = (data.search ?? []).map((row: { label: string; description?: string; concepturi?: string }) => ({
      title: row.label,
      url: row.concepturi ?? `https://www.wikidata.org/wiki/${row.label}`,
      snippet: row.description ?? "",
      publisher: "Wikidata",
      tier: 1 as const,
    }));
    cache.set(key, "search", hits, 12 * 60 * 60 * 1000);
    return hits;
  } catch {
    return [];
  }
}

const DEMO_PACK: Record<string, SearchHit[]> = {
  default: [
    {
      title: "Jamaican music",
      url: "https://en.wikipedia.org/wiki/Music_of_Jamaica",
      snippet: "The music of Jamaica includes mento, ska, rocksteady, reggae, dub, dancehall and their international descendants.",
      publisher: "Wikipedia",
      tier: 1,
    },
    {
      title: "Reggae",
      url: "https://en.wikipedia.org/wiki/Reggae",
      snippet: "Reggae originated in Jamaica in the late 1960s and was popularized internationally in the 1970s.",
      publisher: "Wikipedia",
      tier: 1,
    },
  ],
};

export async function searchTopic(topic: string, questions: string[]): Promise<SourceRecord[]> {
  if (config.offlineMode) {
    return DEMO_PACK.default.map((h, i) => ({
      id: `src_${i + 1}`,
      title: h.title,
      url: h.url,
      publisher: h.publisher,
      tier: h.tier,
      excerpt: h.snippet,
      retrievedAt: new Date().toISOString(),
      license: "CC BY-SA 4.0 (Wikipedia text)",
    }));
  }

  const queries = [topic, ...questions.slice(0, 4)];
  const seen = new Set<string>();
  const sources: SourceRecord[] = [];
  for (const q of queries) {
    try {
      const hits = await wikipediaSearch(q);
      for (const h of hits.slice(0, 3)) {
        if (seen.has(h.url)) continue;
        seen.add(h.url);
        const extract = await wikipediaExtract(h.title).catch(() => ({ extract: h.snippet, url: h.url, title: h.title }));
        sources.push({
          id: `src_${sources.length + 1}`,
          title: extract.title,
          url: extract.url,
          publisher: "Wikipedia",
          tier: 1,
          excerpt: extract.extract || h.snippet,
          retrievedAt: new Date().toISOString(),
          license: "CC BY-SA 4.0",
        });
      }
    } catch {
      /* next query */
    }
    try {
      for (const h of await wikidataSearch(q)) {
        if (seen.has(h.url)) continue;
        seen.add(h.url);
        sources.push({
          id: `src_${sources.length + 1}`,
          title: h.title,
          url: h.url,
          publisher: h.publisher,
          tier: h.tier,
          excerpt: h.snippet,
          retrievedAt: new Date().toISOString(),
          license: "CC0",
        });
      }
    } catch {
      /* ignore */
    }
  }
  if (!sources.length) {
    return DEMO_PACK.default.map((h, i) => ({
      id: `src_${i + 1}`,
      title: h.title,
      url: h.url,
      publisher: h.publisher,
      tier: h.tier,
      excerpt: h.snippet,
      retrievedAt: new Date().toISOString(),
      license: "CC BY-SA 4.0",
    }));
  }
  return sources.slice(0, 12);
}

/** Brave Search adapter — optional, never used without a key, never scraped. */
export async function braveSearch(query: string): Promise<SearchHit[]> {
  const key = process.env.BRAVE_API_KEY || "";
  if (!key) return [];
  const ck = cacheKey(["brave", query]);
  const cached = cache.get<SearchHit[]>(ck);
  if (cached) return cached;
  const data = await fetchJson(`https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}`, {
    headers: { ...UA, "X-Subscription-Token": key, accept: "application/json" },
  });
  const hits: SearchHit[] = (data.web?.results ?? []).slice(0, 8).map((r: { title: string; url: string; description?: string }) => ({
    title: r.title,
    url: r.url,
    snippet: r.description ?? "",
    publisher: new URL(r.url).hostname,
    tier: rankUrl(r.url),
  }));
  cache.set(ck, "search", hits, 6 * 60 * 60 * 1000);
  return hits;
}

export function writeSourcesFile(dir: string, sources: SourceRecord[]): void {
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "sources.json"), JSON.stringify(sources, null, 2));
}
