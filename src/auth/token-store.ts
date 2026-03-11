import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { getConfigDir, loadConfig } from "../config.js";
import { refreshAccessToken } from "./oauth.js";
import type { TokenData, ToodledoTokenResponse } from "../types.js";

const TOKEN_FILE = join(getConfigDir(), "tokens.json");
const REFRESH_BUFFER_MS = 5 * 60 * 1000; // refresh 5 min before expiry

const useSecretManager = !!process.env.GOOGLE_CLOUD_PROJECT;

// In-memory cache for cloud mode (loaded from Secret Manager on first call)
let cachedTokens: TokenData | null = null;

// Lazy-load the secret manager module only when needed
async function getSecretManagerStore() {
  return await import("./secret-manager-store.js");
}

export function saveTokens(response: ToodledoTokenResponse): void {
  const data: TokenData = {
    access_token: response.access_token,
    refresh_token: response.refresh_token,
    expires_at: Date.now() + response.expires_in * 1000,
    scope: response.scope,
  };

  if (useSecretManager) {
    // In cloud mode, update in-memory cache and persist async
    cachedTokens = data;
    getSecretManagerStore()
      .then((sm) => sm.saveTokensToSecret(data))
      .catch((err) => console.error("Failed to save tokens to Secret Manager:", err));
  } else {
    const dir = getConfigDir();
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    writeFileSync(TOKEN_FILE, JSON.stringify(data, null, 2));
  }
}

async function loadTokens(): Promise<TokenData> {
  if (useSecretManager) {
    if (cachedTokens) return cachedTokens;
    const sm = await getSecretManagerStore();
    cachedTokens = await sm.loadTokensFromSecret();
    return cachedTokens;
  }

  if (!existsSync(TOKEN_FILE)) {
    throw new Error(
      `No tokens found at ${TOKEN_FILE}. Run 'npm run setup' to authenticate with Toodledo.`
    );
  }
  return JSON.parse(readFileSync(TOKEN_FILE, "utf-8")) as TokenData;
}

export async function getAccessToken(): Promise<string> {
  const tokens = await loadTokens();

  // If token is still valid (with buffer), return it
  if (Date.now() < tokens.expires_at - REFRESH_BUFFER_MS) {
    return tokens.access_token;
  }

  // Token expired or about to expire - refresh it
  const config = loadConfig();
  const refreshed = await refreshAccessToken(
    tokens.refresh_token,
    config.clientId,
    config.clientSecret
  );

  saveTokens(refreshed);
  return refreshed.access_token;
}
