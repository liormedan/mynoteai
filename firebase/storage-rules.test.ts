import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { FirebaseStorage } from "firebase/storage";
import { getBytes, ref, uploadBytes } from "firebase/storage";
import { afterAll, beforeAll, describe, it } from "vitest";
import { renderRules } from "../scripts/firebase-rules.mjs";

// Runs against the Storage emulator: `pnpm test:rules`.
const OWNER = "owner@example.com";
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

let env: RulesTestEnvironment;

const storageAs = (email: string | null, verified = true) =>
  (email
    ? env
        .authenticatedContext(`uid-${email}`, {
          email,
          email_verified: verified,
        })
        .storage()
    : env.unauthenticatedContext().storage()) as unknown as FirebaseStorage;

beforeAll(async () => {
  const template = readFileSync(
    join(__dirname, "storage.rules.template"),
    "utf8",
  );
  env = await initializeTestEnvironment({
    projectId: "demo-mynoteai-rules",
    storage: { rules: renderRules(template, OWNER) },
  });
});

afterAll(async () => {
  await env?.cleanup();
});

describe("storage", () => {
  it("lets the owner upload and read an image under a page", async () => {
    const s = storageAs(OWNER);
    const file = ref(s, "pages/p1/photo.png");
    await assertSucceeds(uploadBytes(file, PNG, { contentType: "image/png" }));
    await assertSucceeds(getBytes(file));
  });

  it("rejects other accounts, unverified owners and anonymous visitors", async () => {
    for (const s of [
      storageAs("someone@else.com"),
      storageAs(OWNER, false),
      storageAs(null),
    ]) {
      await assertFails(
        uploadBytes(ref(s, "pages/p1/x.png"), PNG, {
          contentType: "image/png",
        }),
      );
      await assertFails(getBytes(ref(s, "pages/p1/photo.png")));
    }
  });

  it("rejects files that are not images or PDFs, and paths outside pages/", async () => {
    const s = storageAs(OWNER);
    await assertFails(
      uploadBytes(ref(s, "pages/p1/script.html"), PNG, {
        contentType: "text/html",
      }),
    );
    await assertFails(
      uploadBytes(ref(s, "elsewhere/photo.png"), PNG, {
        contentType: "image/png",
      }),
    );
  });
});
