import type { ToodledoClient } from "./client.js";
import type { ToodledoGoal } from "../types.js";

export async function getGoals(client: ToodledoClient): Promise<ToodledoGoal[]> {
  return client.refreshGoals();
}

export async function addGoal(
  client: ToodledoClient,
  name: string,
  level?: number,
  contributes?: number
): Promise<ToodledoGoal> {
  const body: Record<string, string> = { name };
  if (level !== undefined) body.level = String(level);
  if (contributes !== undefined) body.contributes = String(contributes);

  const data = (await client.post("/goals/add.php", body)) as ToodledoGoal[];
  await client.refreshGoals();
  return data[0]!;
}

export async function editGoal(
  client: ToodledoClient,
  id: number,
  updates: { name?: string; level?: number; archived?: boolean; contributes?: number }
): Promise<ToodledoGoal> {
  const body: Record<string, string> = { id: String(id) };
  if (updates.name !== undefined) body.name = updates.name;
  if (updates.level !== undefined) body.level = String(updates.level);
  if (updates.archived !== undefined) body.archived = updates.archived ? "1" : "0";
  if (updates.contributes !== undefined) body.contributes = String(updates.contributes);

  const data = (await client.post("/goals/edit.php", body)) as ToodledoGoal[];
  await client.refreshGoals();
  return data[0]!;
}

export async function deleteGoal(
  client: ToodledoClient,
  id: number
): Promise<void> {
  await client.post("/goals/delete.php", { id: String(id) });
  await client.refreshGoals();
}
