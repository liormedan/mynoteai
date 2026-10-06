"use client";

import { useMemo } from "react";
import { clearPropertyValues, saveDatabase } from "@/lib/database/actions";
import {
  addProperty,
  removeProperty,
  updateProperty,
  updateView,
} from "@/lib/database/schema";
import type {
  Database,
  Filter,
  FilterOp,
  Property,
  PropertyType,
  Sort,
  View,
} from "@/lib/database/types";
import type { Page } from "@/lib/pages/model";

export type ViewEdits = ReturnType<typeof useViewEdits>;

/** Every change a view's UI makes, each one saved to the database page. */
export function useViewEdits(
  databaseId: string,
  database: Database,
  view: View,
  rows: Page[],
) {
  return useMemo(() => {
    const save = (db: Database) => void saveDatabase(databaseId, db);
    const setView = (patch: Partial<Omit<View, "id">>) =>
      save(updateView(database, view.id, patch));

    return {
      setView,
      setSorts: (sorts: Sort[]) => setView({ sorts }),
      setFilters: (filters: Filter[]) => setView({ filters }),

      sortBy: (prop: string, desc: boolean) =>
        setView({
          sorts: [{ prop, desc }, ...view.sorts.filter((s) => s.prop !== prop)],
        }),
      addFilter: (prop: string, op: FilterOp) =>
        setView({
          // One filter per property; asking again keeps the existing one.
          filters: view.filters.some((f) => f.prop === prop)
            ? view.filters
            : [...view.filters, { prop, op, value: null }],
        }),
      toggleHidden: (prop: string) =>
        setView({
          hidden: view.hidden.includes(prop)
            ? view.hidden.filter((h) => h !== prop)
            : [...view.hidden, prop],
        }),

      addProperty: (name: string, type: PropertyType) => {
        const result = addProperty(database, name, type);
        save(result.db);
        return result.id;
      },
      updateProperty: (
        id: string,
        patch: Partial<Pick<Property, "name" | "type">>,
      ) => save(updateProperty(database, id, patch)),
      removeProperty: (id: string) => {
        save(removeProperty(database, id));
        void clearPropertyValues(rows, id);
      },
    };
  }, [databaseId, database, view, rows]);
}
