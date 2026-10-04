"use client";

import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { locales } from "@/i18n/config";
import { setLocale } from "@/i18n/actions";

export function LocaleSwitcher() {
  const t = useTranslations("LocaleSwitcher");
  const current = useLocale();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <div role="group" aria-label={t("label")} className="flex gap-1">
      {locales.map((locale) => (
        <Button
          key={locale}
          size="sm"
          variant={locale === current ? "secondary" : "ghost"}
          aria-pressed={locale === current}
          disabled={pending}
          lang={locale}
          onClick={() =>
            startTransition(async () => {
              await setLocale(locale);
              router.refresh();
            })
          }
        >
          {t(locale)}
        </Button>
      ))}
    </div>
  );
}
