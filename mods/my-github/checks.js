const passingConclusions = new Set(["success", "neutral", "skipped"]);

export function summarizeChecks(runs) {
  const pending = runs.filter((run) => run.status !== "completed").length;
  const failing = runs.filter((run) => run.status === "completed" && !passingConclusions.has(run.conclusion)).length;
  const states = [pending && `${pending} pending`, failing && `${failing} failing`].filter(Boolean);
  return { pending, failing, label: !runs.length ? "No checks reported" : states.join(" · ") || "All passing" };
}

export function combineChecks(checkRuns, statuses) {
  return [
    ...checkRuns,
    ...statuses.map((status) => ({
      name: status.context,
      status: status.state === "pending" ? "in_progress" : "completed",
      conclusion: status.state === "success" ? "success" : status.state === "pending" ? null : status.state,
      html_url: status.target_url,
    })),
  ];
}

export function checkSnapshot(runs, sha) {
  const summary = summarizeChecks(runs);
  return { sha, state: !runs.length ? "none" : summary.failing ? "failing" : summary.pending ? "pending" : "passing" };
}

export function shouldNotifyPassing(previous, next, runs) {
  return Boolean(previous && runs.length && next.state === "passing" && (previous.state !== "passing" || previous.sha !== next.sha));
}

export function mergeabilityLabel(pull) {
  if (pull.mergeable == null) return "Checking mergeability…";
  if (!pull.mergeable) return "Conflicts detected";
  return ({
    clean: "Ready to merge",
    blocked: "Blocked by repository rules",
    behind: "Branch is behind the base branch",
    unstable: "Mergeable, but checks are failing",
    dirty: "Conflicts detected",
    unknown: "Merge status unknown",
  })[pull.mergeable_state] ?? "Mergeable";
}
