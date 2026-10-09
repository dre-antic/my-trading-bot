import { describe, expect, it } from "vitest";
import { appContentSecurityPolicy, FRAME_ANCESTORS, PREVIEW_DEV_ORIGINS } from "@/server/web-preview";

describe("web preview headers", () => {
  it("allows Cursor Webpage / internal browser to embed the desk", () => {
    const csp = appContentSecurityPolicy();
    expect(csp).toContain("frame-ancestors");
    expect(csp).toContain("https://*.cursor.com");
    expect(csp).not.toMatch(/frame-ancestors 'none'/);
    expect(FRAME_ANCESTORS).toContain("vscode-webview:");
  });

  it("lists Cursor proxy hostnames for the Next.js dev origin allowlist", () => {
    expect(PREVIEW_DEV_ORIGINS).toContain("**.cursor.com");
    expect(PREVIEW_DEV_ORIGINS).toContain("**.cursorusercontent.com");
  });
});
