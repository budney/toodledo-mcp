import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { ToodledoClient } from "./api/client.js";
import { registerTaskTools } from "./tools/task-tools.js";
import { registerFolderTools } from "./tools/folder-tools.js";
import { registerGtdTools } from "./tools/gtd-tools.js";
import { createServer } from "node:http";

const TRANSPORT = process.env.TRANSPORT ?? "stdio";
const PORT = parseInt(process.env.PORT ?? "8080", 10);
const BEARER_TOKEN = process.env.MCP_BEARER_TOKEN;

function createMcpServer(): McpServer {
  const server = new McpServer({
    name: "toodledo",
    version: "0.1.0",
  });

  const client = new ToodledoClient();
  registerTaskTools(server, client);
  registerFolderTools(server, client);
  registerGtdTools(server, client);

  return server;
}

if (TRANSPORT === "stdio") {
  const server = createMcpServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
} else if (TRANSPORT === "http") {
  // Track transports by session ID for cleanup
  const transports = new Map<string, StreamableHTTPServerTransport>();

  const httpServer = createServer(async (req, res) => {
    const url = new URL(req.url ?? "/", `http://${req.headers.host}`);

    // Health check — no auth required
    if (url.pathname === "/health") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ status: "ok" }));
      return;
    }

    // Only /mcp path for MCP traffic
    if (url.pathname !== "/mcp") {
      res.writeHead(404);
      res.end("Not found");
      return;
    }

    // Bearer token auth
    if (BEARER_TOKEN) {
      const auth = req.headers.authorization;
      if (!auth || auth !== `Bearer ${BEARER_TOKEN}`) {
        res.writeHead(401, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Unauthorized" }));
        return;
      }
    }

    if (req.method === "POST" || req.method === "GET") {
      // Check for existing session
      const sessionId = req.headers["mcp-session-id"] as string | undefined;
      let transport = sessionId ? transports.get(sessionId) : undefined;

      if (transport) {
        // Existing session — route request
        await transport.handleRequest(req, res);
        return;
      }

      if (req.method === "POST") {
        // New session — create transport and server
        transport = new StreamableHTTPServerTransport({
          sessionIdGenerator: () => crypto.randomUUID(),
          onsessioninitialized: (id) => {
            transports.set(id, transport!);
          },
        });

        // Clean up on close
        transport.onclose = () => {
          const id = transport!.sessionId;
          if (id) transports.delete(id);
        };

        const server = createMcpServer();
        await server.connect(transport);
        await transport.handleRequest(req, res);
        return;
      }

      // GET without existing session
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "No active session. Send POST to initialize." }));
      return;
    }

    if (req.method === "DELETE") {
      const sessionId = req.headers["mcp-session-id"] as string | undefined;
      const transport = sessionId ? transports.get(sessionId) : undefined;

      if (transport) {
        await transport.handleRequest(req, res);
      } else {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "No active session" }));
      }
      return;
    }

    res.writeHead(405);
    res.end("Method not allowed");
  });

  httpServer.listen(PORT, () => {
    console.log(`Toodledo MCP server listening on port ${PORT} (HTTP transport)`);
  });
} else {
  console.error(`Unknown TRANSPORT: ${TRANSPORT}. Use "stdio" or "http".`);
  process.exit(1);
}
