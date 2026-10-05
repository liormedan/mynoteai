"use client";

import { getApp, getApps, initializeApp } from "firebase/app";
import { connectAuthEmulator, getAuth } from "firebase/auth";
import { connectFirestoreEmulator, getFirestore } from "firebase/firestore";

export const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY!,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN!,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID!,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

export const usingEmulators =
  process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATORS === "true";

function init() {
  if (getApps().length) {
    const app = getApp();
    return { app, auth: getAuth(app), db: getFirestore(app) };
  }
  const app = initializeApp(firebaseConfig);
  const auth = getAuth(app);
  const db = getFirestore(app);
  if (usingEmulators) {
    connectAuthEmulator(auth, "http://127.0.0.1:9099", {
      disableWarnings: true,
    });
    connectFirestoreEmulator(db, "127.0.0.1", 8080);
  }
  return { app, auth, db };
}

let instance: ReturnType<typeof init> | undefined;

/** The browser's Firebase app, connected to the emulators in development. */
export function getFirebase() {
  instance ??= init();
  return instance;
}
