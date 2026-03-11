import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { ToodledoClient } from "./api/client.js";
import { registerTaskTools } from "./tools/task-tools.js";
import { registerFolderTools } from "./tools/folder-tools.js";
import { registerGtdTools } from "./tools/gtd-tools.js";
import {
  handleResourceMetadata,
  handleAuthServerMetadata,
  handleRegister,
  handleAuthorize,
  handleToken,
  validateBearerToken,
  sendUnauthorized,
} from "./auth/oauth-server.js";
import { createServer } from "node:http";

const TRANSPORT = process.env.TRANSPORT ?? "stdio";
const PORT = parseInt(process.env.PORT ?? "8080", 10);

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
  const transports = new Map<string, StreamableHTTPServerTransport>();

  const httpServer = createServer(async (req, res) => {
    const url = new URL(req.url ?? "/", `http://${req.headers.host}`);

    // --- Public endpoints (no auth) ---

    if (url.pathname === "/health") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ status: "ok" }));
      return;
    }

    if (url.pathname === "/.well-known/oauth-protected-resource") {
      handleResourceMetadata(req, res);
      return;
    }

    if (url.pathname === "/.well-known/oauth-authorization-server") {
      handleAuthServerMetadata(req, res);
      return;
    }

    if (url.pathname === "/oauth/authorize") {
      handleAuthorize(req, res, url);
      return;
    }

    if (url.pathname === "/oauth/token" && req.method === "POST") {
      handleToken(req, res);
      return;
    }

    if (url.pathname === "/oauth/register" && req.method === "POST") {
      handleRegister(req, res);
      return;
    }

    // --- Protected endpoints (require bearer token) ---

    if (url.pathname !== "/mcp" && url.pathname !== "/mcp/") {
      res.writeHead(404);
      res.end("Not found");
      return;
    }

    if (!validateBearerToken(req)) {
      sendUnauthorized(req, res);
      return;
    }

    if (req.method === "POST" || req.method === "GET") {
      const sessionId = req.headers["mcp-session-id"] as string | undefined;
      let transport = sessionId ? transports.get(sessionId) : undefined;

      if (transport) {
        await transport.handleRequest(req, res);
        return;
      }

      if (req.method === "POST") {
        transport = new StreamableHTTPServerTransport({
          sessionIdGenerator: () => crypto.randomUUID(),
          onsessioninitialized: (id) => {
            transports.set(id, transport!);
          },
        });

        transport.onclose = () => {
          const id = transport!.sessionId;
          if (id) transports.delete(id);
        };

        const server = createMcpServer();
        await server.connect(transport);
        await transport.handleRequest(req, res);
        return;
      }

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
