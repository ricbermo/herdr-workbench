import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

const source = (await readFile(new URL("./main.js", import.meta.url), "utf8"))
  .replace(/^import .*;\r?\n/gm, "")
  .replace("export function launchArgs", "globalThis.launchArgs = function launchArgs")
  .replace("export default class Tools extends View", "globalThis.Tools = class Tools extends View");
const context = { View: class {} };
vm.runInNewContext(source, context);
assert.deepEqual(Array.from(context.launchArgs(["nvim"], "/work/tree", null)), [
  "run", "--bg", "--json", "--no-parent", "--cwd", "/work/tree", "--", "nvim",
]);
assert.deepEqual(Array.from(context.launchArgs(["lazygit"], "/work/tree", "build-server")), [
  "run", "--bg", "--json", "--no-parent", "--cwd", "/work/tree", "--on", "build-server", "--", "lazygit",
]);
console.log("my-tools launch args passed");
