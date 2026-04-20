import { z } from "zod";
import * as chrono from "chrono-node";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ToodledoClient } from "../api/client.js";
import { getSavedSearches } from "../api/searches.js";
import { getTasks } from "../api/tasks.js";
import type { ToodledoTask, ToodledoSavedSearch, ToodledoSearchRule } from "../types.js";
import { formatTaskList } from "../format.js";

// ---------------------------------------------------------------------------
// Rule evaluation
// ---------------------------------------------------------------------------

function getTaskFieldValue(task: ToodledoTask, field: string): string {
  switch (field) {
    case "title":     return task.title ?? "";
    case "note":      return task.note ?? "";
    case "tag":       return task.tag ?? "";
    case "checked":   return task.completed ? "yes" : "no";
    case "star":      return task.star ? "yes" : "no";
    case "folder":    return String(task.folder ?? 0);
    case "context":   return String(task.context ?? 0);
    case "goal":      return String(task.goal ?? 0);
    case "priority":  return String(task.priority ?? 0);
    case "status":    return String(task.status ?? 0);
    case "duedate":   return String(task.duedate ?? 0);
    case "startdate": return String(task.startdate ?? 0);
    case "duetime":   return String(task.duetime ?? 0);
    case "starttime": return String(task.starttime ?? 0);
    case "length":    return String(task.length ?? 0);
    case "repeat":    return task.repeat ?? "";
    case "added":     return String(task.added ?? 0);
    case "completed": return String(task.completed ?? 0);
    case "modified":  return String(task.modified ?? 0);
    case "parent":    return task.parent ? "yes" : "no";
    case "subtask":   return task.parent ? "yes" : "no";
    default:          return "";
  }
}

function nowSeconds(): number {
  return Math.floor(Date.now() / 1000);
}

function startOfTodaySeconds(): number {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return Math.floor(d.getTime() / 1000);
}

function parseDateValue(value: string): number {
  // Try bare number first (unix timestamp or plain day count from relative-date types)
  const trimmed = value.trim();
  if (trimmed === "") return NaN;
  const bare = Number(trimmed);
  if (!isNaN(bare)) return bare;

  // Try natural language via chrono-node; returns unix seconds or NaN
  const parsed = chrono.parseDate(value);
  if (parsed) return Math.floor(parsed.getTime() / 1000);

  return NaN;
}

const SECONDS_PER_DAY = 86400;

function matchRule(task: ToodledoTask, rule: ToodledoSearchRule): boolean {
  const raw = getTaskFieldValue(task, rule.field);
  const ruleVal = rule.value ?? "";
  const type = rule.type;

  // Boolean / existence checks
  if (type === "yes")            return raw === "yes" || (raw !== "" && raw !== "0");
  if (type === "no")             return raw === "no"  || raw === "" || raw === "0";
  if (type === "exists")         return raw !== "" && raw !== "0";
  if (type === "does not exist") return raw === "" || raw === "0";

  // String operations (title, note, tag, repeat)
  if (type === "contains")         return raw.toLowerCase().includes(ruleVal.toLowerCase());
  if (type === "does not contain") return !raw.toLowerCase().includes(ruleVal.toLowerCase());
  if (type === "begins with")      return raw.toLowerCase().startsWith(ruleVal.toLowerCase());
  if (type === "ends with")        return raw.toLowerCase().endsWith(ruleVal.toLowerCase());
  if (type === "is")               return raw.toLowerCase() === ruleVal.toLowerCase();
  if (type === "is not")           return raw.toLowerCase() !== ruleVal.toLowerCase();

  // Numeric / date comparisons
  const numRaw = Number(raw);
  const numVal = Number(ruleVal);

  if (type === "is more than") return numRaw > numVal;
  if (type === "is less than") return numRaw < numVal;

  // "is after"/"is before": value may be natural language ("tomorrow", "next monday", "2 days")
  // parseDateValue handles all of these via chrono-node and returns a unix timestamp.
  if (type === "is after" || type === "is before") {
    const threshold = parseDateValue(ruleVal);
    if (isNaN(threshold)) return false;
    if (type === "is after")  return numRaw > 0 && numRaw > threshold;
    if (type === "is before") return numRaw > 0 && numRaw < threshold;
  }

  // Relative-date types: value is always a bare day count ("3", "9999", etc.)
  const days = numVal;
  const now = nowSeconds();
  if (type === "was in the last")      return numRaw > 0 && numRaw >= now - days * SECONDS_PER_DAY;
  if (type === "was not in the last")  return numRaw === 0 || numRaw < now - days * SECONDS_PER_DAY;
  const startOfToday = startOfTodaySeconds();
  if (type === "is in the next")       return numRaw > 0 && numRaw <= now + days * SECONDS_PER_DAY && numRaw >= startOfToday;
  if (type === "is not in the next")   return numRaw === 0 || numRaw > now + days * SECONDS_PER_DAY || numRaw < startOfToday;
  if (type === "is in")                return numRaw > 0 && Math.abs(numRaw - (now + days * SECONDS_PER_DAY)) < SECONDS_PER_DAY;
  if (type === "is not in")            return numRaw === 0 || Math.abs(numRaw - (now + days * SECONDS_PER_DAY)) >= SECONDS_PER_DAY;
  if (type === "was")                  return numRaw > 0 && Math.abs(numRaw - (now - days * SECONDS_PER_DAY)) < SECONDS_PER_DAY;
  if (type === "was not")              return numRaw === 0 || Math.abs(numRaw - (now - days * SECONDS_PER_DAY)) >= SECONDS_PER_DAY;

  return true;
}

function matchRules(task: ToodledoTask, rules: ToodledoSearchRule[], allMustMatch: boolean): boolean {
  if (allMustMatch) {
    return rules.every((r) => matchRule(task, r));
  } else {
    return rules.some((r) => matchRule(task, r));
  }
}

function applySearch(tasks: ToodledoTask[], search: ToodledoSavedSearch): ToodledoTask[] {
  // "All" => outer AND, inner OR.  "Any" => outer OR, inner AND.
  const outerAll = search.bool === "All";
  const innerAll = !outerAll;

  return tasks.filter((task) => {
    const groupResults = Object.entries(search.search).map(([key, rules]) => {
      // root rules participate in the outer boolean (same as outer)
      const allMustMatch = key === "root" ? outerAll : innerAll;
      return matchRules(task, rules, allMustMatch);
    });

    return outerAll ? groupResults.every(Boolean) : groupResults.some(Boolean);
  });
}

// ---------------------------------------------------------------------------
// Formatting
// ---------------------------------------------------------------------------

function formatSavedSearchList(searches: ToodledoSavedSearch[]): string {
  if (searches.length === 0) return "No saved searches found.";
  return searches.map((s) => formatSavedSearchDetail(s)).join("\n\n");
}

function formatSavedSearchDetail(s: ToodledoSavedSearch): string {
  const lines: string[] = [`**${s.name}** (ID: ${s.id}) — Match: ${s.bool}`];
  for (const [group, rules] of Object.entries(s.search)) {
    lines.push(`  Group "${group}":`);
    for (const r of rules) {
      lines.push(`    ${r.field} ${r.type}${r.value ? ` "${r.value}"` : ""}`);
    }
  }
  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Tool registration
// ---------------------------------------------------------------------------

export function registerSearchTools(server: McpServer, client: ToodledoClient) {
  server.tool(
    "toodledo_list_saved_searches",
    "List all saved searches defined in Toodledo, showing their names, IDs, and rule summaries.",
    {},
    async () => {
      try {
        const searches = await getSavedSearches(client);
        return {
          content: [{
            type: "text" as const,
            text: `${searches.length} saved search(es):\n\n${formatSavedSearchList(searches)}`,
          }],
        };
      } catch (err) {
        return {
          content: [{ type: "text" as const, text: `Error: ${err}` }],
          isError: true,
        };
      }
    }
  );

  server.tool(
    "toodledo_run_saved_search",
    "Execute a saved search by name or ID and return matching tasks. Rules are applied client-side against all tasks.",
    {
      name: z.string().optional().describe("Saved search name (case-insensitive)"),
      id: z.number().optional().describe("Saved search ID"),
      include_completed: z.boolean().optional().describe("Include completed tasks (default: false)"),
    },
    async (params) => {
      try {
        if (!params.name && params.id === undefined) {
          return {
            content: [{ type: "text" as const, text: "Provide either name or id." }],
            isError: true,
          };
        }

        const searches = await getSavedSearches(client);

        let search: ToodledoSavedSearch | undefined;
        if (params.id !== undefined) {
          search = searches.find((s) => s.id === params.id);
        } else {
          const lower = params.name!.toLowerCase();
          search = searches.find((s) => s.name.toLowerCase() === lower);
          if (!search) {
            search = searches.find((s) => s.name.toLowerCase().includes(lower));
          }
        }

        if (!search) {
          const names = searches.map((s) => s.name).join(", ");
          return {
            content: [{
              type: "text" as const,
              text: `Saved search not found.\nAvailable: ${names || "none"}`,
            }],
            isError: true,
          };
        }

        await client.refreshFolders();
        await client.refreshContexts();
        await client.refreshGoals();

        const allTasks = await getTasks(client, {
          comp: params.include_completed ? -1 : 0,
        });

        const matched = applySearch(allTasks, search);

        matched.sort((a, b) => {
          if (b.priority !== a.priority) return b.priority - a.priority;
          if (a.duedate && b.duedate) return a.duedate - b.duedate;
          if (a.duedate) return -1;
          if (b.duedate) return 1;
          return 0;
        });

        return {
          content: [{
            type: "text" as const,
            text: `Running saved search: ${formatSavedSearchDetail(search)}\n\nFound ${matched.length} task(s):\n\n${formatTaskList(matched, client)}`,
          }],
        };
      } catch (err) {
        return {
          content: [{ type: "text" as const, text: `Error: ${err}` }],
          isError: true,
        };
      }
    }
  );
}
