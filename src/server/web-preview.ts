/** Hostnames Cursor uses to proxy the desk into Webpage / internal browser. */
export const PREVIEW_DEV_ORIGINS = [
  "cursor.com",
  "*.cursor.com",
  "**.cursor.com",
  "*.cursor.sh",
  "**.cursor.sh",
  "*.cursorusercontent.com",
  "**.cursorusercontent.com",
];

const CSP_BASE =
  "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self'";

/** Cursor's Webpage control embeds the desk in a frame. Random sites stay blocked. */
export const FRAME_ANCESTORS =
  "frame-ancestors 'self' https://cursor.com https://*.cursor.com https://*.cursor.sh https://*.cursorusercontent.com vscode-webview: vscode-file:";

export function appContentSecurityPolicy(): string {
  return `${CSP_BASE}; ${FRAME_ANCESTORS}`;
}
