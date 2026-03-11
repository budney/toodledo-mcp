import { SecretManagerServiceClient } from "@google-cloud/secret-manager";
import type { TokenData } from "../types.js";

const client = new SecretManagerServiceClient();

function getProject(): string {
  const project = process.env.GOOGLE_CLOUD_PROJECT;
  if (!project) throw new Error("GOOGLE_CLOUD_PROJECT not set");
  return project;
}

export async function loadTokensFromSecret(): Promise<TokenData> {
  // First check if injected as env var (Cloud Run mounts secret as env)
  const envTokens = process.env.TOODLEDO_TOKENS;
  if (envTokens) {
    return JSON.parse(envTokens) as TokenData;
  }

  // Otherwise read from Secret Manager API
  const project = getProject();
  const [version] = await client.accessSecretVersion({
    name: `projects/${project}/secrets/TOODLEDO_TOKENS/versions/latest`,
  });

  const payload = version.payload?.data;
  if (!payload) throw new Error("TOODLEDO_TOKENS secret has no data");

  const raw = typeof payload === "string" ? payload : Buffer.from(payload).toString("utf-8");
  return JSON.parse(raw) as TokenData;
}

export async function saveTokensToSecret(tokens: TokenData): Promise<void> {
  const project = getProject();
  await client.addSecretVersion({
    parent: `projects/${project}/secrets/TOODLEDO_TOKENS`,
    payload: {
      data: Buffer.from(JSON.stringify(tokens)),
    },
  });
}
