import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtemp, readFile, rm, utimes, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import vm from "node:vm";

const source = (await readFile(new URL("./main.js", import.meta.url), "utf8"))
  .replace(/^import .*;\r?\n/gm, "")
  .replace("export function markdownFiles", "globalThis.markdownFiles = function markdownFiles")
  .replace("export function todayMarkdownFiles", "globalThis.todayMarkdownFiles = function todayMarkdownFiles")
  .replace("export const TODAY_MARKDOWN_SEARCH =", "globalThis.TODAY_MARKDOWN_SEARCH =")
  .replace("export default class Markdown extends View", "globalThis.Markdown = class Markdown extends View");
const context = { View: class {} };
vm.runInNewContext(source, context);

const status = " M tasks/plan.md\0A  README.MD\0?? draft notes.md\0 D deleted.md\0R  renamed.md\0old.md\0 M notes.txt\0";
assert.deepEqual(
  Array.from(context.markdownFiles(status, "/repo")).sort(),
  ["/repo/README.MD", "/repo/draft notes.md", "/repo/renamed.md", "/repo/tasks/plan.md"].sort(),
  "only new or modified Markdown files are shown; deleted files and renamed-away paths are excluded"
);
assert.deepEqual(Array.from(context.markdownFiles("?? README.md\0", "/")), ["/README.md"], "root folders remain searchable");
assert.deepEqual(
  Array.from(context.todayMarkdownFiles("/repo/README.md\0/repo/sub/plan.MD\0/repo-other/leak.md\0/repo/notes.txt\0", "/repo")).sort(),
  ["/repo/README.md", "/repo/sub/plan.MD"].sort(),
  "the non-Git fallback accepts only Markdown paths inside the project"
);

const folder = await mkdtemp(join(tmpdir(), "my-markdown-"));
try {
  const today = join(folder, "today.md");
  const yesterday = join(folder, "yesterday.md");
  await Promise.all([writeFile(today, "today"), writeFile(yesterday, "yesterday")]);
  const midnight = new Date();
  midnight.setHours(0, 0, 0, 0);
  const cutoff = midnight.getTime() / 1000;
  await Promise.all([utimes(today, cutoff + 1, cutoff + 1), utimes(yesterday, cutoff - 1, cutoff - 1)]);
  const output = execFileSync("sh", ["-c", context.TODAY_MARKDOWN_SEARCH, "herdr-markdown", folder]);
  assert.deepEqual(Array.from(context.todayMarkdownFiles(output.toString(), folder)), [today], "outside Git, only files newer than today's local midnight are listed");
} finally {
  await rm(folder, { recursive: true, force: true });
}
