import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

const source = (await readFile(new URL("./main.js", import.meta.url), "utf8"))
  .replace(/^import .*;\r?\n/gm, "")
  .replace("const hasInbox = () =>", "globalThis.hasInbox = () =>")
  .replace("export default class WorkspaceChrome extends View", "globalThis.WorkspaceChrome = class WorkspaceChrome extends View");
let tree = { id: "sidebar-lists", type: "column", children: [{ id: "lists" }] };
const context = { View: class {}, layout: () => tree };
vm.runInNewContext(source, context);

assert.equal(context.hasInbox(), false, "hide the inbox toggle when this layout has no Inbox child");
tree = { id: "sidebar-lists", type: "stack", children: [{ id: "lists" }, { id: "inbox" }] };
assert.equal(context.hasInbox(), true, "keep the toggle for layouts that include an Inbox child");
