import "server-only";

import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import { PROPERTY_TYPES } from "@/lib/database/types";
import {
  addDatabaseRow,
  appendToPage,
  createDatabase,
  createPage,
  InputError,
  NotFoundError,
  outline,
  queryDatabase,
  readPage,
  searchPages,
  trashPage,
  updateDatabaseRow,
  updatePage,
} from "./notebook";

/*
 * The tools an agent gets. Descriptions are written for the model: what the
 * tool does, what it returns, and how ids flow from one tool to the next.
 */

const text = (t: string) => ({ content: [{ type: "text" as const, text: t }] });
const json = (v: unknown) => text(JSON.stringify(v, null, 2));

/** Expected failures go back to the agent as text it can act on. */
async function run(fn: () => Promise<ReturnType<typeof text>>) {
  try {
    return await fn();
  } catch (e) {
    if (e instanceof NotFoundError || e instanceof InputError) {
      return { ...text(e.message), isError: true };
    }
    throw e;
  }
}

const value = z.union([
  z.string(),
  z.number(),
  z.boolean(),
  z.array(z.string()),
  z.null(),
]);
const values = z
  .record(z.string(), value)
  .describe(
    'Field values by field name, e.g. {"Status": "Done", "Tags": ["home"], "Due": "2026-10-09", "Estimate": 3}. Select options that do not exist yet are created.',
  );

export function registerTools(server: McpServer, appUrl: string | null) {
  const link = (id: string) => (appUrl ? `${appUrl}/p/${id}` : `/p/${id}`);
  const read = { readOnlyHint: true, openWorldHint: false };
  const write = {
    readOnlyHint: false,
    destructiveHint: false,
    openWorldHint: false,
  };

  server.registerTool(
    "search_pages",
    {
      title: "Search pages",
      description:
        "Full-text search over page titles and text in the notebook (Hebrew and English). Hebrew prefixes are handled: 'בבית' finds 'בית'. Every word must match. Returns pages with id, path and a snippet; read one with get_page.",
      inputSchema: z.object({
        query: z.string().min(1).describe("Words to find"),
        limit: z.number().int().min(1).max(50).default(10),
      }),
      annotations: read,
    },
    ({ query, limit }) =>
      run(async () => {
        const hits = await searchPages(query, limit);
        return hits.length
          ? json(hits.map((h) => ({ ...h, url: link(h.id) })))
          : text("No pages found.");
      }),
  );

  server.registerTool(
    "list_pages",
    {
      title: "List pages",
      description:
        "The page tree as an indented outline with ids, from the top level or under one page. Databases show their row count; read their rows with query_database.",
      inputSchema: z.object({
        parent_id: z
          .string()
          .optional()
          .describe("List under this page; omit for the top level"),
        depth: z.number().int().min(1).max(10).default(3),
      }),
      annotations: read,
    },
    ({ parent_id, depth }) =>
      run(async () => text(await outline(parent_id ?? null, depth))),
  );

  server.registerTool(
    "get_page",
    {
      title: "Read a page",
      description:
        "A page as Markdown: title, path, field values (for database rows), subpages, then its content. Links to other pages appear as [title](/p/<id>).",
      inputSchema: z.object({ page_id: z.string().min(1) }),
      annotations: read,
    },
    ({ page_id }) =>
      run(async () => text(`${await readPage(page_id)}\n\n${link(page_id)}`)),
  );

  server.registerTool(
    "query_database",
    {
      title: "Query a database",
      description:
        'Rows of a database with their field values by field name, plus the fields and their options. Optional exact-match filter by field name, e.g. {"Status": "In progress"}.',
      inputSchema: z.object({
        database_id: z.string().min(1),
        where: z
          .record(z.string(), z.union([z.string(), z.number(), z.boolean()]))
          .default({}),
        limit: z.number().int().min(1).max(500).default(100),
      }),
      annotations: read,
    },
    ({ database_id, where, limit }) =>
      run(async () => json(await queryDatabase(database_id, where, limit))),
  );

  server.registerTool(
    "create_page",
    {
      title: "Create a page",
      description:
        "Creates a page with Markdown content (headings, lists, - [ ] tasks, quotes, code, tables; [title](/p/<id>) links to another page). At the top level, or under parent_id. Returns its id.",
      inputSchema: z.object({
        title: z.string().max(500),
        markdown: z.string().default(""),
        parent_id: z.string().optional(),
        icon: z.string().max(16).optional().describe("One emoji"),
      }),
      annotations: write,
    },
    ({ title, markdown, parent_id, icon }) =>
      run(async () => {
        const id = await createPage({
          title,
          markdown,
          parentId: parent_id ?? null,
          icon,
        });
        return json({ id, url: link(id) });
      }),
  );

  server.registerTool(
    "append_to_page",
    {
      title: "Append to a page",
      description:
        "Adds Markdown to the end of a page, after its existing content. Nothing is replaced. If the page is open in the app, it updates there.",
      inputSchema: z.object({
        page_id: z.string().min(1),
        markdown: z.string().min(1),
      }),
      annotations: write,
    },
    ({ page_id, markdown }) =>
      run(async () => {
        const n = await appendToPage(page_id, markdown);
        return text(
          `Added ${n} block${n === 1 ? "" : "s"} to ${link(page_id)}`,
        );
      }),
  );

  server.registerTool(
    "update_page",
    {
      title: "Rename a page or change its icon",
      description:
        "Changes a page's title and/or icon (one emoji; empty string removes it).",
      inputSchema: z.object({
        page_id: z.string().min(1),
        title: z.string().max(500).optional(),
        icon: z.string().max(16).optional(),
      }),
      annotations: write,
    },
    ({ page_id, title, icon }) =>
      run(async () => {
        await updatePage(page_id, { title, icon });
        return text(`Updated ${link(page_id)}`);
      }),
  );

  server.registerTool(
    "create_database",
    {
      title: "Create a database",
      description:
        "Creates a database page (a table whose rows are pages) with the given fields. Field types: text, number, select, multiSelect, date, checkbox, url. A select field also gets a board view grouped by it — e.g. a Status field with To do / In progress / Done makes a task board.",
      inputSchema: z.object({
        title: z.string().max(500),
        parent_id: z.string().optional(),
        fields: z
          .array(
            z.object({
              name: z.string().min(1).max(100),
              type: z.enum(PROPERTY_TYPES),
              options: z
                .array(z.string())
                .optional()
                .describe("For select and multiSelect"),
            }),
          )
          .max(50),
      }),
      annotations: write,
    },
    ({ title, parent_id, fields }) =>
      run(async () => {
        const id = await createDatabase({
          title,
          parentId: parent_id ?? null,
          fields,
        });
        return json({ id, url: link(id) });
      }),
  );

  server.registerTool(
    "add_database_row",
    {
      title: "Add a database row",
      description:
        "Adds a row to a database: its title, field values by field name, and optional Markdown content for the row's page. Use query_database first to see the fields.",
      inputSchema: z.object({
        database_id: z.string().min(1),
        title: z.string().max(500),
        values: values.default({}),
        markdown: z.string().optional(),
      }),
      annotations: write,
    },
    ({ database_id, title, values, markdown }) =>
      run(async () => {
        const id = await addDatabaseRow(database_id, title, values, markdown);
        return json({ id, url: link(id) });
      }),
  );

  server.registerTool(
    "update_database_row",
    {
      title: "Update a database row",
      description:
        'Changes a row\'s title and/or field values by field name, e.g. move a task on the board with {"Status": "Done"}. Fields not given stay as they are.',
      inputSchema: z.object({
        row_id: z.string().min(1),
        title: z.string().max(500).optional(),
        values: values.optional(),
      }),
      annotations: write,
    },
    ({ row_id, title, values }) =>
      run(async () => {
        await updateDatabaseRow(row_id, { title, values });
        return text(`Updated ${link(row_id)}`);
      }),
  );

  server.registerTool(
    "move_to_trash",
    {
      title: "Move a page to the trash",
      description:
        "Moves a page (with its subpages) to the trash. The owner can restore it from the app; nothing is deleted for good.",
      inputSchema: z.object({ page_id: z.string().min(1) }),
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    ({ page_id }) =>
      run(async () => {
        const title = await trashPage(page_id);
        return text(`Moved "${title}" to the trash.`);
      }),
  );
}
