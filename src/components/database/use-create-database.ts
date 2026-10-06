"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useCallback } from "react";
import { createDatabase } from "@/lib/database/actions";
import { usePagesStore } from "@/lib/pages/store";

/** Creates a database (in the UI language) and opens it. */
export function useCreateDatabase(onNavigate?: () => void) {
  const t = useTranslations("Database");
  const router = useRouter();
  const { all } = usePagesStore();
  return useCallback(
    async (parentId: string | null = null) => {
      const id = await createDatabase(all, parentId, {
        title: t("defaultTitle"),
        status: t("defaultStatus"),
        todo: t("defaultTodo"),
        doing: t("defaultDoing"),
        done: t("defaultDone"),
        table: t("viewTable"),
        board: t("viewBoard"),
      });
      router.push(`/p/${id}`);
      onNavigate?.();
    },
    [all, t, router, onNavigate],
  );
}
