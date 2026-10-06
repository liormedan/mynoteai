"use client";

import { Search } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { useCommandPalette, useShortcutLabel } from "./command-palette";

/** Opens the command window: a wide field on desktop, an icon on phones. */
export function SearchButton() {
  const t = useTranslations("Command");
  const { open } = useCommandPalette();
  const shortcut = useShortcutLabel("palette");
  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="hidden w-56 justify-start text-muted-foreground md:inline-flex"
        onClick={open}
      >
        <Search />
        <span className="flex-1 text-start">{t("open")}</span>
        <kbd dir="ltr" className="text-xs tracking-widest">
          {shortcut}
        </kbd>
      </Button>
      <Button
        variant="ghost"
        size="icon-sm"
        className="md:hidden"
        aria-label={t("open")}
        onClick={open}
      >
        <Search />
      </Button>
    </>
  );
}
