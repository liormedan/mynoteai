import { timingSafeEqual } from "node:crypto";
import { createMcpHandler } from "mcp-handler";
import { adminConfigured } from "@/lib/server/firebase-admin";
import { registerTools } from "@/lib/server/mcp-tools";

/*
 * The notebook's MCP server (Streamable HTTP). Off unless MCP_TOKEN is set;
 * every request must carry it as "Authorization: Bearer <token>". The
 * token is the owner's key, so tools act with full access.
 */

export const runtime = "nodejs";

const appUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL
  ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
  : (process.env.NEXT_PUBLIC_APP_URL ?? null);

const mcp = createMcpHandler((server) => registerTools(server, appUrl), {
  serverInfo: { name: "mynoteai", version: "0.6.0" },
  instructions:
    "A personal notebook (Hebrew and English). Find pages with search_pages or list_pages, read them with get_page, and write with create_page, append_to_page and the database tools. Ids come from search and list results.",
});

function authorized(req: Request, token: string) {
  const header = req.headers.get("authorization") ?? "";
  const given = Buffer.from(header.replace(/^Bearer\s+/i, ""));
  const expected = Buffer.from(token);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

async function handler(req: Request) {
  const token = process.env.MCP_TOKEN;
  // Off by default: without a token (or without server access) there is no endpoint.
  if (!token || token.length < 32 || !adminConfigured()) {
    return new Response("Not found", { status: 404 });
  }
  if (!authorized(req, token)) {
    return Response.json(
      {
        error: "unauthorized",
        message: "Send the MCP token as: Authorization: Bearer <MCP_TOKEN>",
      },
      {
        status: 401,
        headers: { "WWW-Authenticate": 'Bearer realm="mynoteai"' },
      },
    );
  }
  return mcp(req);
}

export { handler as GET, handler as POST, handler as DELETE };
