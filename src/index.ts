import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { ToodledoClient } from "./api/client.js";
import { registerTaskTools } from "./tools/task-tools.js";
import { registerFolderTools } from "./tools/folder-tools.js";
import { registerGtdTools } from "./tools/gtd-tools.js";

const server = new McpServer({
  name: "toodledo",
  version: "0.1.0",
});

const client = new ToodledoClient();

// Register all tools
registerTaskTools(server, client);
registerFolderTools(server, client);
registerGtdTools(server, client);

// Connect via stdio
const transport = new StdioServerTransport();
await server.connect(transport);
