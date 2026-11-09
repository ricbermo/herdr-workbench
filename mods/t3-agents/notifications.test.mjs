import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

const source = (await readFile(new URL("./main.js", import.meta.url), "utf8"))
  .replace(/^import .*;\r?\n/gm, "")
  .replace("export default class Agents extends View", "globalThis.Agents = class Agents extends View");
const calls = [];
const context = {
  View: class {},
  spaces: () => [],
  exec: async (command, args) => { calls.push([command, args]); return { code: 0, stderr: "" }; },
  localStorage: { setItem() {} },
  console: { log() {} },
};
vm.runInNewContext(source, context);

const agent = { address: "agent-1", status: "blocked", name: 'Agent needs "help"' };
const state = { changed: {} };
const track = context.Agents.prototype.track;
track.call(state, [agent], 1);
track.call(state, [agent], 2);
assert.equal(calls.length, 1, "an agent staying blocked does not repeat its alert");
assert.equal(calls[0][0], "osascript");
assert.equal(calls[0][1][1], 'display notification "Agent needs \\"help\\" necesita tu atención." with title "Herdr"');

agent.status = "working";
track.call(state, [agent], 3);
agent.status = "blocked";
track.call(state, [agent], 4);
assert.equal(calls.length, 2, "a new blocked transition alerts again");

agent.status = "working";
track.call(state, [agent], 5);
agent.status = "done";
track.call(state, [agent], 6);
assert.equal(calls.length, 3, "finishing after work alerts once");
assert.equal(calls[2][1][1], 'display notification "Agent needs \\"help\\" terminó su tarea." with title "Herdr"');
track.call(state, [agent], 7);
assert.equal(calls.length, 3, "a done agent does not repeat its alert");
track.call(state, [{ address: "agent-2", status: "done", name: "Already finished" }], 8);
assert.equal(calls.length, 3, "an agent first seen already done does not trigger a stale alert");
