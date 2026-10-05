"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useTranslations } from "next-intl";
import { useTheme } from "next-themes";
import { useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";

const order = ["light", "dark", "system"] as const;
const icons = { light: Sun, dark: Moon, system: Monitor };

const subscribe = () => () => {};

/** Cycles light → dark → system. */
export function ThemeToggle() {
  const t = useTranslations("Theme");
  const { theme, setTheme } = useTheme();
  // The stored theme is only known in the browser; render a neutral icon on the server.
  const mounted = useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
  const current =
    mounted && order.includes(theme as never)
      ? (theme as (typeof order)[number])
      : "system";
  const next = order[(order.indexOf(current) + 1) % order.length];
  const Icon = icons[current];

  return (
    <Button
      variant="ghost"
      size="icon-sm"
      aria-label={t("switchTo", { theme: t(next) })}
      title={t(current)}
      onClick={() => setTheme(next)}
    >
      <Icon />
    </Button>
  );
}
