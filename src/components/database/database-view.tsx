"use client";

import { useMemo, useState } from "react";
import { addRow } from "@/lib/database/actions";
import type { Database, View } from "@/lib/database/types";
import { valuesFromFilters } from "@/lib/database/values";
import type { Page } from "@/lib/pages/model";
import { usePagesStore } from "@/lib/pages/store";
import { BoardView } from "./board-view";
import { TableView } from "./table-view";
import { asRow, useDatabase } from "./use-database";
import { useViewEdits } from "./view-edits";
import { ViewTabs } from "./view-tabs";
import { ViewToolbar } from "./view-toolbar";

/** A database page's body: its current view and the controls above it. */
export function DatabaseView({ page }: { page: Page }) {
  const { all } = usePagesStore();
  const { database, rows, createOption } = useDatabase(page.id);
  const [viewId, setViewId] = useState<string | null>(() =>
    readLastView(page.id),
  );
  const [editingTitle, setEditingTitle] = useState<string | null>(null);
  const view =
    database?.views.find((v) => v.id === viewId) ?? database?.views[0];

  if (!database || !view) return null;

  /** A new row at the end, matching the filters (and the board column). */
  const onAddRow = async (values: Record<string, string> = {}) => {
    const last = rows.at(-1);
    const id = await addRow(all, page.id, {
      props: { ...valuesFromFilters(database, view.filters), ...values },
      position: last ? last.position + 1 : Date.now(),
    });
    setEditingTitle(id);
  };

  return (
    <DatabaseBody
      page={page}
      database={database}
      view={view}
      rows={rows}
      onAddRow={onAddRow}
      createOption={createOption}
      editingTitle={editingTitle}
      onEditingTitle={setEditingTitle}
      onSelectView={(id) => {
        setViewId(id);
        writeLastView(page.id, id);
      }}
    />
  );
}

/** The view last opened in this browser, per database (a convenience only). */
const lastViewKey = (id: string) => `mynoteai:db-view:${id}`;
function readLastView(databaseId: string) {
  try {
    return localStorage.getItem(lastViewKey(databaseId));
  } catch {
    return null;
  }
}
function writeLastView(databaseId: string, viewId: string) {
  try {
    localStorage.setItem(lastViewKey(databaseId), viewId);
  } catch {
    // private window: the first view opens next time
  }
}

function DatabaseBody({
  page,
  database,
  view,
  rows,
  onAddRow,
  createOption,
  editingTitle,
  onEditingTitle,
  onSelectView,
}: {
  page: Page;
  database: Database;
  view: View;
  rows: Page[];
  onAddRow: (values?: Record<string, string>) => void;
  createOption: (propId: string, name: string) => string | null;
  editingTitle: string | null;
  onEditingTitle: (id: string | null) => void;
  onSelectView: (id: string) => void;
}) {
  const edits = useViewEdits(page.id, database, view, rows);
  const viewRows = useMemo(() => rows.map(asRow), [rows]);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-2">
        <ViewTabs
          databaseId={page.id}
          database={database}
          active={view}
          onSelect={onSelectView}
        />
        <ViewToolbar
          database={database}
          view={view}
          edits={edits}
          onAddRow={() => onAddRow()}
        />
      </div>
      {view.type === "board" ? (
        <BoardView
          databaseId={page.id}
          database={database}
          view={view}
          rows={viewRows}
          edits={edits}
          onAddRow={onAddRow}
          editingTitle={editingTitle}
          onEditingTitle={onEditingTitle}
        />
      ) : (
        <TableView
          database={database}
          view={view}
          rows={viewRows}
          edits={edits}
          createOption={createOption}
          onAddRow={() => onAddRow()}
          editingTitle={editingTitle}
          onEditingTitle={onEditingTitle}
        />
      )}
    </div>
  );
}
