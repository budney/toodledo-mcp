import { IncomingMessage, ServerResponse } from "node:http";
import crypto from "node:crypto";

// Client credentials — set via env vars (Secret Manager in Cloud Run)
const CLIENT_ID = process.env.OAUTH_CLIENT_ID ?? "toodledo-mcp";
const CLIENT_SECRET = process.env.MCP_BEARER_TOKEN ?? "";

// In-memory stores — wiped on redeploy, claude.ai will re-auth automatically
const authCodes = new Map<
  string,
  { clientId: string; redirectUri: string; codeChallenge?: string; expiresAt: number }
>();
const accessTokens = new Set<string>();

// --- Metadata endpoints ---

export function handleResourceMetadata(req: IncomingMessage, res: ServerResponse) {
  const origin = `${req.headers["x-forwarded-proto"] ?? "http"}://${req.headers.host}`;
  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(
    JSON.stringify({
      resource: origin,
      authorization_servers: [origin],
      bearer_methods_supported: ["header"],
    })
  );
}

export function handleAuthServerMetadata(req: IncomingMessage, res: ServerResponse) {
  const origin = `${req.headers["x-forwarded-proto"] ?? "http"}://${req.headers.host}`;
  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(
    JSON.stringify({
      issuer: origin,
      authorization_endpoint: `${origin}/oauth/authorize`,
      token_endpoint: `${origin}/oauth/token`,
      registration_endpoint: `${origin}/oauth/register`,
      response_types_supported: ["code"],
      grant_types_supported: ["authorization_code"],
      token_endpoint_auth_methods_supported: ["client_secret_post"],
      code_challenge_methods_supported: ["S256"],
    })
  );
}

// --- Dynamic client registration (MCP spec requires it) ---

export function handleRegister(req: IncomingMessage, res: ServerResponse) {
  let body = "";
  req.on("data", (chunk: Buffer) => (body += chunk));
  req.on("end", () => {
    // Accept any registration and return our fixed client credentials.
    // Single-user server — no need for real dynamic registration.
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        client_id_issued_at: Math.floor(Date.now() / 1000),
        client_secret_expires_at: 0, // never
      })
    );
  });
}

// --- Authorization endpoint ---

export function handleAuthorize(req: IncomingMessage, res: ServerResponse, url: URL) {
  const clientId = url.searchParams.get("client_id");
  const redirectUri = url.searchParams.get("redirect_uri");
  const state = url.searchParams.get("state");
  const codeChallenge = url.searchParams.get("code_challenge");

  if (clientId !== CLIENT_ID) {
    res.writeHead(400, { "Content-Type": "text/plain" });
    res.end("Invalid client_id");
    return;
  }

  if (!redirectUri) {
    res.writeHead(400, { "Content-Type": "text/plain" });
    res.end("Missing redirect_uri");
    return;
  }

  // Auto-approve (single-user server) — generate code and redirect
  const code = crypto.randomUUID();
  authCodes.set(code, {
    clientId,
    redirectUri,
    codeChallenge: codeChallenge ?? undefined,
    expiresAt: Date.now() + 5 * 60 * 1000,
  });

  const redirect = new URL(redirectUri);
  redirect.searchParams.set("code", code);
  if (state) redirect.searchParams.set("state", state);

  res.writeHead(302, { Location: redirect.toString() });
  res.end();
}

// --- Token endpoint ---

export function handleToken(req: IncomingMessage, res: ServerResponse) {
  let body = "";
  req.on("data", (chunk: Buffer) => (body += chunk));
  req.on("end", () => {
    const params = new URLSearchParams(body);
    const grantType = params.get("grant_type");
    const code = params.get("code");
    const clientId = params.get("client_id");
    const clientSecret = params.get("client_secret");
    const codeVerifier = params.get("code_verifier");

    if (clientId !== CLIENT_ID || clientSecret !== CLIENT_SECRET) {
      res.writeHead(401, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "invalid_client" }));
      return;
    }

    if (grantType !== "authorization_code" || !code) {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "invalid_request" }));
      return;
    }

    const stored = authCodes.get(code);
    if (!stored || stored.expiresAt < Date.now()) {
      authCodes.delete(code);
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "invalid_grant" }));
      return;
    }

    // PKCE verification
    if (stored.codeChallenge && codeVerifier) {
      const hash = crypto.createHash("sha256").update(codeVerifier).digest("base64url");
      if (hash !== stored.codeChallenge) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "invalid_grant" }));
        return;
      }
    }

    authCodes.delete(code);

    const token = crypto.randomUUID();
    accessTokens.add(token);

    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        access_token: token,
        token_type: "Bearer",
      })
    );
  });
}

// --- Token validation ---

export function validateBearerToken(req: IncomingMessage): boolean {
  const auth = req.headers.authorization;
  if (!auth?.startsWith("Bearer ")) return false;
  return accessTokens.has(auth.slice(7));
}

export function sendUnauthorized(req: IncomingMessage, res: ServerResponse): void {
  const origin = `${req.headers["x-forwarded-proto"] ?? "http"}://${req.headers.host}`;
  res.writeHead(401, {
    "Content-Type": "application/json",
    "WWW-Authenticate": `Bearer resource_metadata="${origin}/.well-known/oauth-protected-resource"`,
  });
  res.end(JSON.stringify({ error: "Unauthorized" }));
}
