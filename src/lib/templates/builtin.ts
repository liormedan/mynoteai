import type { Locale } from "@/i18n/config";

/*
 * Built-in page templates, written for each UI language rather than
 * translated word by word. Blocks use the plain BlockNote JSON shape.
 */

type Block = Record<string, unknown>;

const h = (level: 1 | 2 | 3, text: string): Block => ({
  type: "heading",
  props: { level },
  content: text,
});
const p = (text = ""): Block => ({ type: "paragraph", content: text });
const todo = (text: string): Block => ({
  type: "checkListItem",
  content: text,
});
const bullet = (text: string): Block => ({
  type: "bulletListItem",
  content: text,
});
const numbered = (text: string): Block => ({
  type: "numberedListItem",
  content: text,
});
const table = (rows: string[][]): Block => ({
  type: "table",
  content: { type: "tableContent", rows: rows.map((cells) => ({ cells })) },
});

export type BuiltinTemplate = {
  id: string;
  icon: string;
  title: string;
  blocks: Block[];
};

const today = (locale: Locale) =>
  new Intl.DateTimeFormat(locale === "he" ? "he-IL" : "en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date());

export function builtinTemplates(locale: Locale): BuiltinTemplate[] {
  if (locale === "he") {
    return [
      {
        id: "journal",
        icon: "📔",
        title: `יומן — ${today(locale)}`,
        blocks: [
          h(2, "מה קרה היום"),
          p(),
          h(2, "על מה אני מודה"),
          bullet(""),
          h(2, "מחר"),
          todo(""),
        ],
      },
      {
        id: "meeting",
        icon: "🗓️",
        title: "סיכום פגישה",
        blocks: [
          table([
            ["תאריך", today(locale)],
            ["משתתפים", ""],
            ["נושא", ""],
          ]),
          h(2, "סדר יום"),
          numbered(""),
          h(2, "החלטות"),
          bullet(""),
          h(2, "משימות להמשך"),
          todo("מי — מה — עד מתי"),
        ],
      },
      {
        id: "todo",
        icon: "✅",
        title: "רשימת משימות",
        blocks: [h(2, "דחוף"), todo(""), h(2, "השבוע"), todo(""), h(2, "פעם")],
      },
      {
        id: "project",
        icon: "🚀",
        title: "דף פרויקט",
        blocks: [
          h(2, "מטרה"),
          p("משפט אחד: מה הפרויקט משיג ולמי."),
          h(2, "סטטוס"),
          table([
            ["שלב", "סטטוס", "יעד"],
            ["", "", ""],
          ]),
          h(2, "משימות"),
          todo(""),
          h(2, "קישורים"),
          bullet(""),
        ],
      },
    ];
  }
  return [
    {
      id: "journal",
      icon: "📔",
      title: `Journal — ${today(locale)}`,
      blocks: [
        h(2, "What happened today"),
        p(),
        h(2, "Grateful for"),
        bullet(""),
        h(2, "Tomorrow"),
        todo(""),
      ],
    },
    {
      id: "meeting",
      icon: "🗓️",
      title: "Meeting notes",
      blocks: [
        table([
          ["Date", today(locale)],
          ["Attendees", ""],
          ["Topic", ""],
        ]),
        h(2, "Agenda"),
        numbered(""),
        h(2, "Decisions"),
        bullet(""),
        h(2, "Action items"),
        todo("Who — what — by when"),
      ],
    },
    {
      id: "todo",
      icon: "✅",
      title: "To-do list",
      blocks: [
        h(2, "Urgent"),
        todo(""),
        h(2, "This week"),
        todo(""),
        h(2, "Someday"),
      ],
    },
    {
      id: "project",
      icon: "🚀",
      title: "Project page",
      blocks: [
        h(2, "Goal"),
        p("One sentence: what the project achieves, and for whom."),
        h(2, "Status"),
        table([
          ["Phase", "Status", "Due"],
          ["", "", ""],
        ]),
        h(2, "Tasks"),
        todo(""),
        h(2, "Links"),
        bullet(""),
      ],
    },
  ];
}
