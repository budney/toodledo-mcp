import type { ToodledoTokenResponse } from "../types.js";

const TOKEN_URL = "https://api.toodledo.com/3/account/token.php";

export function getAuthorizationUrl(clientId: string, state: string): string {
  const params = new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    state,
    scope: "basic tasks notes outlines lists write",
  });
  return `https://api.toodledo.com/3/account/authorize.php?${params}`;
}

export async function exchangeCodeForTokens(
  code: string,
  clientId: string,
  clientSecret: string
): Promise<ToodledoTokenResponse> {
  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${credentials}`,
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
    }),
  });

  const data = await response.json() as ToodledoTokenResponse;
  if (data.errorCode) {
    throw new Error(`Toodledo auth error ${data.errorCode}: ${data.errorDesc}`);
  }
  return data;
}

export async function refreshAccessToken(
  refreshToken: string,
  clientId: string,
  clientSecret: string
): Promise<ToodledoTokenResponse> {
  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${credentials}`,
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
  });

  const data = await response.json() as ToodledoTokenResponse;
  if (data.errorCode) {
    throw new Error(`Token refresh failed (${data.errorCode}): ${data.errorDesc}. Run 'npm run setup' to re-authenticate.`);
  }
  return data;
}
