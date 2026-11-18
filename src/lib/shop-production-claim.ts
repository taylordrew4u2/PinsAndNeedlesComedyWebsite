import "server-only";
import { createHash } from "node:crypto";
import { createFile, githubConfig } from "./github-store";

export function productionClaimsConfigured(): boolean {
  return githubConfig(process.env) !== null;
}

/** Permanent, create-only intent. Never lease, expire, overwrite or auto-delete. */
export async function claimProduction(shopId: string, orderId: string): Promise<boolean> {
  const config = githubConfig(process.env);
  if (!config) throw new Error("Durable production claims not configured");
  const hash = createHash("sha256").update(JSON.stringify([shopId, orderId])).digest("hex");
  try {
    return await createFile(config, `shop-production-claims/${hash}.json`,
      Buffer.from(JSON.stringify({ version: 1, intent: "production", createdAt: new Date().toISOString() })),
      "Record shop production intent");
  } catch {
    // A lost claim response must never authorize a send. It may have committed.
    throw new Error("Production claim unavailable; retry or review required");
  }
}
