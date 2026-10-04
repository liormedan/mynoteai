import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { LocaleSwitcher } from "@/components/locale-switcher";

export default async function Home() {
  const t = await getTranslations();

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 p-8">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold">{t("App.title")}</h1>
          <p className="text-muted-foreground">{t("App.tagline")}</p>
        </div>
        <LocaleSwitcher />
      </header>

      <Link
        href="/lab/editor"
        className="rounded-lg border p-4 transition-colors hover:bg-muted"
      >
        <div className="font-medium">{t("Home.editorLab")}</div>
        <div className="text-sm text-muted-foreground">
          {t("Home.editorLabDescription")}
        </div>
      </Link>
    </main>
  );
}
