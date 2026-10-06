import { cn } from "@/lib/utils";
import type { OptionColor, SelectOption } from "@/lib/database/types";

export const OPTION_CLASSES: Record<OptionColor, string> = {
  gray: "bg-zinc-200 text-zinc-800 dark:bg-zinc-700 dark:text-zinc-100",
  brown:
    "bg-amber-200/70 text-amber-950 dark:bg-amber-900/70 dark:text-amber-100",
  orange:
    "bg-orange-200 text-orange-900 dark:bg-orange-900/70 dark:text-orange-100",
  yellow:
    "bg-yellow-200 text-yellow-900 dark:bg-yellow-800/70 dark:text-yellow-100",
  green: "bg-green-200 text-green-900 dark:bg-green-900/70 dark:text-green-100",
  blue: "bg-blue-200 text-blue-900 dark:bg-blue-900/70 dark:text-blue-100",
  purple:
    "bg-purple-200 text-purple-900 dark:bg-purple-900/70 dark:text-purple-100",
  pink: "bg-pink-200 text-pink-900 dark:bg-pink-900/70 dark:text-pink-100",
  red: "bg-red-200 text-red-900 dark:bg-red-900/70 dark:text-red-100",
};

export function OptionBadge({
  option,
  className,
}: {
  option: SelectOption;
  className?: string;
}) {
  return (
    <bdi
      className={cn(
        "inline-block max-w-full truncate rounded px-1.5 py-0.5 text-xs leading-tight",
        OPTION_CLASSES[option.color],
        className,
      )}
    >
      {option.name}
    </bdi>
  );
}
