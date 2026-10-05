"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { endSession } from "@/lib/auth/client";

export function SignOutButton() {
  const t = useTranslations("Home");
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <Button
      variant="ghost"
      size="sm"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          await endSession();
          router.replace("/login");
          router.refresh();
        })
      }
    >
      {t("signOut")}
    </Button>
  );
}
