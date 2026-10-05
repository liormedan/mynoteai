"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  GRADIENTS,
  gradientCover,
  isImageUrl,
  type GradientName,
} from "@/lib/pages/cover";

type Props = {
  value: string | null;
  onChange: (cover: string | null) => void;
  children: React.ReactNode;
};

export function CoverPicker({ value, onChange, children }: Props) {
  const t = useTranslations("Page");
  const [link, setLink] = useState("");
  const [invalid, setInvalid] = useState(false);

  return (
    <Popover>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent align="end" className="w-80">
        <p className="mb-2 text-sm font-medium">{t("gradients")}</p>
        <div className="grid grid-cols-4 gap-2">
          {(Object.keys(GRADIENTS) as GradientName[]).map((name) => (
            <button
              key={name}
              type="button"
              aria-label={name}
              aria-pressed={value === gradientCover(name)}
              className="h-10 rounded-md ring-offset-2 ring-offset-background aria-pressed:ring-2 aria-pressed:ring-ring"
              style={{ background: GRADIENTS[name] }}
              onClick={() => onChange(gradientCover(name))}
            />
          ))}
        </div>

        <form
          className="mt-4 flex flex-col gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (!isImageUrl(link)) return setInvalid(true);
            setInvalid(false);
            onChange(link);
          }}
        >
          <label htmlFor="cover-link" className="text-sm font-medium">
            {t("imageLink")}
          </label>
          <div className="flex gap-2">
            <Input
              id="cover-link"
              dir="ltr"
              value={link}
              placeholder={t("imageLinkPlaceholder")}
              onChange={(e) => setLink(e.target.value)}
              aria-invalid={invalid}
            />
            <Button type="submit" variant="outline">
              {t("apply")}
            </Button>
          </div>
          {invalid && (
            <p className="text-xs text-destructive">{t("invalidLink")}</p>
          )}
        </form>

        {value && (
          <Button
            variant="ghost"
            size="sm"
            className="mt-2 w-full"
            onClick={() => onChange(null)}
          >
            {t("removeCover")}
          </Button>
        )}
      </PopoverContent>
    </Popover>
  );
}
