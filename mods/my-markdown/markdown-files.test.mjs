import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

const source = (await readFile(new URL("./main.js", import.meta.url), "utf8"))
  .replace(/^import .*;\r?\n/gm, "")
  .replace("export function markdownFiles", "globalThis.markdownFiles = function markdownFiles")
  .replace("export function todayMarkdownFiles", "globalThis.todayMarkdownFiles = function todayMarkdownFiles")
  .replace("export const TODAY_MARKDOWN_SEARCH", "globalThis.TODAY_MARKDOWN_SEARCH")
  .replace("export default class Markdown extends View", "globalThis.Markdown = class Markdown extends View");
const context = { View: class {} };
vm.runInNewContext(source, context);

const files = context.markdownFiles(" M tasks/plan.md\0 M README.MD\0 M file.txt\0 M tasks/plan.md\0", "/repo");
assert.deepEqual(Array.from(files), ["/repo/README.MD", "/repo/tasks/plan.md"], "only unique Markdown paths inside the selected project are shown");
assert.deepEqual(Array.from(context.markdownFiles(" M README.md\0", "/")), ["/README.md"], "root folders remain searchable");
assert.deepEqual(Array.from(context.todayMarkdownFiles("/repo/a.md\0/repo/note.MD\0/repo-other/leak.md\0/repo/other.txt\0", "/repo")), ["/repo/a.md", "/repo/note.MD"], "today's Markdown search stays inside the selected project");
