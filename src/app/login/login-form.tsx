"use client";

import {
  GoogleAuthProvider,
  sendSignInLinkToEmail,
  signInWithPopup,
} from "firebase/auth";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { EMAIL_FOR_SIGN_IN, endSession, startSession } from "@/lib/auth/client";
import { getFirebase } from "@/lib/firebase/client";

type Props = { notOwner: boolean };

export function LoginForm({ notOwner }: Props) {
  const t = useTranslations("Login");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [email, setEmail] = useState("");
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(
    notOwner ? t("notOwner") : null,
  );

  // The proxy already dropped the session cookie; drop the client session too.
  useEffect(() => {
    if (notOwner) void endSession().catch(() => {});
  }, [notOwner]);

  const signInWithGoogle = () =>
    startTransition(async () => {
      setError(null);
      try {
        const { user } = await signInWithPopup(
          getFirebase().auth,
          new GoogleAuthProvider(),
        );
        await startSession(user);
        router.replace("/");
        router.refresh();
      } catch (e) {
        console.error(e);
        setError(t("failed"));
      }
    });

  const sendLink = (event: React.FormEvent) => {
    event.preventDefault();
    startTransition(async () => {
      setError(null);
      try {
        await sendSignInLinkToEmail(getFirebase().auth, email, {
          url: new URL("/login/finish", window.location.origin).toString(),
          handleCodeInApp: true,
        });
        window.localStorage.setItem(EMAIL_FOR_SIGN_IN, email);
        setSentTo(email);
      } catch (e) {
        console.error(e);
        setError(t("failed"));
      }
    });
  };

  return (
    <div className="flex flex-col gap-4">
      <Button onClick={signInWithGoogle} disabled={pending} size="lg">
        {t("google")}
      </Button>

      <div className="flex items-center gap-3 text-sm text-muted-foreground">
        <span className="h-px flex-1 bg-border" />
        {t("or")}
        <span className="h-px flex-1 bg-border" />
      </div>

      {sentTo ? (
        <p role="status" className="text-sm">
          {t("linkSent", { email: sentTo })}
        </p>
      ) : (
        <form onSubmit={sendLink} className="flex flex-col gap-2">
          <Label htmlFor="email">{t("emailLabel")}</Label>
          <Input
            id="email"
            type="email"
            dir="ltr"
            required
            autoComplete="email"
            placeholder={t("emailPlaceholder")}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <Button type="submit" variant="outline" disabled={pending}>
            {t("sendLink")}
          </Button>
        </form>
      )}

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
