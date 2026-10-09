export async function uploadForm<T>(path: string, form: FormData): Promise<T> {
  const res = await fetch(path, { method: "POST", body: form });
  const text = await res.text();
  let data: { error?: string } = {};
  try {
    data = text ? (JSON.parse(text) as { error?: string }) : {};
  } catch {
    throw new Error(res.ok ? "unexpected response" : `request failed (${res.status})`);
  }
  if (!res.ok) throw new Error(data.error ?? "request failed");
  return data as T;
}

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  const text = await res.text();
  let data: { error?: string } = {};
  try {
    data = text ? (JSON.parse(text) as { error?: string }) : {};
  } catch {
    throw new Error(res.ok ? "unexpected response" : `request failed (${res.status})`);
  }
  if (!res.ok) throw new Error(data.error ?? "request failed");
  return data as T;
}
