import "server-only";

import type { TokenSet } from "next-firebase-auth-edge/auth";

/*
 * Server-side auth settings for next-firebase-auth-edge.
 * Locally everything comes from .env.development (emulator). On Vercel, set:
 *   NEXT_PUBLIC_FIREBASE_*            web app config (Firebase console → Project settings)
 *   OWNER_EMAIL                       the only account allowed in
 *   COOKIE_SECRET_CURRENT / _PREVIOUS random strings, at least 32 characters
 *   FIREBASE_ADMIN_CLIENT_EMAIL       service account (Project settings → Service accounts)
 *   FIREBASE_ADMIN_PRIVATE_KEY        its private key, with \n escapes
 */

const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY;

export const authConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY!,
  cookieName: "mynoteai-auth",
  cookieSignatureKeys: [
    process.env.COOKIE_SECRET_CURRENT!,
    process.env.COOKIE_SECRET_PREVIOUS!,
  ],
  cookieSerializeOptions: {
    path: "/",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    maxAge: 12 * 60 * 60 * 24, // twelve days
  },
  // Not needed against the Auth emulator; required in production.
  serviceAccount: privateKey
    ? {
        projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID!,
        clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL!,
        privateKey: privateKey.replace(/\\n/g, "\n"),
      }
    : undefined,
  enableMultipleCookies: true,
  enableCustomToken: false,
  getMetadata: async (tokens: TokenSet) => ({
    email: tokens.decodedIdToken.email ?? null,
  }),
};

export const authCookieNames = ["id", "refresh", "custom", "sig"].map(
  (part) => `${authConfig.cookieName}.${part}`,
);

export function isOwner(email: string | undefined, emailVerified: unknown) {
  const owner = process.env.OWNER_EMAIL?.trim().toLowerCase();
  return (
    Boolean(owner) &&
    emailVerified === true &&
    email?.trim().toLowerCase() === owner
  );
}
