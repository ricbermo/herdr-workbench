import { View, div, svg } from "gpui-kit";
import { h_flex, v_flex, TextView } from "gpui-base";
import { exec, theme, spaces, panes } from "herdr";
import { checkSnapshot, combineChecks, mergeabilityLabel, shouldNotifyPassing, summarizeChecks } from "./checks.js";

const LIMIT = "50";
const CACHE_KEY = "repository-results";
const CACHE_MS = 5 * 60 * 1000;
const CHECK_SNAPSHOT_KEY = "pr-check-snapshots";
const repoFromURL = (url) => /^(?:https?:\/\/github\.com\/|git@github\.com:|ssh:\/\/git@github\.com\/)([\w.-]+\/[\w.-]+?)(?:\.git)?\/?$/.exec(url.trim())?.[1];
const repoName = (item) => typeof item?.repository === "string" ? item.repository : item?.repository?.nameWithOwner;
const validItems = (items) => Array.isArray(items) ? items.filter((item) => Number.isInteger(item.number) && typeof item.title === "string" && typeof item.url === "string" && typeof repoName(item) === "string") : [];
const freshCache = (entry) => !Array.isArray(entry) && Number.isFinite(entry?.at) && Date.now() - entry.at < CACHE_MS;

function normalize(item, repository) {
  return { ...item, url: item.html_url, repository, author: item.user, createdAt: item.created_at, updatedAt: item.updated_at, state: item.state?.toUpperCase() };
}

function decodeApi(result, repository) {
  if (result.code !== 0) throw new Error((result.stderr || "GitHub API request failed").trim());
  const items = JSON.parse(result.stdout);
  if (!Array.isArray(items)) throw new Error("Unexpected GitHub API response");
  return validItems(items.map((item) => normalize(item, repository)));
}

function activePlace() {
  const space = spaces().find((item) => item.active);
  if (!space) return null;
  const tabs = new Set((space.tabs ?? []).map((tab) => tab.id));
  const folder = panes().find((pane) => tabs.has(pane.tab) && pane.cwd)?.cwd || space.folder;
  return folder ? { folder, machine: space.machine ?? null, key: JSON.stringify([space.machine ?? null, folder]) } : null;
}

function readCache() {
  try {
    const value = JSON.parse(localStorage.getItem(CACHE_KEY) ?? "{}");
    return value && typeof value === "object" && !Array.isArray(value) ? value : {};
  } catch {
    return {};
  }
}

function readCheckSnapshots() {
  try {
    const value = JSON.parse(localStorage.getItem(CHECK_SNAPSHOT_KEY) ?? "{}");
    return value && typeof value === "object" && !Array.isArray(value) ? value : {};
  } catch {
    return {};
  }
}

function notifyUser(title, message) {
  const quote = (value) => `"${String(value).replace(/[\r\n]+/g, " ").replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
  exec("osascript", ["-e", `display notification ${quote(message)} with title ${quote(title)}`]).catch((error) => console.log(String(error)));
}

async function loadChecks(repository, sha) {
  const [runsResult, statusesResult] = await Promise.all([
    exec("gh", ["api", `repos/${repository}/commits/${sha}/check-runs?per_page=100`]),
    exec("gh", ["api", `repos/${repository}/commits/${sha}/status`]),
  ]);
  if (runsResult.code !== 0) throw new Error((runsResult.stderr || "Could not load check runs").trim());
  if (statusesResult.code !== 0) throw new Error((statusesResult.stderr || "Could not load commit statuses").trim());
  const runs = JSON.parse(runsResult.stdout);
  const statuses = JSON.parse(statusesResult.stdout);
  if (!Array.isArray(runs.check_runs) || !Array.isArray(statuses.statuses)) throw new Error("Unexpected PR checks response");
  return combineChecks(runs.check_runs, statuses.statuses);
}

export default class GitHub extends View {
  init(_props, cx) {
    this.kind = "issues";
    this.items = { issues: [], prs: [] };
    this.errors = { issues: null, prs: null };
    this.busy = { issues: false, prs: false };
    this.repo = null;
    this.placeKey = undefined;
    this.projectError = null;
    this.projectLoading = false;
    this.cache = readCache();
    this.checkSnapshots = readCheckSnapshots();
    this.checkMonitoring = false;
    this.details = {};
    this.checks = {};
    this.selected = null;
    this.detail = null;
    this.fetchId = 0;
    this.detailId = 0;
    cx.timer.every(CACHE_MS, (cx) => this.refresh(cx));
  }

  resolveProject(place, cx) {
    const key = place?.key ?? null;
    if (key === this.placeKey) return;
    this.placeKey = key;
    const generation = ++this.fetchId;
    this.repo = null;
    this.projectError = null;
    this.items = { issues: [], prs: [] };
    this.errors = { issues: null, prs: null };
    this.busy = { issues: false, prs: false };
    this.selected = null;
    this.detail = null;
    this.details = {};
    this.checks = {};
    this.projectLoading = Boolean(place);
    if (!place) {
      this.projectError = "Open a space with a project to see its GitHub issues and PRs.";
      return;
    }
    cx.spawn(async (cx) => {
      try {
        const remotes = await exec("git", ["remote"], { cwd: place.folder, on: place.machine });
        if (remotes.code !== 0) throw new Error("Could not read this project's Git remotes.");
        const names = remotes.stdout.trim().split(/\r?\n/).filter(Boolean).sort((a, b) => (a === "origin" ? -1 : b === "origin" ? 1 : 0));
        let repository = null;
        for (const name of names) {
          const remote = await exec("git", ["remote", "get-url", name], { cwd: place.folder, on: place.machine });
          if (remote.code === 0 && (repository = repoFromURL(remote.stdout))) break;
        }
        if (!repository) throw new Error("This project's Git remotes do not point to github.com.");
        if (this.placeKey !== key || this.fetchId !== generation) return;
        this.repo = repository;
        this.projectLoading = false;
        const saved = this.cache[repository] ?? {};
        const issuesCache = saved.issues;
        const prsCache = saved.prs;
        this.items = {
          issues: validItems(Array.isArray(issuesCache) ? issuesCache : issuesCache?.items),
          prs: validItems(Array.isArray(prsCache) ? prsCache : prsCache?.items),
        };
        cx.notify();
        if (![issuesCache, prsCache].every(freshCache)) this.refresh(cx);
        else this.monitorCheckPasses(cx);
      } catch (error) {
        if (this.placeKey === key && this.fetchId === generation) {
          this.projectLoading = false;
          this.projectError = String(error?.message ?? error);
          cx.notify();
        }
      }
    });
  }

  saveCache(kind) {
    this.cache[this.repo] = { ...this.cache[this.repo], [kind]: { at: Date.now(), items: this.items[kind] } };
    try { localStorage.setItem(CACHE_KEY, JSON.stringify(this.cache)); } catch { /* Keep the in-memory results if storage is full. */ }
  }

  refresh(cx) {
    if (!this.repo || this.busy.issues || this.busy.prs) return;
    const repo = this.repo, request = ++this.fetchId;
    this.errors = { issues: null, prs: null };
    this.busy = { issues: true, prs: true };
    cx.notify();
    cx.spawn(async (cx) => {
      try {
        const result = await exec("gh", ["api", `repos/${repo}/issues?state=open&per_page=${LIMIT}`]);
        const openItems = decodeApi(result, repo);
        if (request !== this.fetchId) return;
        this.items.issues = openItems.filter((item) => !item.pull_request);
        this.items.prs = openItems.filter((item) => Boolean(item.pull_request));
        this.saveCache("issues");
        this.saveCache("prs");
      } catch (error) {
        if (request === this.fetchId) {
          const message = String(error?.message ?? error);
          this.errors.issues = this.errors.prs = message;
        }
      }
      if (request !== this.fetchId) return;
      this.busy.issues = this.busy.prs = false;
      cx.notify();
      this.monitorCheckPasses(cx);
    });
  }

  monitorCheckPasses(cx) {
    if (!this.repo || this.checkMonitoring || !this.items.prs.length) return;
    const repository = this.repo;
    const placeKey = this.placeKey;
    const pullRequests = [...this.items.prs];
    this.checkMonitoring = true;
    cx.spawn(async () => {
      let changed = false;
      try {
        for (const pr of pullRequests) {
          if (this.repo !== repository || this.placeKey !== placeKey) break;
          try {
            const result = await exec("gh", ["api", `repos/${repository}/pulls/${pr.number}`]);
            if (result.code !== 0) continue;
            const pull = JSON.parse(result.stdout);
            const sha = pull.head?.sha;
            if (!sha) continue;
            const runs = await loadChecks(repository, sha);
            if (this.repo !== repository || this.placeKey !== placeKey) break;
            const key = `${repository}#${pr.number}`;
            const next = checkSnapshot(runs, sha);
            if (shouldNotifyPassing(this.checkSnapshots[key], next, runs)) {
              notifyUser("Checks del PR aprobados", `${repository} #${pr.number}: ${pr.title}`);
            }
            this.checkSnapshots[key] = next;
            changed = true;
          } catch { /* Keep monitoring other PRs if one request fails. */ }
        }
        if (changed) {
          try { localStorage.setItem(CHECK_SNAPSHOT_KEY, JSON.stringify(this.checkSnapshots)); } catch { /* Keep the in-memory snapshots. */ }
        }
      } finally {
        this.checkMonitoring = false;
      }
    });
  }

  open(item, cx) {
    this.selected = item;
    const isPull = this.kind === "prs";
    this.detail = this.details[item.url] ?? null;
    if (isPull) this.checks[item.url] = { loading: true, runs: [], error: null };
    const request = ++this.detailId;
    cx.notify();
    cx.spawn(async (cx) => {
      let detail = this.details[item.url] ?? null;
      try {
        if (!detail) {
          const endpoint = isPull ? "pulls" : "issues";
          const result = await exec("gh", ["api", `repos/${this.repo}/${endpoint}/${item.number}`]);
          if (result.code !== 0) throw new Error((result.stderr || "Could not load details").trim());
          detail = normalize(JSON.parse(result.stdout), this.repo);
          if (request === this.detailId && this.selected?.url === item.url) this.detail = this.details[item.url] = detail;
          cx.notify();
        }
        if (isPull) {
          if (!detail.head?.sha) throw new Error("The PR's head commit is not available.");
          const runs = await loadChecks(this.repo, detail.head.sha);
          if (request === this.detailId && this.selected?.url === item.url) this.checks[item.url] = { loading: false, runs, error: null };
        }
      } catch (error) {
        if (request === this.detailId && this.selected?.url === item.url) {
          const message = String(error?.message ?? error);
          if (!detail) this.detail = { error: message };
          else if (isPull) this.checks[item.url] = { loading: false, runs: [], error: message };
        }
      }
      if (request === this.detailId && this.selected?.url === item.url) cx.notify();
    });
  }

  render(cx) {
    const t = theme();
    this.resolveProject(activePlace(), cx);
    const button = (id, label, active, click) => div().id(id).px(10).py(6).rounded(6).text_size(12).cursor_pointer()
      .text_color(active ? t.foreground : t.muted).when(active, (el) => el.bg(t.selected))
      .role("button").accessibility_label(label).on_click(click).child(label);
    const selected = this.selected;
    const header = h_flex().h(40).flex_none().px(10).gap(6).items_center().border_b(1).border_color(t.border)
      .child(div().flex_1().min_w(0).font_medium().text_color(t.foreground).child(this.repo ? `GitHub · ${this.repo}` : "GitHub"))
      .child(button("github-refresh", this.busy.issues || this.busy.prs ? "Refreshing…" : "Refresh", false, (_e, cx) => {
        if (this.repo) this.refresh(cx); else { this.placeKey = undefined; this.resolveProject(activePlace(), cx); }
      }));

    let content;
    if (selected) {
      const detail = this.detail;
      content = v_flex().flex_1().min_h(0).p(14).gap(10).overflow_y_scrollbar()
        .child(button("github-back", "← Back to list", false, (_e, cx) => { this.selected = null; this.detail = null; cx.notify(); }))
        .child(div().text_size(18).font_semibold().text_color(t.foreground).child(detail?.title ?? selected.title))
        .child(div().text_color(t.muted).child(`${this.repo ?? ""} #${selected.number} · ${detail?.state ?? selected.state ?? "OPEN"}`));
      if (detail?.error) content = content.child(div().text_color(t.blocked).child(detail.error));
      else if (detail) {
        const labels = (detail.labels ?? []).map((label) => typeof label === "string" ? label : label.name).filter(Boolean);
        content = content.child(div().text_size(12).text_color(t.muted).child(`Opened by ${detail.author?.login ?? selected.author?.login ?? "unknown"} · updated ${detail.updatedAt ? new Date(detail.updatedAt).toLocaleDateString() : "recently"}`));
        if (labels.length) content = content.child(h_flex().gap(5).children(labels.map((label, i) => div().id(`github-label-${i}`).px(7).py(3).rounded_full().bg(t.raised).text_size(11).text_color(t.accent).child(label))));
        if (this.kind === "prs") {
          const checks = this.checks[selected.url];
          const mergeStatus = mergeabilityLabel(detail);
          const summary = checks && summarizeChecks(checks.runs);
          const statusColor = summary?.failing ? t.blocked : summary?.pending ? t.working : t.ansi2;
          const checkPanel = v_flex().gap(6).py(8).border_b(1).border_color(t.border)
            .child(h_flex().items_center().justify_between()
              .child(div().font_medium().text_color(t.foreground).child("Mergeability"))
              .child(div().text_size(12).text_color(mergeStatus === "Ready to merge" ? t.ansi2 : t.working).child(mergeStatus)))
            .child(h_flex().items_center().justify_between()
              .child(div().font_medium().text_color(t.foreground).child("Checks"))
              .child(div().text_size(12).text_color(checks?.error ? t.blocked : statusColor)
                .child(checks?.error ? "Error loading checks" : checks?.loading ? "Loading…" : summary?.label ?? "Loading…")));
          if (checks?.error) checkPanel.child(div().text_size(11).text_color(t.blocked).child(checks.error));
          if (checks && !checks.loading && !checks.error) checkPanel.children(checks.runs.map((run, i) => {
            const state = run.status === "completed" ? run.conclusion ?? "completed" : run.status;
            const color = run.status !== "completed" ? t.working : ["success", "neutral", "skipped"].includes(run.conclusion) ? t.ansi2 : t.blocked;
            return h_flex().id(`github-check-${i}`).items_center().justify_between().gap(8).text_size(11)
              .child(div().flex_1().min_w(0).truncate().text_color(t.muted).child(run.name || "Unnamed check"))
              .child(div().flex_none().text_color(color).child(state));
          }));
          content = content.child(checkPanel);
        }
        content = content.child(div().id("github-detail-body").text_color(t.foreground)
          .child(TextView.markdown("github-detail-markdown", detail.body || "No description.")));
      } else content = content.child(div().text_color(t.dim).child("Loading details…"));
      content = content.child(button("github-open-url", "Open on GitHub ↗", false, () => {
        exec("open", [selected.url]).catch((error) => console.log(String(error)));
      }));
    } else {
      const tabs = h_flex().h(36).flex_none().px(8).gap(4).items_center()
        .child(button("github-issues", `Issues (${this.items.issues.length})`, this.kind === "issues", (_e, cx) => { this.kind = "issues"; this.selected = null; cx.notify(); }))
        .child(button("github-prs", `PRs (${this.items.prs.length})`, this.kind === "prs", (_e, cx) => { this.kind = "prs"; this.selected = null; cx.notify(); }));
      const items = this.items[this.kind];
      const rows = v_flex().flex_1().min_h(0).overflow_y_scrollbar().children(items.map((item) => {
        const metadata = `${this.repo} #${item.number} · ${item.author?.login ?? ""}`;
        return h_flex().id(`github-item-${this.kind}-${item.number}`).px(12).py(10).gap(8).border_b(1).border_color(t.border).cursor_pointer()
          .role("button").accessibility_label(`${item.title}, ${metadata}`)
          .hover((s) => s.bg(t.hover)).on_click((_e, cx) => this.open(item, cx))
          .child(div().w(18).flex_none().text_color(this.kind === "prs" ? t.ansi2 : t.ansi5).child(this.kind === "prs" ? "⑂" : "●"))
          .child(v_flex().flex_1().min_w(0).gap(3)
            .child(div().text_color(t.foreground).child(item.title))
            .child(div().text_size(11).text_color(t.muted).child(metadata)));
      }));
      content = v_flex().flex_1().min_h(0).child(tabs);
      if (this.projectLoading) content = content.child(h_flex().px(12).py(8).gap(7).items_center().text_color(t.dim)
        .child(svg("mods/workspace-chrome/spinner.svg").size(12).spin(900)).child("Finding this project's GitHub repository…"));
      else if (this.projectError) content = content.child(div().px(12).py(8).text_color(t.dim).child(this.projectError));
      else if (this.errors[this.kind]) content = content.child(div().px(12).py(8).text_color(t.blocked).child(this.errors[this.kind]));
      else if (this.busy[this.kind]) content = content.child(h_flex().px(12).py(8).gap(7).items_center().text_color(t.dim)
        .child(svg("mods/workspace-chrome/spinner.svg").size(12).spin(900))
        .child(`${items.length ? "Updating" : "Loading"} ${this.kind === "prs" ? "pull requests" : "issues"} for ${this.repo ?? "project"}…`));
      else if (!items.length && this.repo) content = content.child(div().px(12).py(8).text_color(t.dim).child(`No open ${this.kind === "prs" ? "pull requests" : "issues"} in ${this.repo}.`));
      content = content.child(rows);
    }
    return v_flex().id("my-github").size_full().min_h(0).bg(t.chrome).text_size(13).child(header).child(content);
  }
}
