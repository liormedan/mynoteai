"use client";

import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { getFirebase } from "@/lib/firebase/client";

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024; // matches storage.rules

/**
 * Uploads a file under pages/{pageId}/ and returns its download URL.
 * Only available when Cloud Storage is enabled for the install.
 */
export async function uploadPageFile(pageId: string, file: File) {
  const { storage } = getFirebase();
  if (!storage) throw new Error("Cloud Storage is not enabled");
  if (file.size > MAX_UPLOAD_BYTES)
    throw new Error("File is larger than 10 MB");
  const safeName = file.name.replace(/[^\p{L}\p{N}._-]+/gu, "_").slice(-80);
  const fileRef = ref(storage, `pages/${pageId}/${Date.now()}-${safeName}`);
  await uploadBytes(fileRef, file, { contentType: file.type });
  return getDownloadURL(fileRef);
}
