"use client";

import { useTranslations } from "next-intl";
import type { FilterOp, PropertyType } from "@/lib/database/types";

/** Translated names of field types and filter operators. */
export function useDatabaseLabels() {
  const t = useTranslations("Database");
  return {
    type: (type: PropertyType) => t(`type.${type}`),
    op: (op: FilterOp) => t(`op.${op}`),
  };
}
