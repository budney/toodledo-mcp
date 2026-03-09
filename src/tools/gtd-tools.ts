import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ToodledoClient } from "../api/client.js";
import { getTasks } from "../api/tasks.js";
import { STATUS_MAP, PRIORITY_MAP } from "../types.js";
import type { ToodledoTask } from "../types.js";
import { formatTaskList } from "../format.js";

export function registerGtdTools(server: McpServer, client: ToodledoClient) {
  server.tool(
    "toodledo_gtd_next_actions",
    "Get all Next Action tasks - your GTD 'what should I do now?' list. Optionally filter by context.",
    {
      context: z.string().optional().describe("Filter by context name (e.g. '@home')"),
    },
    async (params) => {
      try {
        await client.refreshFolders();
        await client.refreshContexts();
        await client.refreshGoals();

        let tasks = await getTasks(client, { comp: 0 });

        // Filter to Next Action status
        tasks = tasks.filter((t) => t.status === 1);

        // Filter by context if specified
        if (params.context) {
          const contextId = await client.resolveContextName(params.context);
          if (contextId === null) {
            return {
              content: [{
                type: "text" as const,
                text: `Context "${params.context}" not found. Available: ${client.getContextNames().join(", ")}`,
              }],
              isError: true,
            };
          }
          tasks = tasks.filter((t) => t.context === contextId);
        }

        // Sort by priority desc, then duedate asc
        tasks.sort((a, b) => {
          if (b.priority !== a.priority) return b.priority - a.priority;
          if (a.duedate && b.duedate) return a.duedate - b.duedate;
          if (a.duedate) return -1;
          if (b.duedate) return 1;
          return 0;
        });

        return {
          content: [{
            type: "text" as const,
            text: `Next Actions (${tasks.length}):\n\n${formatTaskList(tasks, client)}`,
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
    "toodledo_gtd_review",
    "GTD weekly review summary: inbox items (no folder/context), stalled projects (folders with no next action), overdue tasks, waiting-for tasks, and someday/maybe items.",
    {},
    async () => {
      try {
        await client.refreshFolders();
        await client.refreshContexts();
        await client.refreshGoals();

        const tasks = await getTasks(client, { comp: 0 });
        const now = Math.floor(Date.now() / 1000);
        const sections: string[] = [];

        // Inbox: tasks with no folder AND no context
        const inbox = tasks.filter((t) => !t.folder && !t.context);
        sections.push(`## Inbox (${inbox.length})`);
        if (inbox.length > 0) {
          sections.push(formatTaskList(inbox, client));
        } else {
          sections.push("Inbox is empty - great!");
        }

        // Overdue tasks
        const overdue = tasks.filter((t) => t.duedate && t.duedate < now);
        sections.push(`\n## Overdue (${overdue.length})`);
        if (overdue.length > 0) {
          overdue.sort((a, b) => a.duedate - b.duedate);
          sections.push(formatTaskList(overdue, client));
        } else {
          sections.push("No overdue tasks!");
        }

        // Stalled projects: folders that have tasks but no Next Action
        const folderTaskMap = new Map<number, { total: number; hasNextAction: boolean }>();
        for (const t of tasks) {
          if (!t.folder) continue;
          const entry = folderTaskMap.get(t.folder) ?? { total: 0, hasNextAction: false };
          entry.total++;
          if (t.status === 1) entry.hasNextAction = true;
          folderTaskMap.set(t.folder, entry);
        }

        const stalledFolders: string[] = [];
        for (const [folderId, info] of folderTaskMap) {
          if (!info.hasNextAction && info.total > 0) {
            stalledFolders.push(
              `- ${client.getFolderName(folderId)} (${info.total} tasks, no next action)`
            );
          }
        }
        sections.push(`\n## Stalled Projects (${stalledFolders.length})`);
        if (stalledFolders.length > 0) {
          sections.push(stalledFolders.join("\n"));
        } else {
          sections.push("All projects have next actions defined.");
        }

        // Waiting For
        const waiting = tasks.filter((t) => t.status === 5);
        sections.push(`\n## Waiting For (${waiting.length})`);
        if (waiting.length > 0) {
          sections.push(formatTaskList(waiting, client));
        } else {
          sections.push("Nothing in waiting.");
        }

        // Someday/Maybe
        const someday = tasks.filter((t) => t.status === 8);
        sections.push(`\n## Someday/Maybe (${someday.length})`);
        if (someday.length > 0) {
          sections.push(formatTaskList(someday, client));
        } else {
          sections.push("No someday/maybe items.");
        }

        return {
          content: [{
            type: "text" as const,
            text: `# GTD Weekly Review\n\n${sections.join("\n")}`,
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
    "toodledo_gtd_dashboard",
    "High-level dashboard: task counts by folder, context, status, and priority. Includes overdue count and today's due tasks.",
    {},
    async () => {
      try {
        await client.refreshFolders();
        await client.refreshContexts();
        await client.refreshGoals();

        const tasks = await getTasks(client, { comp: 0 });
        const now = Math.floor(Date.now() / 1000);
        const todayStart = Math.floor(new Date().setHours(0, 0, 0, 0) / 1000);
        const todayEnd = todayStart + 86400;

        const sections: string[] = [];
        sections.push(`# Task Dashboard\n`);
        sections.push(`**Total incomplete tasks:** ${tasks.length}`);

        // Overdue
        const overdue = tasks.filter((t) => t.duedate && t.duedate < now);
        sections.push(`**Overdue:** ${overdue.length}`);

        // Due today
        const dueToday = tasks.filter(
          (t) => t.duedate && t.duedate >= todayStart && t.duedate < todayEnd
        );
        sections.push(`**Due today:** ${dueToday.length}`);

        // Starred
        const starred = tasks.filter((t) => t.star === 1);
        sections.push(`**Starred:** ${starred.length}`);

        // By status
        const byStatus = new Map<number, number>();
        for (const t of tasks) {
          byStatus.set(t.status, (byStatus.get(t.status) ?? 0) + 1);
        }
        sections.push(`\n## By Status`);
        for (const [status, count] of [...byStatus.entries()].sort((a, b) => a[0] - b[0])) {
          sections.push(`- ${STATUS_MAP[status] ?? "Unknown"}: ${count}`);
        }

        // By priority
        const byPriority = new Map<number, number>();
        for (const t of tasks) {
          byPriority.set(t.priority, (byPriority.get(t.priority) ?? 0) + 1);
        }
        sections.push(`\n## By Priority`);
        for (const [priority, count] of [...byPriority.entries()].sort((a, b) => b[0] - a[0])) {
          sections.push(`- ${PRIORITY_MAP[priority] ?? "Unknown"}: ${count}`);
        }

        // By folder (top 15)
        const byFolder = new Map<number, number>();
        for (const t of tasks) {
          byFolder.set(t.folder, (byFolder.get(t.folder) ?? 0) + 1);
        }
        sections.push(`\n## By Folder`);
        const sortedFolders = [...byFolder.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15);
        for (const [folderId, count] of sortedFolders) {
          const name = folderId === 0 ? "(No folder)" : client.getFolderName(folderId);
          sections.push(`- ${name}: ${count}`);
        }

        // By context (top 15)
        const byContext = new Map<number, number>();
        for (const t of tasks) {
          byContext.set(t.context, (byContext.get(t.context) ?? 0) + 1);
        }
        sections.push(`\n## By Context`);
        const sortedContexts = [...byContext.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15);
        for (const [contextId, count] of sortedContexts) {
          const name = contextId === 0 ? "(No context)" : client.getContextName(contextId);
          sections.push(`- ${name}: ${count}`);
        }

        // Due today details
        if (dueToday.length > 0) {
          sections.push(`\n## Due Today`);
          sections.push(formatTaskList(dueToday, client));
        }

        return {
          content: [{ type: "text" as const, text: sections.join("\n") }],
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
