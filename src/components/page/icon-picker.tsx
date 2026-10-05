"use client";

import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

const EMOJIS = [
  "📝 📒 📓 📔 📚 📖 🗂️ 📁",
  "📌 📍 🔖 🏷️ ✅ ☑️ 🗓️ ⏰",
  "💡 🧠 🎯 🚀 ⭐ 🔥 ✨ 🌱",
  "🏠 💼 💰 🛒 ✈️ 🍽️ 🏃 ❤️",
  "🎵 🎬 📷 🎨 💻 🛠️ 🧪 📊",
  "👋 🙂 🤔 🎉 🙏 👀 🌍 ☕",
]
  .join(" ")
  .split(" ");

type Props = {
  value: string | null;
  onChange: (icon: string | null) => void;
  children: React.ReactNode;
};

/** A small emoji grid; enough for page icons without an emoji library. */
export function IconPicker({ value, onChange, children }: Props) {
  const t = useTranslations("Page");
  return (
    <Popover>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent align="start" className="w-72">
        <p className="mb-2 text-sm font-medium">{t("chooseIcon")}</p>
        <div className="grid grid-cols-8 gap-1">
          {EMOJIS.map((emoji) => (
            <button
              key={emoji}
              type="button"
              aria-pressed={emoji === value}
              className="flex aspect-square items-center justify-center rounded text-xl hover:bg-muted aria-pressed:bg-muted"
              onClick={() => onChange(emoji)}
            >
              {emoji}
            </button>
          ))}
        </div>
        {value && (
          <Button
            variant="ghost"
            size="sm"
            className="mt-2 w-full"
            onClick={() => onChange(null)}
          >
            {t("removeIcon")}
          </Button>
        )}
      </PopoverContent>
    </Popover>
  );
}
