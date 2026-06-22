export function toArray<T>(payload: unknown, fallbackKeys: string[] = []): T[] {
  if (!payload) {
    return [];
  }
  if (Array.isArray(payload)) {
    return payload as T[];
  }

  if (typeof payload === "string" || typeof payload === "number" || typeof payload === "boolean") {
    return [];
  }
  if (typeof payload !== "object") {
    return [];
  }

  const keys = fallbackKeys.length > 0 ? fallbackKeys : ["data", "products", "items", "payload", "results", "reviews", "versions", "categories"];
  const candidate = payload as Record<string, unknown>;

  for (const key of keys) {
    const value = candidate[key];
    if (Array.isArray(value)) {
      return value as T[];
    }
  }

  const data = candidate.data;
  if (data && typeof data === "object" && !Array.isArray(data)) {
    const nested = data as Record<string, unknown>;
    for (const key of keys) {
      const value = nested[key];
      if (Array.isArray(value)) {
        return value as T[];
      }
    }

    if (Array.isArray((nested as Record<string, unknown>).items)) {
      return (nested as Record<string, unknown>).items as T[];
    }
  }

  if (Array.isArray((candidate as Record<string, unknown>).results)) {
    return (candidate as Record<string, unknown>).results as T[];
  }

  return [];
}

export function unwrapData<T>(payload: unknown): T | null {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  if ("data" in (payload as Record<string, unknown>)) {
    return (payload as Record<string, unknown>).data as T;
  }
  return payload as T;
}
