import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { Editor } from "@/components/editor/dynamic-editor";
import { LocaleSwitcher } from "@/components/locale-switcher";
import type { Locale } from "@/i18n/config";
import { sampleContent } from "./sample-content";

export default async function EditorLabPage() {
  const t = await getTranslations("EditorLab");
  const locale = (await getLocale()) as Locale;

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 p-8">
      <header className="flex items-start justify-between gap-4">
        <div>
          <Link
            href="/"
            className="text-sm text-muted-foreground hover:underline"
          >
            {t("back")}
          </Link>
          <h1 className="text-2xl font-semibold">{t("title")}</h1>
          <p className="text-sm text-muted-foreground">{t("description")}</p>
        </div>
        <LocaleSwitcher />
      </header>

      <div className="rounded-lg border py-4">
        <Editor key={locale} locale={locale} initialContent={sampleContent} />
      </div>
    </main>
  );
}
