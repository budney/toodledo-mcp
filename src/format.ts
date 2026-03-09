import type { ToodledoClient } from "./api/client.js";
import type { ToodledoTask, ToodledoFolder, ToodledoContext, ToodledoGoal } from "./types.js";
import { STATUS_MAP, PRIORITY_MAP } from "./types.js";

function formatDate(timestamp: number): string {
  if (!timestamp) return "";
  const d = new Date(timestamp * 1000);
  return d.toISOString().split("T")[0]!;
}

function formatDateTime(timestamp: number): string {
  if (!timestamp) return "";
  const d = new Date(timestamp * 1000);
  return d.toISOString().replace("T", " ").substring(0, 16);
}

export function formatTask(task: ToodledoTask, client: ToodledoClient): string {
  const star = task.star ? "[*] " : "    ";
  const completed = task.completed ? "[x] " : star;
  const lines: string[] = [];

  lines.push(`${completed}${task.title} (ID: ${task.id})`);

  const meta: string[] = [];
  if (task.folder) meta.push(`Folder: ${client.getFolderName(task.folder)}`);
  if (task.context) meta.push(`Context: ${client.getContextName(task.context)}`);
  if (task.goal) meta.push(`Goal: ${client.getGoalName(task.goal)}`);
  meta.push(`Priority: ${PRIORITY_MAP[task.priority] ?? "Low"}`);
  meta.push(`Status: ${STATUS_MAP[task.status] ?? "None"}`);
  lines.push(`    ${meta.join(" | ")}`);

  const dates: string[] = [];
  if (task.duedate) dates.push(`Due: ${formatDate(task.duedate)}`);
  if (task.startdate) dates.push(`Start: ${formatDate(task.startdate)}`);
  if (task.duetime) dates.push(`Due time: ${formatDateTime(task.duetime)}`);
  if (task.length) dates.push(`Duration: ${task.length}min`);
  if (task.tag) dates.push(`Tags: ${task.tag}`);
  if (task.completed) dates.push(`Completed: ${formatDate(task.completed)}`);
  if (dates.length) lines.push(`    ${dates.join(" | ")}`);

  if (task.note) {
    const notePreview = task.note.length > 200
      ? task.note.substring(0, 200) + "..."
      : task.note;
    lines.push(`    Note: ${notePreview}`);
  }

  if (task.parent) lines.push(`    Parent task ID: ${task.parent}`);
  if (task.children) lines.push(`    Subtasks: ${task.children}`);

  return lines.join("\n");
}

export function formatTaskList(tasks: ToodledoTask[], client: ToodledoClient): string {
  if (tasks.length === 0) return "No tasks found.";
  return tasks.map((t) => formatTask(t, client)).join("\n\n");
}

export function formatFolders(folders: ToodledoFolder[]): string {
  if (folders.length === 0) return "No folders found.";
  return folders
    .filter((f) => !f.archived)
    .sort((a, b) => a.ord - b.ord)
    .map((f) => `- ${f.name} (ID: ${f.id})${f.private ? " [private]" : ""}`)
    .join("\n");
}

export function formatFoldersWithArchived(folders: ToodledoFolder[]): string {
  const active = folders.filter((f) => !f.archived).sort((a, b) => a.ord - b.ord);
  const archived = folders.filter((f) => f.archived);

  let result = "**Active Folders:**\n";
  result += active.length
    ? active.map((f) => `- ${f.name} (ID: ${f.id})`).join("\n")
    : "None";

  if (archived.length) {
    result += "\n\n**Archived Folders:**\n";
    result += archived.map((f) => `- ${f.name} (ID: ${f.id})`).join("\n");
  }

  return result;
}

export function formatContexts(contexts: ToodledoContext[]): string {
  if (contexts.length === 0) return "No contexts found.";
  return contexts
    .map((c) => `- ${c.name} (ID: ${c.id})`)
    .join("\n");
}

export function formatGoals(goals: ToodledoGoal[]): string {
  if (goals.length === 0) return "No goals found.";

  const levels = ["Lifetime", "Long-term", "Short-term"];
  const grouped = new Map<number, ToodledoGoal[]>();

  for (const g of goals) {
    if (g.archived) continue;
    const list = grouped.get(g.level) ?? [];
    list.push(g);
    grouped.set(g.level, list);
  }

  const sections: string[] = [];
  for (const [level, label] of levels.entries()) {
    const items = grouped.get(level);
    if (items?.length) {
      sections.push(`**${label} Goals:**`);
      sections.push(items.map((g) => `- ${g.name} (ID: ${g.id})`).join("\n"));
    }
  }

  return sections.join("\n\n") || "No active goals.";
}
