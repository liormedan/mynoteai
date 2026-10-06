import "server-only";

import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore, type Firestore } from "firebase-admin/firestore";

/**
 * Firestore with admin rights, for server code that acts as the owner (the
 * MCP server). Under `pnpm dev`, FIRESTORE_EMULATOR_HOST points it at the
 * emulator; on Vercel it uses the service account from the environment.
 */
export function adminDb(): Firestore {
  const app =
    getApps()[0] ??
    initializeApp({
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      ...(process.env.FIRESTORE_EMULATOR_HOST
        ? {}
        : {
            credential: cert({
              projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
              clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
              privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(
                /\\n/g,
                "\n",
              ),
            }),
          }),
    });
  return getFirestore(app);
}

/** Whether the server can reach Firestore at all. */
export const adminConfigured = () =>
  Boolean(
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID &&
    (process.env.FIRESTORE_EMULATOR_HOST ||
      (process.env.FIREBASE_ADMIN_CLIENT_EMAIL &&
        process.env.FIREBASE_ADMIN_PRIVATE_KEY)),
  );
