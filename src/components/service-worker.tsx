"use client";

import { useEffect } from "react";

/**
 * Registers public/sw.js in production builds. In development it would serve
 * stale chunks between edits, so it is on only with
 * NEXT_PUBLIC_SERVICE_WORKER=true (for testing offline start).
 */
export function ServiceWorker() {
  useEffect(() => {
    const enabled =
      process.env.NODE_ENV === "production" ||
      process.env.NEXT_PUBLIC_SERVICE_WORKER === "true";
    if (!enabled || !("serviceWorker" in navigator)) return;
    void navigator.serviceWorker.register("/sw.js", {
      scope: "/",
      updateViaCache: "none",
    });
  }, []);
  return null;
}

/** Drops the cached app pages, so nothing of the notebook stays after sign-out. */
export async function clearServiceWorkerCache() {
  if (!("caches" in window)) return;
  const keys = await caches.keys();
  await Promise.all(
    keys.filter((k) => k.startsWith("mynoteai-")).map((k) => caches.delete(k)),
  );
}
