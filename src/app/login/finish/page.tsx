"use client";

import { isSignInWithEmailLink, signInWithEmailLink } from "firebase/auth";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { EMAIL_FOR_SIGN_IN, startSession } from "@/lib/auth/client";
import { getFirebase } from "@/lib/firebase/client";

async function completeSignIn(address: string) {
  const { user } = await signInWithEmailLink(
    getFirebase().auth,
    address,
    window.location.href,
  );
  window.localStorage.removeItem(EMAIL_FOR_SIGN_IN);
  await startSession(user);
}

/** Landing page for the email sign-in link. */
export default function FinishSignInPage() {
  const t = useTranslations("Login");
  const router = useRouter();
  // undefined on the server, string | null in the browser.
  const savedEmail = useSyncExternalStore(
    () => () => {},
    () => window.localStorage.getItem(EMAIL_FOR_SIGN_IN),
    () => undefined,
  );
  // Opened on another device, or storage was cleared: ask for the address.
  const needEmail = savedEmail === null;
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);

  const finish = useCallback(
    (address: string) =>
      completeSignIn(address)
        .then(() => {
          router.replace("/");
          router.refresh();
        })
        .catch((e) => {
          console.error(e);
          setError(t("failed"));
        }),
    [router, t],
  );

  useEffect(() => {
    if (!isSignInWithEmailLink(getFirebase().auth, window.location.href)) {
      router.replace("/login");
      return;
    }
    if (savedEmail) void finish(savedEmail);
  }, [finish, router, savedEmail]);

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-4 p-6">
      {needEmail ? (
        <form
          className="flex flex-col gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void finish(email);
          }}
        >
          <Label htmlFor="email">{t("enterEmailAgain")}</Label>
          <Input
            id="email"
            type="email"
            dir="ltr"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <Button type="submit">{t("confirm")}</Button>
        </form>
      ) : (
        <p role="status">{t("finishing")}</p>
      )}
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </main>
  );
}
