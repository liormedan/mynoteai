import { headers } from "next/headers";
import { AgentsView } from "@/components/agents/agents-view";
import { adminConfigured } from "@/lib/server/firebase-admin";

/** How to connect an agent over MCP, and whether the server is on. */
export default async function AgentsPage() {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto =
    h.get("x-forwarded-proto") ??
    (host.startsWith("localhost") ? "http" : "https");
  const token = process.env.MCP_TOKEN ?? "";
  return (
    <AgentsView
      url={`${proto}://${host}/api/mcp`}
      enabled={token.length >= 32 && adminConfigured()}
      tokenTooShort={token.length > 0 && token.length < 32}
    />
  );
}
