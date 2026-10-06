"use client";

import { setRowValue } from "@/lib/database/actions";
import type { Page } from "@/lib/pages/model";
import { PropertyIcon } from "./property-icon";
import { PropertyValue } from "./property-value";
import { useDatabase } from "./use-database";

/** The values of a database row, above its text. */
export function RowProperties({ row }: { row: Page }) {
  const { database, createOption } = useDatabase(row.parentId);
  if (!database || !database.properties.length) return null;

  return (
    <dl className="mt-2 grid grid-cols-[minmax(7rem,10rem)_1fr] items-start gap-x-2 gap-y-0.5 border-b pb-3">
      {database.properties.map((prop) => (
        <div key={prop.id} className="contents">
          <dt className="flex h-9 min-w-0 items-center gap-1.5 text-sm text-muted-foreground">
            <PropertyIcon type={prop.type} />
            <bdi className="truncate">{prop.name}</bdi>
          </dt>
          <dd className="min-w-0">
            <PropertyValue
              variant="panel"
              prop={prop}
              raw={row.props[prop.id]}
              onChange={(v) => void setRowValue(row.id, prop.id, v)}
              onCreateOption={(name) => createOption(prop.id, name)}
            />
          </dd>
        </div>
      ))}
    </dl>
  );
}
