export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public fieldErrors: Record<string, string> = {},
  ) {
    super(message);
  }
}
export async function api<T>(
  path: string,
  options: { method?: string; body?: unknown; signal?: AbortSignal } = {},
): Promise<T> {
  const response = await fetch("/api" + path, {
    method: options.method || "GET",
    credentials: "same-origin",
    headers:
      options.body !== undefined ? { "Content-Type": "application/json" } : {},
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    signal: options.signal,
  });
  const data = await response.json();
  if (!response.ok)
    throw new ApiError(
      data.error || "The request failed.",
      response.status,
      data.fieldErrors,
    );
  return data as T;
}
export function message(error: unknown) {
  return error instanceof Error ? error.message : "The action failed.";
}
