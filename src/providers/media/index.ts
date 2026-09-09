import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { config, secret } from "../../config/index.js";
import { cache, cacheKey } from "../../cache/index.js";
import { fetchJson, ProviderError } from "../errors.js";
import type { LicensedAsset, MediaKind, ScenePlan } from "../../types/index.js";

export interface MediaHit {
  title: string;
  creator: string;
  url: string;
  downloadUrl: string;
  thumbUrl?: string;
  license: string;
  attribution: string;
  kind: MediaKind;
  width: number;
  height: number;
  durationSec?: number;
  source: string;
}

const UA = { "user-agent": config.userAgent };

export function run(cmd: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: ["ignore", "pipe", "pipe"] });
    let err = "";
    child.stderr.on("data", (d) => (err += d.toString()));
    child.on("close", (code) => (code === 0 ? resolve() : reject(new Error(`${cmd} ${code}: ${err.slice(-800)}`))));
  });
}

export async function searchWikimedia(query: string, orientation: "landscape" | "portrait" | "square"): Promise<MediaHit[]> {
  const key = cacheKey(["wm", query, orientation]);
  const hit = cache.get<MediaHit[]>(key);
  if (hit) return hit;
  const params = new URLSearchParams({
    action: "query",
    generator: "search",
    gsrsearch: `${query} filetype:bitmap`,
    gsrnamespace: "6",
    gsrlimit: "12",
    prop: "imageinfo",
    iiprop: "url|extmetadata|size|mime",
    iiurlwidth: "1280",
    format: "json",
  });
  try {
    const data = await fetchJson(`https://commons.wikimedia.org/w/api.php?${params}`, { headers: UA });
    const pages = Object.values(data.query?.pages ?? {}) as any[];
    const hits: MediaHit[] = [];
    for (const p of pages) {
      const info = p.imageinfo?.[0];
      if (!info?.url) continue;
      const mime = String(info.mime ?? "");
      if (!mime.startsWith("image/")) continue;
      const meta = info.extmetadata ?? {};
      const artist = String(meta.Artist?.value ?? "Wikimedia contributor").replace(/<[^>]+>/g, "");
      const license = String(meta.LicenseShortName?.value ?? meta.UsageTerms?.value ?? "see Commons");
      hits.push({
        title: p.title ?? query,
        creator: artist,
        url: info.descriptionurl ?? info.url,
        downloadUrl: info.thumburl || info.url,
        thumbUrl: info.thumburl,
        license,
        attribution: `${artist} — ${license} — Wikimedia Commons`,
        kind: license.toLowerCase().includes("public domain") || license.toLowerCase().includes("cc0") ? "public_domain" : "stock_image",
        width: info.width ?? 1280,
        height: info.height ?? 720,
        source: "wikimedia",
      });
    }
    cache.set(key, "media", hits, 24 * 60 * 60 * 1000);
    return hits;
  } catch {
    return [];
  }
}

export async function searchPexels(query: string, kind: "video" | "photo", orientation: string): Promise<MediaHit[]> {
  const key = secret("PEXELS_API_KEY") || config.pexelsApiKey;
  if (!key) return [];
  const ck = cacheKey(["pexels", query, kind, orientation]);
  const cached = cache.get<MediaHit[]>(ck);
  if (cached) return cached;
  const header = { ...UA, Authorization: key };
  try {
    if (kind === "video") {
      const data = await fetchJson(
        `https://api.pexels.com/v1/videos/search?${new URLSearchParams({ query, per_page: "8", orientation })}`,
        { headers: header },
      );
      const hits: MediaHit[] = (data.videos ?? []).map((v: any) => {
        const file = (v.video_files ?? []).sort((a: any, b: any) => (b.width ?? 0) - (a.width ?? 0)).find((f: any) => (f.width ?? 0) <= 1920) ?? v.video_files?.[0];
        return {
          title: `Pexels video ${v.id}`,
          creator: v.user?.name ?? "Pexels contributor",
          url: v.url,
          downloadUrl: file?.link,
          thumbUrl: v.image,
          license: "Pexels License",
          attribution: `Video by ${v.user?.name ?? "contributor"} on Pexels`,
          kind: "stock_video" as const,
          width: file?.width ?? 1280,
          height: file?.height ?? 720,
          durationSec: v.duration,
          source: "pexels",
        };
      });
      cache.set(ck, "media", hits, 24 * 60 * 60 * 1000);
      return hits;
    }
    const data = await fetchJson(
      `https://api.pexels.com/v1/search?${new URLSearchParams({ query, per_page: "8", orientation })}`,
      { headers: header },
    );
    const hits: MediaHit[] = (data.photos ?? []).map((p: any) => ({
      title: p.alt || `Pexels photo ${p.id}`,
      creator: p.photographer,
      url: p.url,
      downloadUrl: p.src?.large2x || p.src?.large,
      thumbUrl: p.src?.medium,
      license: "Pexels License",
      attribution: `Photo by ${p.photographer} on Pexels`,
      kind: "stock_image" as const,
      width: p.width,
      height: p.height,
      source: "pexels",
    }));
    cache.set(ck, "media", hits, 24 * 60 * 60 * 1000);
    return hits;
  } catch (e) {
    throw new ProviderError(String(e), "pexels", "PROVIDER_FAILURE", true);
  }
}

export async function searchPixabay(query: string, kind: "video" | "photo"): Promise<MediaHit[]> {
  const key = secret("PIXABAY_API_KEY") || config.pixabayApiKey;
  if (!key) return [];
  const ck = cacheKey(["pixabay", query, kind]);
  const cached = cache.get<MediaHit[]>(ck);
  if (cached) return cached;
  const endpoint = kind === "video" ? "https://pixabay.com/api/videos/" : "https://pixabay.com/api/";
  const data = await fetchJson(`${endpoint}?${new URLSearchParams({ key, q: query, per_page: "8", safesearch: "true" })}`, { headers: UA });
  const hits: MediaHit[] = (data.hits ?? []).map((h: any) => {
    const videoUrl = h.videos?.medium?.url || h.videos?.small?.url;
    return {
      title: h.tags || `Pixabay ${h.id}`,
      creator: h.user,
      url: h.pageURL,
      downloadUrl: videoUrl || h.largeImageURL || h.webformatURL,
      thumbUrl: h.previewURL,
      license: "Pixabay Content License",
      attribution: `${kind === "video" ? "Video" : "Image"} by ${h.user} on Pixabay`,
      kind: kind === "video" ? "stock_video" : "stock_image",
      width: h.webformatWidth || h.videos?.medium?.width || 1280,
      height: h.webformatHeight || h.videos?.medium?.height || 720,
      durationSec: h.duration,
      source: "pixabay",
    };
  });
  cache.set(ck, "media", hits, 24 * 60 * 60 * 1000);
  return hits;
}

const PALETTES = [
  ["0a1628", "1b3a4b", "c45c26"],
  ["1a0a00", "5c3317", "d4a017"],
  ["0b1320", "1c3d2e", "7d9a6a"],
  ["140018", "3d1a4a", "e07a5f"],
  ["0d1b2a", "1b263b", "778da9"],
];

export async function proceduralStill(opts: {
  outPath: string;
  title: string;
  subtitle: string;
  index: number;
  width: number;
  height: number;
}): Promise<void> {
  const [a, b, c] = PALETTES[opts.index % PALETTES.length];
  const font = config.fontFile;
  const title = opts.title.replace(/[:\\]/g, " ").slice(0, 48);
  const sub = opts.subtitle.replace(/[:\\]/g, " ").slice(0, 70);
  fs.mkdirSync(path.dirname(opts.outPath), { recursive: true });
  try {
    await run("ffmpeg", [
      "-y",
      "-f",
      "lavfi",
      "-i",
      `color=c=0x${a}:s=${opts.width}x${opts.height}:d=1`,
      "-vf",
      [
        `geq=r='${parseInt(a.slice(0, 2), 16)}+${parseInt(b.slice(0, 2), 16) - parseInt(a.slice(0, 2), 16)}*(X/${opts.width})':g='${parseInt(a.slice(2, 4), 16)}+40*sin(X/80)':b='${parseInt(a.slice(4, 6), 16)}+${parseInt(c.slice(4, 6), 16) / 4}'`,
        `noise=alls=12:allf=t`,
        `drawbox=x=80:y=${opts.height - 220}:w=${opts.width - 160}:h=4:color=0x${c}:t=fill`,
        `drawtext=fontfile=${font}:text='${escDraw(title)}':fontcolor=white:fontsize=48:x=80:y=${opts.height - 200}`,
        `drawtext=fontfile=${config.fontRegular}:text='${escDraw(sub)}':fontcolor=0xdddddd:fontsize=22:x=80:y=${opts.height - 130}`,
      ].join(","),
      "-frames:v",
      "1",
      opts.outPath,
    ]);
  } catch {
    await run("ffmpeg", [
      "-y",
      "-f",
      "lavfi",
      "-i",
      `color=c=0x${a}:s=${opts.width}x${opts.height}:d=1`,
      "-vf",
      `drawbox=x=60:y=${Math.max(40, opts.height - 180)}:w=${opts.width - 120}:h=6:color=0x${c}:t=fill,drawtext=fontfile=${font}:text='${escDraw(title)}':fontcolor=white:fontsize=36:x=60:y=${Math.max(80, opts.height - 150)}`,
      "-frames:v",
      "1",
      opts.outPath,
    ]);
  }
}

function escDraw(s: string): string {
  return s.replace(/\\/g, "/").replace(/'/g, "’").replace(/:/g, " —").replace(/%/g, "pct");
}

export function scoreHit(hit: MediaHit, scene: ScenePlan, aspect: "16:9" | "9:16" | "1:1"): number {
  let score = 50;
  const text = `${hit.title} ${hit.creator}`.toLowerCase();
  for (const kw of scene.visualKeywords) {
    if (text.includes(kw.toLowerCase())) score += 8;
  }
  const ratio = hit.width / Math.max(1, hit.height);
  const want = aspect === "9:16" ? 9 / 16 : aspect === "1:1" ? 1 : 16 / 9;
  score += Math.max(0, 20 - Math.abs(ratio - want) * 20);
  if (hit.width >= 1280) score += 10;
  if (hit.kind === "stock_video") score += 6;
  if (hit.license.toLowerCase().includes("public domain") || hit.license.toLowerCase().includes("cc0")) score += 4;
  return Math.min(100, score);
}

export async function downloadTo(url: string, dest: string): Promise<void> {
  const ck = cacheKey(["dl", url]);
  const cached = cache.getPath(ck);
  if (cached) {
    fs.copyFileSync(cached, dest);
    return;
  }
  const res = await fetch(url, { headers: UA });
  if (!res.ok) throw new Error(`download ${res.status} ${url}`);
  const buf = Buffer.from(await res.arrayBuffer());
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, buf);
  const cachePath = path.join(cache.fileDir("downloads"), `${ck}${path.extname(dest) || ".bin"}`);
  fs.copyFileSync(dest, cachePath);
  cache.set(ck, "download", { url }, 7 * 24 * 60 * 60 * 1000, cachePath);
}

export async function gatherCandidates(scene: ScenePlan, aspect: "16:9" | "9:16" | "1:1"): Promise<MediaHit[]> {
  const q = scene.visualKeywords.slice(0, 4).join(" ") || scene.visualObjective;
  const orientation = aspect === "9:16" ? "portrait" : aspect === "1:1" ? "square" : "landscape";
  const all: MediaHit[] = [];
  if (!config.offlineMode && !config.demoMode) {
    try {
      all.push(...(await searchPexels(q, "video", orientation)));
    } catch {
      /* failover */
    }
    try {
      all.push(...(await searchPexels(q, "photo", orientation)));
    } catch {
      /* failover */
    }
    try {
      all.push(...(await searchPixabay(q, "video")));
    } catch {
      /* failover */
    }
    try {
      all.push(...(await searchPixabay(q, "photo")));
    } catch {
      /* failover */
    }
    try {
      all.push(...(await searchWikimedia(q, orientation as "landscape")));
    } catch {
      /* failover */
    }
  } else if (!config.offlineMode) {
    try {
      all.push(...(await searchWikimedia(q, orientation as "landscape")));
    } catch {
      /* ignore in demo */
    }
  }
  return all.sort((a, b) => scoreHit(b, scene, aspect) - scoreHit(a, scene, aspect));
}
