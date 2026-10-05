import { getTranslations } from "next-intl/server";
import { LocaleSwitcher } from "@/components/locale-switcher";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { LoginForm } from "./login-form";

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const t = await getTranslations("Login");
  const { error } = await searchParams;
  const emulator = process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATORS === "true";

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-6 p-6">
      <div className="flex justify-end">
        <LocaleSwitcher />
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">{t("title")}</CardTitle>
          <CardDescription>{t("subtitle")}</CardDescription>
        </CardHeader>
        <CardContent>
          <LoginForm notOwner={error === "not-owner"} />
        </CardContent>
      </Card>
      {emulator && (
        <p className="text-xs text-muted-foreground">
          {t("emulator", { email: process.env.OWNER_EMAIL ?? "" })}
        </p>
      )}
    </main>
  );
}
