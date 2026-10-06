import { addOption } from "./schema";
import type { Database, Property, Props, PropValue } from "./types";
import { displayText, valueOf, type Row } from "./values";

/*
 * Values as an agent writes and reads them: by field name, with option
 * names rather than ids, dates as YYYY-MM-DD.
 */

const DATE = /^\d{4}-\d{2}-\d{2}$/;

export function findProperty(db: Database, key: string): Property | undefined {
  const k = key.trim().toLocaleLowerCase();
  return (
    db.properties.find((p) => p.id === key) ??
    db.properties.find((p) => p.name.trim().toLocaleLowerCase() === k)
  );
}

/**
 * Converts `{ "Status": "Done", "Tags": ["home"] }` to stored props. Select
 * options that do not exist yet are added to the returned definition.
 */
export function propsFromInput(
  db: Database,
  input: Record<string, unknown>,
): { props: Props; db: Database; errors: string[] } {
  const props: Props = {};
  const errors: string[] = [];
  let next = db;

  for (const [key, raw] of Object.entries(input)) {
    const prop = findProperty(next, key);
    if (!prop) {
      errors.push(
        `Unknown field "${key}". Fields: ${db.properties.map((p) => p.name).join(", ")}`,
      );
      continue;
    }
    if (raw === null || raw === "") {
      props[prop.id] = prop.type === "checkbox" ? false : null;
      continue;
    }
    const option = (name: string) => {
      const result = addOption(next, prop.id, name.trim());
      next = result.db;
      return result.id;
    };
    switch (prop.type) {
      case "text":
      case "url":
        props[prop.id] = String(raw);
        break;
      case "number": {
        const n = typeof raw === "number" ? raw : Number(String(raw).trim());
        if (isFinite(n)) props[prop.id] = n;
        else
          errors.push(
            `"${prop.name}" needs a number, got ${JSON.stringify(raw)}`,
          );
        break;
      }
      case "checkbox":
        props[prop.id] = raw === true || String(raw).toLowerCase() === "true";
        break;
      case "date":
        if (typeof raw === "string" && DATE.test(raw)) props[prop.id] = raw;
        else
          errors.push(
            `"${prop.name}" needs a date as YYYY-MM-DD, got ${JSON.stringify(raw)}`,
          );
        break;
      case "select":
        props[prop.id] = option(String(Array.isArray(raw) ? raw[0] : raw));
        break;
      case "multiSelect": {
        const names = Array.isArray(raw)
          ? raw.map(String)
          : String(raw).split(",");
        props[prop.id] = names
          .map((n) => n.trim())
          .filter(Boolean)
          .map(option)
          .filter((id): id is string => id !== null);
        break;
      }
    }
  }
  return { props, db: next, errors };
}

/** A row as an agent reads it: title and each field by name. */
export function rowToRecord(db: Database, row: Row): Record<string, PropValue> {
  const out: Record<string, PropValue> = { title: row.title };
  for (const prop of db.properties) {
    const v = valueOf(row, prop);
    out[prop.name] =
      prop.type === "multiSelect" && Array.isArray(v)
        ? v
            .map((id) => prop.options.find((o) => o.id === id)?.name ?? "")
            .filter(Boolean)
        : prop.type === "select"
          ? displayText(prop, v) || null
          : v;
  }
  return out;
}

/** The definition as an agent reads it: field names, types and options. */
export function describeDatabase(db: Database) {
  return db.properties.map((p) => ({
    name: p.name,
    type: p.type,
    ...(p.options.length ? { options: p.options.map((o) => o.name) } : {}),
  }));
}
