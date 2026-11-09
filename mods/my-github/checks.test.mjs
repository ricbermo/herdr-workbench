import assert from "node:assert/strict";
import { checkSnapshot, combineChecks, mergeabilityLabel, shouldNotifyPassing, summarizeChecks } from "./checks.js";

assert.equal(summarizeChecks([]).label, "No checks reported");
assert.equal(summarizeChecks([{ status: "completed", conclusion: "success" }]).label, "All passing");
assert.equal(summarizeChecks([{ status: "completed", conclusion: "failure" }, { status: "queued" }]).label, "1 pending · 1 failing");
assert.equal(summarizeChecks([{ status: "completed", conclusion: "failure" }]).label, "1 failing");
assert.equal(mergeabilityLabel({ mergeable: true, mergeable_state: "clean" }), "Ready to merge");
assert.equal(mergeabilityLabel({ mergeable: true, mergeable_state: "blocked" }), "Blocked by repository rules");
assert.equal(mergeabilityLabel({ mergeable: false }), "Conflicts detected");
const passing = [{ status: "completed", conclusion: "success" }];
const pending = [{ status: "queued" }];
assert.equal(shouldNotifyPassing(null, checkSnapshot(passing, "a"), passing), false);
assert.equal(shouldNotifyPassing(checkSnapshot(pending, "a"), checkSnapshot(passing, "a"), passing), true);
assert.equal(shouldNotifyPassing(checkSnapshot(passing, "a"), checkSnapshot(passing, "a"), passing), false);
assert.equal(shouldNotifyPassing(checkSnapshot(passing, "a"), checkSnapshot(passing, "b"), passing), true);
assert.deepEqual(combineChecks([], [{ context: "Legacy CI", state: "success" }]), [
  { name: "Legacy CI", status: "completed", conclusion: "success", html_url: undefined },
]);
