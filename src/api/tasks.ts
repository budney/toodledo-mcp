import type { ToodledoClient } from "./client.js";
import type { ToodledoTask } from "../types.js";

const TASK_FIELDS =
  "folder,context,goal,location,tag,status,priority,star,duedate,duedatemod,startdate,duetime,starttime,remind,repeat,length,note,parent,children,added,timer,meta";

export interface GetTasksOptions {
  comp?: number; // -1=both, 0=incomplete (default), 1=completed
  before?: number; // unix timestamp
  after?: number; // unix timestamp
  id?: number; // single task by ID
  start?: number; // pagination offset
  num?: number; // max results (default 1000)
}

export async function getTasks(
  client: ToodledoClient,
  options: GetTasksOptions = {}
): Promise<ToodledoTask[]> {
  const params: Record<string, string> = {
    fields: TASK_FIELDS,
  };

  if (options.comp !== undefined) params.comp = String(options.comp);
  if (options.before !== undefined) params.before = String(options.before);
  if (options.after !== undefined) params.after = String(options.after);
  if (options.id !== undefined) params.id = String(options.id);
  if (options.start !== undefined) params.start = String(options.start);
  if (options.num !== undefined) params.num = String(options.num);

  const data = (await client.get("/tasks/get.php", params)) as Array<
    Record<string, unknown>
  >;

  // First element is metadata {num, total}, skip it
  if (data.length > 0 && "num" in data[0] && "total" in data[0]) {
    return data.slice(1) as unknown as ToodledoTask[];
  }

  return data as unknown as ToodledoTask[];
}

export async function addTask(
  client: ToodledoClient,
  task: Record<string, unknown>
): Promise<ToodledoTask> {
  const data = (await client.post("/tasks/add.php", {
    tasks: JSON.stringify([task]),
  })) as ToodledoTask[];

  return data[0]!;
}

export async function editTask(
  client: ToodledoClient,
  id: number,
  updates: Record<string, unknown>
): Promise<ToodledoTask> {
  const data = (await client.post("/tasks/edit.php", {
    tasks: JSON.stringify([{ id, ...updates }]),
  })) as ToodledoTask[];

  return data[0]!;
}

export async function deleteTask(
  client: ToodledoClient,
  id: number
): Promise<void> {
  await client.post("/tasks/delete.php", {
    tasks: JSON.stringify([id]),
  });
}
