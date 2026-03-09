import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ToodledoClient } from "../api/client.js";
import { getFolders, addFolder, deleteFolder } from "../api/folders.js";
import { getContexts, addContext, deleteContext } from "../api/contexts.js";
import { getGoals, addGoal } from "../api/goals.js";
import { formatFolders, formatFoldersWithArchived, formatContexts, formatGoals } from "../format.js";

export function registerFolderTools(server: McpServer, client: ToodledoClient) {
  // --- Folders (GTD Projects) ---

  server.tool(
    "toodledo_list_folders",
    "List all folders (GTD projects). Shows active folders by default.",
    {
      include_archived: z.boolean().optional().describe("Include archived folders (default: false)"),
    },
    async (params) => {
      try {
        const folders = await getFolders(client);
        const text = params.include_archived
          ? formatFoldersWithArchived(folders)
          : formatFolders(folders);
        return { content: [{ type: "text" as const, text }] };
      } catch (err) {
        return {
          content: [{ type: "text" as const, text: `Error: ${err}` }],
          isError: true,
        };
      }
    }
  );

  server.tool(
    "toodledo_add_folder",
    "Create a new folder (GTD project).",
    {
      name: z.string().describe("Folder name (max 64 characters)"),
      private: z.boolean().optional().describe("Make folder private"),
    },
    async (params) => {
      try {
        const folder = await addFolder(client, params.name, params.private);
        return {
          content: [{
            type: "text" as const,
            text: `Folder created: ${folder.name} (ID: ${folder.id})`,
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
    "toodledo_delete_folder",
    "Delete a folder. Tasks in this folder will become unassigned.",
    {
      id: z.number().describe("Folder ID to delete"),
    },
    async ({ id }) => {
      try {
        await deleteFolder(client, id);
        return {
          content: [{ type: "text" as const, text: `Folder ${id} deleted.` }],
        };
      } catch (err) {
        return {
          content: [{ type: "text" as const, text: `Error: ${err}` }],
          isError: true,
        };
      }
    }
  );

  // --- Contexts ---

  server.tool(
    "toodledo_list_contexts",
    "List all contexts (GTD contexts like @home, @work, @phone, @errands).",
    {},
    async () => {
      try {
        const contexts = await getContexts(client);
        return { content: [{ type: "text" as const, text: formatContexts(contexts) }] };
      } catch (err) {
        return {
          content: [{ type: "text" as const, text: `Error: ${err}` }],
          isError: true,
        };
      }
    }
  );

  server.tool(
    "toodledo_add_context",
    "Create a new context (e.g. @home, @work, @phone).",
    {
      name: z.string().describe("Context name (max 64 characters)"),
    },
    async ({ name }) => {
      try {
        const context = await addContext(client, name);
        return {
          content: [{
            type: "text" as const,
            text: `Context created: ${context.name} (ID: ${context.id})`,
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
    "toodledo_delete_context",
    "Delete a context. Tasks with this context will become unassigned.",
    {
      id: z.number().describe("Context ID to delete"),
    },
    async ({ id }) => {
      try {
        await deleteContext(client, id);
        return {
          content: [{ type: "text" as const, text: `Context ${id} deleted.` }],
        };
      } catch (err) {
        return {
          content: [{ type: "text" as const, text: `Error: ${err}` }],
          isError: true,
        };
      }
    }
  );

  // --- Goals ---

  server.tool(
    "toodledo_list_goals",
    "List all goals organized by level (lifetime, long-term, short-term).",
    {
      include_archived: z.boolean().optional().describe("Include archived goals"),
    },
    async () => {
      try {
        const goals = await getGoals(client);
        return { content: [{ type: "text" as const, text: formatGoals(goals) }] };
      } catch (err) {
        return {
          content: [{ type: "text" as const, text: `Error: ${err}` }],
          isError: true,
        };
      }
    }
  );

  server.tool(
    "toodledo_add_goal",
    "Create a new goal.",
    {
      name: z.string().describe("Goal name"),
      level: z.enum(["lifetime", "long-term", "short-term"]).optional().describe("Goal level (default: short-term)"),
      contributes_to: z.number().optional().describe("Parent goal ID this contributes to"),
    },
    async (params) => {
      try {
        const levelMap: Record<string, number> = {
          lifetime: 0,
          "long-term": 1,
          "short-term": 2,
        };
        const level = params.level ? levelMap[params.level] : 2;
        const goal = await addGoal(client, params.name, level, params.contributes_to);
        return {
          content: [{
            type: "text" as const,
            text: `Goal created: ${goal.name} (ID: ${goal.id})`,
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
