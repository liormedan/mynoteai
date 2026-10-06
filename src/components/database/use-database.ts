"use client";

import { useCallback, useMemo } from "react";
import { saveDatabase } from "@/lib/database/actions";
import { addOption } from "@/lib/database/schema";
import type { Database } from "@/lib/database/types";
import type { Row } from "@/lib/database/values";
import type { Page } from "@/lib/pages/model";
import { usePagesStore } from "@/lib/pages/store";

/** A database page, its definition and its live rows, from the pages store. */
export function useDatabase(databaseId: string | null) {
  const { all, byId } = usePagesStore();
  const page = databaseId ? byId.get(databaseId) : undefined;
  const database = page?.type === "database" ? page.database : null;

  const rows = useMemo(
    () =>
      databaseId
        ? all
            .filter((p) => p.parentId === databaseId && !p.isArchived)
            .sort((a, b) => a.position - b.position)
        : [],
    [all, databaseId],
  );

  /** Applies an edit to the definition and saves it. */
  const update = useCallback(
    (edit: (db: Database) => Database) => {
      if (!databaseId || !database) return;
      void saveDatabase(databaseId, edit(database));
    },
    [databaseId, database],
  );

  /** Adds a select option by name (or finds it) and returns its id. */
  const createOption = useCallback(
    (propId: string, name: string) => {
      if (!databaseId || !database) return null;
      const result = addOption(database, propId, name);
      if (result.db !== database) void saveDatabase(databaseId, result.db);
      return result.id;
    },
    [databaseId, database],
  );

  return { page, database, rows, update, createOption };
}

export const asRow = (p: Page): Row => ({
  id: p.id,
  title: p.title,
  position: p.position,
  props: p.props,
});
