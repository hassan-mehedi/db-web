import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { EditorView } from "@codemirror/view";
import { tags as t } from "@lezer/highlight";

const theme = EditorView.theme(
  {
    "&": { backgroundColor: "var(--background)", color: "var(--foreground)", height: "100%" },
    ".cm-scroller": { fontFamily: "var(--font-mono)", fontSize: "13px", lineHeight: "1.6" },
    ".cm-content": { caretColor: "var(--primary)", padding: "8px 0" },
    ".cm-cursor, .cm-dropCursor": { borderLeftColor: "var(--primary)" },
    "&.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground, .cm-selectionBackground, ::selection":
      { backgroundColor: "color-mix(in oklch, var(--primary) 25%, transparent)" },
    ".cm-activeLine": { backgroundColor: "color-mix(in oklch, var(--foreground) 4%, transparent)" },
    ".cm-gutters": {
      backgroundColor: "var(--background)",
      color: "var(--muted-foreground)",
      border: "none",
    },
    ".cm-activeLineGutter": { backgroundColor: "transparent", color: "var(--foreground)" },
    ".cm-lineNumbers .cm-gutterElement": { padding: "0 12px 0 16px", minWidth: "3ch" },
    ".cm-tooltip": {
      backgroundColor: "var(--popover)",
      color: "var(--popover-foreground)",
      border: "1px solid var(--border)",
      borderRadius: "var(--radius-md)",
      fontFamily: "var(--font-mono)",
      fontSize: "12px",
    },
    ".cm-tooltip.cm-tooltip-autocomplete > ul > li[aria-selected]": {
      backgroundColor: "var(--accent)",
      color: "var(--accent-foreground)",
    },
    ".cm-matchingBracket": { outline: "1px solid var(--primary)", backgroundColor: "transparent" },
    "&.cm-focused": { outline: "none" },
  },
  { dark: true },
);

const highlight = HighlightStyle.define([
  { tag: t.keyword, color: "#c678dd" },
  { tag: [t.typeName, t.standard(t.name)], color: "#4cc2ff" },
  { tag: [t.function(t.variableName), t.function(t.propertyName)], color: "#61afef" },
  { tag: [t.string, t.special(t.string)], color: "#98c379" },
  { tag: t.number, color: "#d19a66" },
  { tag: [t.bool, t.null], color: "#d19a66" },
  { tag: t.operator, color: "#56b6c2" },
  {
    tag: [t.comment, t.lineComment, t.blockComment],
    color: "var(--muted-foreground)",
    fontStyle: "italic",
  },
  { tag: [t.variableName, t.propertyName], color: "var(--foreground)" },
  { tag: t.punctuation, color: "var(--muted-foreground)" },
]);

export const editorTheme = [theme, syntaxHighlighting(highlight)];
