import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { getConfigDir, loadConfig } from "../config.js";
import { refreshAccessToken } from "./oauth.js";
import type { TokenData, ToodledoTokenResponse } from "../types.js";

const TOKEN_FILE = join(getConfigDir(), "tokens.json");
const REFRESH_BUFFER_MS = 5 * 60 * 1000; // refresh 5 min before expiry

export function saveTokens(response: ToodledoTokenResponse): void {
  const dir = getConfigDir();
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  const data: TokenData = {
    access_token: response.access_token,
    refresh_token: response.refresh_token,
    expires_at: Date.now() + response.expires_in * 1000,
    scope: response.scope,
  };

  writeFileSync(TOKEN_FILE, JSON.stringify(data, null, 2));
}

function loadTokens(): TokenData {
  if (!existsSync(TOKEN_FILE)) {
    throw new Error(
      `No tokens found at ${TOKEN_FILE}. Run 'npm run setup' to authenticate with Toodledo.`
    );
  }
  return JSON.parse(readFileSync(TOKEN_FILE, "utf-8")) as TokenData;
}

export async function getAccessToken(): Promise<string> {
  const tokens = loadTokens();

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
