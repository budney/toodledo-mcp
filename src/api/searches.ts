import type { ToodledoClient } from "./client.js";
import type { ToodledoSavedSearch, ToodledoSearchRule } from "../types.js";

function objectToArray<T>(obj: Record<string, unknown>): T[] {
  return Object.keys(obj)
    .sort((a, b) => Number(a) - Number(b))
    .map((k) => obj[k] as T);
}

function normalizeSearch(raw: Record<string, unknown>): ToodledoSavedSearch {
  if (typeof raw.id !== "number")
    throw new Error(`Saved search missing numeric id (got ${JSON.stringify(raw.id)})`);
  if (typeof raw.name !== "string")
    throw new Error(`Saved search ${raw.id} missing string name`);
  if (raw.bool !== "All" && raw.bool !== "Any")
    throw new Error(`Saved search ${raw.id} has unexpected bool value: ${JSON.stringify(raw.bool)}`);
  if (!raw.search || typeof raw.search !== "object" || Array.isArray(raw.search))
    throw new Error(`Saved search ${raw.id} ("${raw.name}") has missing or invalid search field`);

  const search: Record<string, ToodledoSearchRule[]> = {};
  for (const [key, val] of Object.entries(raw.search as Record<string, unknown>)) {
    if (!val || typeof val !== "object" || Array.isArray(val))
      throw new Error(`Saved search ${raw.id} ("${raw.name}") group "${key}" is not an object`);
    search[key] = objectToArray<ToodledoSearchRule>(val as Record<string, unknown>);
  }
  return {
    id: raw.id,
    name: raw.name,
    bool: raw.bool,
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
