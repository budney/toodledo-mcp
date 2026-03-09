import type { ToodledoClient } from "./client.js";
import type { ToodledoFolder } from "../types.js";

export async function getFolders(client: ToodledoClient): Promise<ToodledoFolder[]> {
  return client.refreshFolders();
}

export async function addFolder(
  client: ToodledoClient,
  name: string,
  isPrivate?: boolean
): Promise<ToodledoFolder> {
  const body: Record<string, string> = { name };
  if (isPrivate !== undefined) body.private = isPrivate ? "1" : "0";

  const data = (await client.post("/folders/add.php", body)) as ToodledoFolder[];
  await client.refreshFolders(); // update cache
  return data[0]!;
}

export async function editFolder(
  client: ToodledoClient,
  id: number,
  updates: { name?: string; archived?: boolean }
): Promise<ToodledoFolder> {
  const body: Record<string, string> = { id: String(id) };
  if (updates.name !== undefined) body.name = updates.name;
  if (updates.archived !== undefined) body.archived = updates.archived ? "1" : "0";

  const data = (await client.post("/folders/edit.php", body)) as ToodledoFolder[];
  await client.refreshFolders();
  return data[0]!;
}

export async function deleteFolder(
  client: ToodledoClient,
  id: number
): Promise<void> {
  await client.post("/folders/delete.php", { id: String(id) });
  await client.refreshFolders();
}
