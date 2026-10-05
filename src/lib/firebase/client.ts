"use client";

import { getApp, getApps, initializeApp } from "firebase/app";
import { connectAuthEmulator, getAuth } from "firebase/auth";
import {
  connectFirestoreEmulator,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
} from "firebase/firestore";
import { connectStorageEmulator, getStorage } from "firebase/storage";

export const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY!,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN!,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID!,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

export const usingEmulators =
  process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATORS === "true";

/** Cloud Storage needs the Blaze plan, so uploads are opt-in. */
export const storageEnabled =
  process.env.NEXT_PUBLIC_FIREBASE_STORAGE_ENABLED === "true";

function init() {
  const fresh = !getApps().length;
  const app = fresh ? initializeApp(firebaseConfig) : getApp();
  const auth = getAuth(app);
  // Writes land in IndexedDB first and sync in the background, so a refresh
  // or a lost connection does not lose what was just typed.
  const db = initializeFirestore(app, {
    localCache: persistentLocalCache({
      tabManager: persistentMultipleTabManager(),
    }),
  });
  const storage = storageEnabled ? getStorage(app) : null;
  if (fresh && usingEmulators) {
    connectAuthEmulator(auth, "http://127.0.0.1:9099", {
      disableWarnings: true,
    });
    connectFirestoreEmulator(db, "127.0.0.1", 8080);
    if (storage) connectStorageEmulator(storage, "127.0.0.1", 9199);
  }
  return { app, auth, db, storage };
}

let instance: ReturnType<typeof init> | undefined;

/** The browser's Firebase app, connected to the emulators in development. */
export function getFirebase() {
  instance ??= init();
  return instance;
}
