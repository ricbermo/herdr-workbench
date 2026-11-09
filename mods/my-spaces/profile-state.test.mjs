import assert from "node:assert/strict";
import { addProfile, assignUnassignedSpaces, deleteProfile, normalizeProfileState, renameProfile } from "./profile-state.js";

const defaults = normalizeProfileState();
assert.deepEqual(normalizeProfileState(null), defaults);
assert.deepEqual(defaults.profiles, ["Work", "Personal"]);
assert.equal(defaults.active, "Work");

const saved = { profiles: ["Research", "Work"], active: "Research", assignments: { old: "Work" } };
const before = normalizeProfileState(saved);
const state = assignUnassignedSpaces(before, [{ id: "new" }, { id: "old" }]);
assert.deepEqual(before.assignments, { old: "Work" });
assert.notEqual(state.assignments, before.assignments);
assert.equal(state.assignments.new, "Research");
assert.equal(state.assignments.old, "Work");
assert.deepEqual(state.profiles, ["Research", "Work"]);

assert.equal(addProfile(state, " research "), null);
const added = addProfile(state, "Studio");
assert.equal(added.active, "Studio");
const renamed = renameProfile({ profiles: ["Work", "Personal"], active: "Work", assignments: { a: "Work" } }, "Work", "Studio");
assert.deepEqual(renamed, { profiles: ["Studio", "Personal"], active: "Studio", assignments: { a: "Studio" } });
assert.equal(renameProfile(renamed, "Studio", "personal"), null);
const deleted = deleteProfile(renamed, "Studio");
assert.deepEqual(deleted, { profiles: ["Personal"], active: "Personal", assignments: { a: "Personal" } });
assert.equal(deleteProfile(deleted, "Personal"), null);

const invalid = assignUnassignedSpaces({ active: "missing", assignments: null }, [{ id: "space" }]);
assert.equal(invalid.active, "Work");
assert.equal(invalid.assignments.space, "Work");
