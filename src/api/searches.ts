import type { ToodledoClient } from "./client.js";
import type { ToodledoSavedSearch, ToodledoSearchRule } from "../types.js";

function objectToArray<T>(obj: Record<string, unknown>): T[] {
  return Object.keys(obj)
    .sort((a, b) => Number(a) - Number(b))
    .map((k) => obj[k] as T);
}

function normalizeSearch(raw: Record<string, unknown>): ToodledoSavedSearch {
  const search: Record<string, ToodledoSearchRule[]> = {};
  for (const [key, val] of Object.entries(raw.search as Record<string, unknown>)) {
    search[key] = objectToArray<ToodledoSearchRule>(val as Record<string, unknown>);
  }
  return {
    id: raw.id as number,
    name: raw.name as string,
    bool: raw.bool as "All" | "Any",
    search,
  };
}

export async function getSavedSearches(
  client: ToodledoClient
): Promise<ToodledoSavedSearch[]> {
  const data = await client.get("/tasks/search.php");
  if (!data || typeof data !== "object" || Array.isArray(data)) return [];
  return objectToArray<Record<string, unknown>>(data as Record<string, unknown>)
    .map(normalizeSearch);
}
