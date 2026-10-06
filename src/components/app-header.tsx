import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { SignOutButton } from "@/components/sign-out-button";
import { ThemeToggle } from "@/components/theme/theme-toggle";

export async function AppHeader({ children }: { children?: React.ReactNode }) {
  const t = await getTranslations("App");
  return (
    <header className="sticky top-0 z-30 flex h-12 items-center gap-2 border-b bg-background/90 px-4 backdrop-blur">
      <Link href="/" className="font-semibold">
        {t("title")}
      </Link>
      <div className="flex min-w-0 flex-1 items-center gap-2">{children}</div>
      {/* On phones the language is switched from the command window. */}
      <LocaleSwitcher className="hidden sm:flex" />
      <ThemeToggle />
      <SignOutButton />
    </header>
  );
}
