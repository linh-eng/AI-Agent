// Tiện ích gọi API phía client — ném lỗi kèm message tiếng Việt từ server.
export async function apiFetch<T = any>(
  url: string,
  options?: RequestInit
): Promise<T> {
  const res = await fetch(url, {
    ...options,
    headers: { "Content-Type": "application/json", ...(options?.headers ?? {}) },
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const detail =
      json?.details && typeof json.details === "object"
        ? " — " +
          Object.entries(json.details)
            .map(([k, v]) => `${k}: ${(v as string[]).join(", ")}`)
            .join("; ")
        : "";
    throw new Error((json?.error ?? "Có lỗi xảy ra") + detail);
  }
  return json.data as T;
}
