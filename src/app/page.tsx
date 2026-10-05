import { getTokens } from "next-firebase-auth-edge";
import { getTranslations } from "next-intl/server";
import { cookies } from "next/headers";
import Link from "next/link";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { SignOutButton } from "@/components/sign-out-button";
import { authConfig } from "@/lib/auth/config";

export default async function Home() {
  const t = await getTranslations();
  const tokens = await getTokens(await cookies(), authConfig);
  const email = tokens?.decodedToken.email ?? "";

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 p-8">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold">{t("App.title")}</h1>
          <p className="text-muted-foreground">{t("App.tagline")}</p>
        </div>
        <div className="flex items-center gap-2">
          <LocaleSwitcher />
        </div>
      </header>

      <div className="flex items-center justify-between gap-4 rounded-lg border px-4 py-2 text-sm">
        <span>
          {t.rich("Home.signedInAs", {
            email,
            // Keep the address LTR inside a Hebrew sentence.
            addr: (chunks) => (
              <bdi dir="ltr" className="font-medium">
                {chunks}
              </bdi>
            ),
          })}
        </span>
        <SignOutButton />
      </div>

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
