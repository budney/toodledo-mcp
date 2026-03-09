import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ToodledoClient } from "../api/client.js";
import { getTasks, addTask, editTask, deleteTask } from "../api/tasks.js";
import { STATUS_REVERSE, PRIORITY_REVERSE } from "../types.js";
import { formatTaskList, formatTask } from "../format.js";

export function registerTaskTools(server: McpServer, client: ToodledoClient) {
  server.tool(
    "toodledo_search_tasks",
    "Search for tasks. Returns incomplete tasks by default. Filter by folder, context, status, priority, or search text.",
    {
      folder: z.string().optional().describe("Folder name to filter by"),
      context: z.string().optional().describe("Context name to filter by (e.g. '@home', '@work')"),
      status: z.enum([
        "none", "next_action", "active", "planning", "delegated",
        "waiting", "hold", "postponed", "someday", "canceled", "reference",
      ]).optional().describe("Status filter"),
      priority: z.enum(["negative", "low", "medium", "high", "top"]).optional().describe("Priority filter"),
      starred: z.boolean().optional().describe("Only show starred tasks"),
      include_completed: z.boolean().optional().describe("Include completed tasks (default: false)"),
      search_text: z.string().optional().describe("Filter tasks by title substring"),
    },
    async (params) => {
      try {
        // Ensure caches are loaded for name resolution
        await client.refreshFolders();
        await client.refreshContexts();
        await client.refreshGoals();

        let tasks = await getTasks(client, {
          comp: params.include_completed ? -1 : 0,
        });

        // Filter by folder name
        if (params.folder) {
          const folderId = await client.resolveFolderName(params.folder);
          if (folderId === null) {
            const available = client.getFolderNames();
            const suggestion = client.findClosestName(params.folder, available);
            return {
              content: [{
                type: "text" as const,
                text: `Folder "${params.folder}" not found.${suggestion ? ` Did you mean "${suggestion}"?` : ""}\nAvailable: ${available.join(", ")}`,
              }],
              isError: true,
            };
          }
          tasks = tasks.filter((t) => t.folder === folderId);
        }

        // Filter by context name
        if (params.context) {
          const contextId = await client.resolveContextName(params.context);
          if (contextId === null) {
            const available = client.getContextNames();
            const suggestion = client.findClosestName(params.context, available);
            return {
              content: [{
                type: "text" as const,
                text: `Context "${params.context}" not found.${suggestion ? ` Did you mean "${suggestion}"?` : ""}\nAvailable: ${available.join(", ")}`,
              }],
              isError: true,
            };
          }
          tasks = tasks.filter((t) => t.context === contextId);
        }

        // Filter by status
        if (params.status) {
          const statusNum = STATUS_REVERSE[params.status];
          if (statusNum !== undefined) {
            tasks = tasks.filter((t) => t.status === statusNum);
          }
        }

        // Filter by priority
        if (params.priority) {
          const priorityNum = PRIORITY_REVERSE[params.priority];
          if (priorityNum !== undefined) {
            tasks = tasks.filter((t) => t.priority === priorityNum);
          }
        }

        // Filter by star
        if (params.starred) {
          tasks = tasks.filter((t) => t.star === 1);
        }

        // Filter by search text
        if (params.search_text) {
          const lower = params.search_text.toLowerCase();
          tasks = tasks.filter((t) => t.title.toLowerCase().includes(lower));
        }

        // Sort: by priority desc, then duedate asc
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
            text: `Found ${tasks.length} task(s):\n\n${formatTaskList(tasks, client)}`,
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
    "toodledo_get_task",
    "Get a single task by ID with full details including notes.",
    {
      id: z.number().describe("Task ID"),
    },
    async ({ id }) => {
      try {
        await client.refreshFolders();
        await client.refreshContexts();
        await client.refreshGoals();

        const tasks = await getTasks(client, { id });
        if (tasks.length === 0) {
          return {
            content: [{ type: "text" as const, text: `Task ${id} not found.` }],
            isError: true,
          };
        }
        return {
          content: [{ type: "text" as const, text: formatTask(tasks[0]!, client) }],
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
    "toodledo_add_task",
    "Create a new task. Specify folder and context by name - they will be resolved to IDs automatically.",
    {
      title: z.string().describe("Task title"),
      folder: z.string().optional().describe("Folder name (GTD project)"),
      context: z.string().optional().describe("Context name (e.g. '@home', '@work')"),
      goal: z.string().optional().describe("Goal name"),
      priority: z.enum(["negative", "low", "medium", "high", "top"]).optional().describe("Priority level"),
      status: z.enum([
        "none", "next_action", "active", "planning", "delegated",
        "waiting", "hold", "postponed", "someday", "canceled", "reference",
      ]).optional().describe("Task status"),
      star: z.boolean().optional().describe("Star this task"),
      duedate: z.string().optional().describe("Due date as YYYY-MM-DD"),
      startdate: z.string().optional().describe("Start date as YYYY-MM-DD"),
      tag: z.string().optional().describe("Comma-separated tags"),
      note: z.string().optional().describe("Task note/description"),
      duration: z.number().optional().describe("Duration in minutes"),
      parent: z.number().optional().describe("Parent task ID for subtasks"),
    },
    async (params) => {
      try {
        const taskData: Record<string, unknown> = { title: params.title };

        if (params.folder) {
          const folderId = await client.resolveFolderName(params.folder);
          if (folderId === null) {
            const available = client.getFolderNames();
            return {
              content: [{
                type: "text" as const,
                text: `Folder "${params.folder}" not found. Available: ${available.join(", ")}`,
              }],
              isError: true,
            };
          }
          taskData.folder = folderId;
        }

        if (params.context) {
          const contextId = await client.resolveContextName(params.context);
          if (contextId === null) {
            const available = client.getContextNames();
            return {
              content: [{
                type: "text" as const,
                text: `Context "${params.context}" not found. Available: ${available.join(", ")}`,
              }],
              isError: true,
            };
          }
          taskData.context = contextId;
        }

        if (params.goal) {
          const goalId = await client.resolveGoalName(params.goal);
          if (goalId === null) {
            const available = client.getGoalNames();
            return {
              content: [{
                type: "text" as const,
                text: `Goal "${params.goal}" not found. Available: ${available.join(", ")}`,
              }],
              isError: true,
            };
          }
          taskData.goal = goalId;
        }

        if (params.priority) taskData.priority = PRIORITY_REVERSE[params.priority];
        if (params.status) taskData.status = STATUS_REVERSE[params.status];
        if (params.star) taskData.star = 1;
        if (params.tag) taskData.tag = params.tag;
        if (params.note) taskData.note = params.note;
        if (params.duration) taskData.length = params.duration;
        if (params.parent) taskData.parent = params.parent;

        if (params.duedate) {
          taskData.duedate = Math.floor(new Date(params.duedate + "T12:00:00Z").getTime() / 1000);
        }
        if (params.startdate) {
          taskData.startdate = Math.floor(new Date(params.startdate + "T12:00:00Z").getTime() / 1000);
        }

        await client.refreshFolders();
        await client.refreshContexts();
        await client.refreshGoals();

        const created = await addTask(client, taskData);
        return {
          content: [{
            type: "text" as const,
            text: `Task created:\n\n${formatTask(created, client)}`,
          }],
        };
      } catch (err) {
        return {
          content: [{ type: "text" as const, text: `Error creating task: ${err}` }],
          isError: true,
        };
      }
    }
  );

  server.tool(
    "toodledo_edit_task",
    "Update an existing task. Only specify fields you want to change.",
    {
      id: z.number().describe("Task ID to edit"),
      title: z.string().optional().describe("New title"),
      folder: z.string().optional().describe("Folder name"),
      context: z.string().optional().describe("Context name"),
      goal: z.string().optional().describe("Goal name"),
      priority: z.enum(["negative", "low", "medium", "high", "top"]).optional(),
      status: z.enum([
        "none", "next_action", "active", "planning", "delegated",
        "waiting", "hold", "postponed", "someday", "canceled", "reference",
      ]).optional(),
      star: z.boolean().optional(),
      duedate: z.string().optional().describe("Due date as YYYY-MM-DD, or empty string to clear"),
      startdate: z.string().optional().describe("Start date as YYYY-MM-DD, or empty string to clear"),
      tag: z.string().optional(),
      note: z.string().optional(),
      duration: z.number().optional().describe("Duration in minutes"),
      parent: z.number().optional(),
    },
    async (params) => {
      try {
        const updates: Record<string, unknown> = {};

        if (params.title) updates.title = params.title;
        if (params.priority) updates.priority = PRIORITY_REVERSE[params.priority];
        if (params.status) updates.status = STATUS_REVERSE[params.status];
        if (params.star !== undefined) updates.star = params.star ? 1 : 0;
        if (params.tag !== undefined) updates.tag = params.tag;
        if (params.note !== undefined) updates.note = params.note;
        if (params.duration !== undefined) updates.length = params.duration;
        if (params.parent !== undefined) updates.parent = params.parent;

        if (params.folder) {
          const folderId = await client.resolveFolderName(params.folder);
          if (folderId === null) {
            return {
              content: [{
                type: "text" as const,
                text: `Folder "${params.folder}" not found. Available: ${client.getFolderNames().join(", ")}`,
              }],
              isError: true,
            };
          }
          updates.folder = folderId;
        }

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
          updates.context = contextId;
        }

        if (params.goal) {
          const goalId = await client.resolveGoalName(params.goal);
          if (goalId === null) {
            return {
              content: [{
                type: "text" as const,
                text: `Goal "${params.goal}" not found. Available: ${client.getGoalNames().join(", ")}`,
              }],
              isError: true,
            };
          }
          updates.goal = goalId;
        }

        if (params.duedate !== undefined) {
          updates.duedate = params.duedate
            ? Math.floor(new Date(params.duedate + "T12:00:00Z").getTime() / 1000)
            : 0;
        }
        if (params.startdate !== undefined) {
          updates.startdate = params.startdate
            ? Math.floor(new Date(params.startdate + "T12:00:00Z").getTime() / 1000)
            : 0;
        }

        await client.refreshFolders();
        await client.refreshContexts();
        await client.refreshGoals();

        const updated = await editTask(client, params.id, updates);
        return {
          content: [{
            type: "text" as const,
            text: `Task updated:\n\n${formatTask(updated, client)}`,
          }],
        };
      } catch (err) {
        return {
          content: [{ type: "text" as const, text: `Error editing task: ${err}` }],
          isError: true,
        };
      }
    }
  );

  server.tool(
    "toodledo_complete_task",
    "Mark a task as completed.",
    {
      id: z.number().describe("Task ID to complete"),
    },
    async ({ id }) => {
      try {
        const completed = Math.floor(Date.now() / 1000);
        const updated = await editTask(client, id, { completed });

        await client.refreshFolders();
        await client.refreshContexts();
        await client.refreshGoals();

        return {
          content: [{
            type: "text" as const,
            text: `Task completed:\n\n${formatTask(updated, client)}`,
          }],
        };
      } catch (err) {
        return {
          content: [{ type: "text" as const, text: `Error completing task: ${err}` }],
          isError: true,
        };
      }
    }
  );

  server.tool(
    "toodledo_delete_task",
    "Permanently delete a task. This cannot be undone.",
    {
      id: z.number().describe("Task ID to delete"),
    },
    async ({ id }) => {
      try {
        await deleteTask(client, id);
        return {
          content: [{ type: "text" as const, text: `Task ${id} deleted.` }],
        };
      } catch (err) {
        return {
          content: [{ type: "text" as const, text: `Error deleting task: ${err}` }],
          isError: true,
        };
      }
    }
  );
}
