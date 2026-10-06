import { FileText, Table2 } from "lucide-react";
import type { Page } from "@/lib/pages/model";
import { cn } from "@/lib/utils";

/** The page's emoji, or a generic page or database glyph. */
export function PageIcon({
  page,
  className,
}: {
  page: Pick<Page, "icon" | "type">;
  className?: string;
}) {
  if (page.icon) return <>{page.icon}</>;
  const Icon = page.type === "database" ? Table2 : FileText;
  return <Icon className={cn("inline size-4 opacity-60", className)} />;
}
