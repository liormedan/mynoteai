/*
 * Global keyboard shortcuts. Keys are matched by `event.code` (the physical
 * key), not `event.key`, so they work the same on a Hebrew keyboard layout,
 * where Ctrl+K arrives as key "ל".
 */

export type Shortcut = {
  code: string;
  /** Ctrl on Windows and Linux, ⌘ on macOS. */
  mod?: boolean;
  shift?: boolean;
  alt?: boolean;
};

export const SHORTCUTS = {
  palette: { code: "KeyK", mod: true },
  newPage: { code: "KeyN", mod: true, alt: true },
  focusSidebar: { code: "Backslash", mod: true },
  toggleTheme: { code: "KeyL", mod: true, shift: true },
} satisfies Record<string, Shortcut>;

export type ShortcutName = keyof typeof SHORTCUTS;

export const isMac = () =>
  typeof navigator !== "undefined" &&
  /mac|iphone|ipad/i.test(navigator.platform || navigator.userAgent);

export function matches(event: KeyboardEvent, s: Shortcut, mac = isMac()) {
  const mod = mac ? event.metaKey : event.ctrlKey;
  return (
    event.code === s.code &&
    mod === !!s.mod &&
    event.shiftKey === !!s.shift &&
    event.altKey === !!s.alt &&
    (mac ? !event.ctrlKey : !event.metaKey) &&
    // On Windows AltGr arrives as Ctrl+Alt; typing a character is not a shortcut.
    !event.getModifierState?.("AltGraph")
  );
}

const KEY_LABELS: Record<string, string> = {
  Backslash: "\\",
};

export function shortcutLabel(s: Shortcut, mac: boolean) {
  const key = KEY_LABELS[s.code] ?? s.code.replace(/^(Key|Digit)/, "");
  const parts = [
    s.mod && (mac ? "⌘" : "Ctrl"),
    s.alt && (mac ? "⌥" : "Alt"),
    s.shift && (mac ? "⇧" : "Shift"),
    key,
  ].filter(Boolean);
  return parts.join(mac ? "" : "+");
}
