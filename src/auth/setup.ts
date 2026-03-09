import { createServer } from "node:http";
import { randomBytes } from "node:crypto";
import { loadConfig } from "../config.js";
import { getAuthorizationUrl, exchangeCodeForTokens } from "./oauth.js";
import { saveTokens } from "./token-store.js";

const PORT = 9876;

async function main() {
  const config = loadConfig();
  const state = randomBytes(16).toString("hex");

  const authUrl = getAuthorizationUrl(config.clientId, state);

  console.log("\n=== Toodledo MCP OAuth Setup ===\n");
  console.log("Open this URL in your browser to authorize:\n");
  console.log(authUrl);
  console.log("\nWaiting for callback...\n");

  return new Promise<void>((resolve, reject) => {
    const server = createServer(async (req, res) => {
      const url = new URL(req.url!, `http://localhost:${PORT}`);

      if (url.pathname !== "/callback") {
        res.writeHead(404);
        res.end("Not found");
        return;
      }

      const code = url.searchParams.get("code");
      const returnedState = url.searchParams.get("state");

      if (returnedState !== state) {
        res.writeHead(400);
        res.end("State mismatch - possible CSRF attack. Try again.");
        return;
      }

      if (!code) {
        res.writeHead(400);
        res.end("No authorization code received.");
        return;
      }

      try {
        const tokens = await exchangeCodeForTokens(code, config.clientId, config.clientSecret);
        saveTokens(tokens);

        res.writeHead(200, { "Content-Type": "text/html" });
        res.end("<h1>Toodledo MCP authorized!</h1><p>You can close this tab and return to the terminal.</p>");

        console.log("Tokens saved successfully! You can now use the MCP server.");
        server.close();
        resolve();
      } catch (err) {
        res.writeHead(500);
        res.end(`Authorization failed: ${err}`);
        server.close();
        reject(err);
      }
    });

    server.listen(PORT, () => {
      console.log(`Listening on http://localhost:${PORT}/callback`);
    });

    server.on("error", (err) => {
      if ((err as NodeJS.ErrnoException).code === "EADDRINUSE") {
        console.error(`Port ${PORT} is already in use. Close the other process and try again.`);
      }
      reject(err);
    });
  });
}

main().catch((err) => {
  console.error("Setup failed:", err);
  process.exit(1);
});
