import type { ToodledoClient } from "./client.js";
import type { ToodledoContext } from "../types.js";

export async function getContexts(client: ToodledoClient): Promise<ToodledoContext[]> {
  return client.refreshContexts();
}

export async function addContext(
  client: ToodledoClient,
  name: string
): Promise<ToodledoContext> {
  const data = (await client.post("/contexts/add.php", { name })) as ToodledoContext[];
  await client.refreshContexts();
  return data[0]!;
}

export async function editContext(
  client: ToodledoClient,
  id: number,
  name: string
): Promise<ToodledoContext> {
  const data = (await client.post("/contexts/edit.php", {
    id: String(id),
    name,
  })) as ToodledoContext[];
  await client.refreshContexts();
  return data[0]!;
}

export async function deleteContext(
  client: ToodledoClient,
  id: number
): Promise<void> {
  await client.post("/contexts/delete.php", { id: String(id) });
  await client.refreshContexts();
}
