"use client";

import { signOut as firebaseSignOut, type User } from "firebase/auth";
import { getFirebase } from "@/lib/firebase/client";

/** Exchanges the Firebase ID token for the signed session cookies set by the proxy. */
export async function startSession(user: User) {
  const idToken = await user.getIdToken();
  const res = await fetch("/api/login", {
    headers: { Authorization: `Bearer ${idToken}` },
  });
  if (!res.ok) throw new Error(`Login failed: ${res.status}`);
}

export async function endSession() {
  await firebaseSignOut(getFirebase().auth);
  await fetch("/api/logout");
}

export const EMAIL_FOR_SIGN_IN = "mynoteai:emailForSignIn";
