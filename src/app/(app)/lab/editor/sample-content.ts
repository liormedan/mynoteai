import type { PartialBlock } from "@blocknote/core";

// Test document for the Hebrew / RTL gate of sprint 0 (S0-6, S0-7).
// Covers pure Hebrew, pure English, mixed lines, nesting, every list type and a table.
export const sampleContent: PartialBlock[] = [
  { type: "heading", props: { level: 1 }, content: "בדיקת עברית בעורך" },
  {
    type: "paragraph",
    content:
      "פסקה בעברית בלבד. הטקסט צריך להתחיל מימין, וסימני הפיסוק צריכים להופיע בסוף המשפט, משמאל.",
  },
  {
    type: "paragraph",
    content:
      "An English paragraph on the same page. It should start on the left, even when the interface is in Hebrew.",
  },
  {
    type: "paragraph",
    content: [
      { type: "text", text: "שורה מעורבת: מתקינים את ", styles: {} },
      { type: "text", text: "Next.js 16", styles: { code: true } },
      { type: "text", text: " עם ", styles: {} },
      { type: "text", text: "pnpm", styles: { bold: true } },
      { type: "text", text: " ובודקים שהכול עובד (גרסה 0.55).", styles: {} },
    ],
  },
  {
    type: "paragraph",
    content:
      "Mixed line: the editor is called BlockNote, ובעברית הוא נקרא עורך בלוקים.",
  },
  { type: "heading", props: { level: 2 }, content: "רשימות" },
  {
    type: "bulletListItem",
    content: "פריט ראשון ברשימה",
    children: [
      { type: "bulletListItem", content: "פריט מקונן ברמה שנייה" },
      { type: "bulletListItem", content: "Nested English item" },
    ],
  },
  { type: "bulletListItem", content: "פריט שני" },
  { type: "numberedListItem", content: "שלב ראשון" },
  { type: "numberedListItem", content: "שלב שני" },
  { type: "checkListItem", props: { checked: true }, content: "משימה שבוצעה" },
  { type: "checkListItem", content: "משימה פתוחה" },
  { type: "heading", props: { level: 2 }, content: "טבלה" },
  {
    type: "table",
    content: {
      type: "tableContent",
      rows: [
        { cells: ["שם", "תפקיד", "Status"] },
        { cells: ["BlockNote", "עורך", "בבדיקה"] },
        { cells: ["Firebase", "נתונים", "Planned"] },
      ],
    },
  },
  { type: "quote", content: "ציטוט בעברית — עם קו בצד הנכון." },
  { type: "paragraph" },
];
