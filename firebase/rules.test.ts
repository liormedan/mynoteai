import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  setDoc,
  updateDoc,
  type Firestore,
} from "firebase/firestore";
import { afterAll, beforeAll, beforeEach, describe, it } from "vitest";
import { createPage } from "../src/lib/pages/model";
import { renderRules } from "../scripts/firebase-rules.mjs";

// Runs against the Firestore emulator: `pnpm test:rules`.
const OWNER = "Owner@Example.com"; // mixed case on purpose: the rules compare lower-cased
const PROJECT = "demo-mynoteai-rules";

let env: RulesTestEnvironment;

const asOwner = () =>
  env
    .authenticatedContext("owner-uid", {
      email: OWNER.toLowerCase(),
      email_verified: true,
    })
    .firestore() as unknown as Firestore;

const asStranger = () =>
  env
    .authenticatedContext("stranger-uid", {
      email: "someone@else.com",
      email_verified: true,
    })
    .firestore() as unknown as Firestore;

const asUnverifiedOwner = () =>
  env
    .authenticatedContext("fake-owner-uid", {
      email: OWNER.toLowerCase(),
      email_verified: false,
    })
    .firestore() as unknown as Firestore;

const asAnonymous = () =>
  env.unauthenticatedContext().firestore() as unknown as Firestore;

const validPage = () => ({
  title: "דף",
  icon: null,
  coverUrl: null,
  parentId: null,
  position: 1,
  type: "page",
  isArchived: false,
  isFavorite: false,
  createdAt: serverTimestamp(),
  updatedAt: serverTimestamp(),
});

beforeAll(async () => {
  const template = readFileSync(
    join(__dirname, "firestore.rules.template"),
    "utf8",
  );
  env = await initializeTestEnvironment({
    projectId: PROJECT,
    firestore: { rules: renderRules(template, OWNER) },
  });
});

beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore() as unknown as Firestore;
    await setDoc(doc(db, "pages/seed"), { ...validPage(), title: "seed" });
    await setDoc(doc(db, "pages/seed/content/main"), {
      blocks: "[]",
      plainText: "",
      updatedAt: serverTimestamp(),
    });
  });
});

afterAll(async () => {
  await env?.cleanup();
});

describe("owner", () => {
  it("creates a page with createPage() from the app model", async () => {
    await assertSucceeds(
      createPage(asOwner(), {
        title: "עמוד חדש",
        blocks: [{ type: "paragraph", content: "שלום" }],
      }),
    );
  });

  it("reads, updates and deletes pages and content", async () => {
    const db = asOwner();
    await assertSucceeds(getDoc(doc(db, "pages/seed")));
    await assertSucceeds(getDocs(doc(db, "pages/seed").parent));
    await assertSucceeds(getDoc(doc(db, "pages/seed/content/main")));
    await assertSucceeds(
      updateDoc(doc(db, "pages/seed"), {
        title: "renamed",
        updatedAt: serverTimestamp(),
      }),
    );
    await assertSucceeds(deleteDoc(doc(db, "pages/seed/content/main")));
    await assertSucceeds(deleteDoc(doc(db, "pages/seed")));
  });
});

describe("anyone who is not the owner", () => {
  const others = {
    "a different signed-in user": asStranger,
    "the owner's email without verification": asUnverifiedOwner,
    "an anonymous visitor": asAnonymous,
  };

  for (const [who, as] of Object.entries(others)) {
    it(`cannot read or write anything: ${who}`, async () => {
      const db = as();
      await assertFails(getDoc(doc(db, "pages/seed")));
      await assertFails(getDocs(doc(db, "pages/seed").parent));
      await assertFails(getDoc(doc(db, "pages/seed/content/main")));
      await assertFails(setDoc(doc(db, "pages/new"), validPage()));
      await assertFails(updateDoc(doc(db, "pages/seed"), { title: "hacked" }));
      await assertFails(deleteDoc(doc(db, "pages/seed")));
    });
  }
});

describe("data validation", () => {
  it("rejects unknown fields and wrong types", async () => {
    const db = asOwner();
    await assertFails(
      setDoc(doc(db, "pages/x"), { ...validPage(), extra: true }),
    );
    await assertFails(
      setDoc(doc(db, "pages/x"), { ...validPage(), title: 42 }),
    );
    await assertFails(
      setDoc(doc(db, "pages/x"), { ...validPage(), type: "folder" }),
    );
    const { title: _title, ...missingTitle } = validPage();
    void _title;
    await assertFails(setDoc(doc(db, "pages/x"), missingTitle));
  });

  it("accepts contentUpdatedAt only as a timestamp", async () => {
    const page = doc(asOwner(), "pages/seed");
    await assertSucceeds(
      updateDoc(page, { contentUpdatedAt: serverTimestamp() }),
    );
    await assertFails(updateDoc(page, { contentUpdatedAt: "yesterday" }));
  });

  it("keeps a database definition on database pages and values in props", async () => {
    const db = asOwner();
    const database = { properties: [], views: [] };
    await assertSucceeds(
      setDoc(doc(db, "pages/db1"), {
        ...validPage(),
        type: "database",
        database,
      }),
    );
    await assertFails(
      setDoc(doc(db, "pages/db2"), { ...validPage(), database }),
    );
    await assertSucceeds(
      setDoc(doc(db, "pages/row1"), {
        ...validPage(),
        parentId: "db1",
        props: { status: "todo", tags: ["home"], done: false },
      }),
    );
    await assertFails(
      setDoc(doc(db, "pages/row2"), { ...validPage(), props: "todo" }),
    );
  });

  it("does not let createdAt change after creation", async () => {
    await assertFails(
      updateDoc(doc(asOwner(), "pages/seed"), {
        createdAt: new Date(2000, 0, 1),
      }),
    );
  });

  it("only allows the 'main' content document with string blocks", async () => {
    const db = asOwner();
    const content = {
      blocks: "[]",
      plainText: "",
      updatedAt: serverTimestamp(),
    };
    await assertFails(setDoc(doc(db, "pages/seed/content/other"), content));
    await assertFails(
      setDoc(doc(db, "pages/seed/content/main"), { ...content, blocks: [] }),
    );
    await assertSucceeds(setDoc(doc(db, "pages/seed/content/main"), content));
  });
});

describe("templates", () => {
  const template = () => ({
    title: "סיכום פגישה",
    icon: "🗓️",
    blocks: "[]",
    createdAt: serverTimestamp(),
  });

  it("lets the owner save, list and delete templates", async () => {
    const db = asOwner();
    await assertSucceeds(setDoc(doc(db, "templates/t1"), template()));
    await assertSucceeds(getDocs(doc(db, "templates/t1").parent));
    await assertSucceeds(deleteDoc(doc(db, "templates/t1")));
  });

  it("rejects anyone else and malformed templates", async () => {
    await assertFails(setDoc(doc(asStranger(), "templates/t2"), template()));
    await assertFails(getDocs(doc(asAnonymous(), "templates/t2").parent));
    await assertFails(
      setDoc(doc(asOwner(), "templates/t3"), { ...template(), blocks: [] }),
    );
    await assertFails(
      setDoc(doc(asOwner(), "templates/t4"), { ...template(), extra: 1 }),
    );
  });
});
