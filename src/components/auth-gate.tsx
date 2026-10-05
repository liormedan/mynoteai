"use client";

import { onAuthStateChanged, type User } from "firebase/auth";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { endSession } from "@/lib/auth/client";
import { getFirebase } from "@/lib/firebase/client";

/**
 * The proxy already checked the session cookie. Firestore, however, talks to
 * the browser's own Firebase Auth session; wait for it before rendering
 * anything that reads data, and sign out fully if the two ever disagree.
 */
export function AuthGate({ children }: { children: React.ReactNode }) {
  const t = useTranslations("App");
  const router = useRouter();
  const [user, setUser] = useState<User | null | undefined>(undefined);

  useEffect(
    () =>
      onAuthStateChanged(getFirebase().auth, (u) => {
        setUser(u);
        if (!u) {
          void endSession().finally(() => {
            router.replace("/login");
            router.refresh();
          });
        }
      }),
    [router],
  );

  if (!user) {
    return (
      <p role="status" className="p-8 text-sm text-muted-foreground">
        {t("loading")}
      </p>
    );
  }
  return children;
}
