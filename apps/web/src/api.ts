export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path.startsWith("/api/") ? path : "/api/v1" + path, {
    credentials: "same-origin",
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  if (!res.ok) {
    const data = await res
      .json()
      .catch(() => ({ detail: "The server could not be reached." }));
    throw new ApiError(
      typeof data.detail === "string"
        ? data.detail
        : `Request rejected (${res.status}). Check the selected settings.`,
      res.status,
    );
  }
  return res.json();
}
export const post = <T>(path: string, data: unknown) =>
  api<T>(path, { method: "POST", body: JSON.stringify(data) });
export function download(value: unknown, name: string) {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(value, null, 2)], { type: "application/json" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function dateLabel(value: string | null, year = false) {
  return value
    ? new Date(value.slice(0, 10) + "T12:00:00").toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        ...(year ? { year: "numeric" } : {}),
      })
    : "Sequence only";
}
