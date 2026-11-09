import { View, div, svg } from "gpui-kit";
import { h_flex, v_flex, TextView } from "gpui-base";
import { closeOverlay, exec, openOverlay, panes, props, readTextFile, spaces, theme } from "herdr";

function activePlace() {
  const space = spaces().find((item) => item.active);
  if (!space) return null;
  const tabs = new Set((space.tabs ?? []).map((tab) => tab.id));
  const folder = panes().find((pane) => tabs.has(pane.tab) && pane.cwd)?.cwd || space.folder;
  return folder ? { folder, machine: space.machine ?? null } : null;
}

export function markdownFiles(stdout, folder) {
  const root = folder.replace(/\/+$/, "");
  const files = [];
  const records = stdout.split("\0");
  for (let i = 0; i < records.length; i++) {
    const entry = records[i];
    if (!entry) continue;
    const status = entry.slice(0, 2);
    const path = entry.slice(3);
    if (status.includes("R") || status.includes("C")) i++;
    if (!status.includes("D") && /\.md$/i.test(path)) files.push(`${root}/${path}`);
  }
  return [...new Set(files)].sort((a, b) => a.localeCompare(b));
}

export function todayMarkdownFiles(stdout, folder) {
  const root = `${folder.replace(/\/+$/, "")}/`;
  return [...new Set(stdout.split("\0").filter((path) => path.startsWith(root) && /\.md$/i.test(path)))].sort((a, b) => a.localeCompare(b));
}

export const TODAY_MARKDOWN_SEARCH = 'set -eu; marker=$(mktemp "${TMPDIR:-/tmp}/herdr-markdown.XXXXXX"); trap \'rm -f "$marker"\' 0; touch -t "$(date +%Y%m%d)0000" "$marker"; find "$1" -type f -iname "*.md" -newer "$marker" -not -path "*/.git/*" -not -path "*/node_modules/*" -print0';

export default class Markdown extends View {
  init(_props, cx) {
    this.files = [];
    this.selected = null;
    this.content = null;
    this.loading = false;
    this.error = null;
    if (props()?.viewer) {
      this.focus = cx.focus_handle();
      this.focus.focus();
      this.loading = true;
      cx.spawn(async (cx) => {
        const { folder, machine } = props();
        try {
          if (!folder) throw new Error("Focus a project terminal in a Git repository first.");
          const result = await exec("git", ["-C", folder, "status", "--porcelain=v1", "-z", "--untracked-files=all", "--", "."], { on: machine });
          if (result.code === 0) this.files = markdownFiles(result.stdout, folder);
          else if (result.stderr?.includes("not a git repository")) {
            const fallback = await exec("sh", ["-c", TODAY_MARKDOWN_SEARCH, "herdr-markdown", folder], { on: machine });
            if (fallback.code !== 0) throw new Error((fallback.stderr || "Could not find Markdown files changed today.").trim());
            this.files = todayMarkdownFiles(fallback.stdout, folder);
          } else throw new Error((result.stderr || "Could not check project changes.").trim());
        } catch (error) {
          this.error = String(error?.message ?? error);
        }
        this.loading = false;
        cx.notify();
      });
    }
  }

  async openFile(path, cx) {
    this.selected = path;
    this.content = null;
    this.error = null;
    this.loading = true;
    cx.notify();
    try {
      this.content = await readTextFile(path, { on: props()?.machine });
      if (this.content === null) throw new Error("File not found or unavailable on that machine.");
    } catch (error) {
      this.error = String(error?.message ?? error);
    }
    this.loading = false;
    cx.notify();
  }

  render() {
    const t = theme(), p = props() ?? {};
    if (!p.viewer) return h_flex().id("markdown-toggle").w_full().h_full().px(8).items_center().justify_center()
      .child(h_flex().h(24).px(7).gap(5).items_center().rounded(8).border(1).border_color(t.border)
        .text_size(12).cursor_pointer().text_color(t.dim).hover((el) => el.bg(t.hover).text_color(t.foreground))
        .role("button").accessibility_label("Browse Markdown files")
        .on_click(() => {
          const place = activePlace();
          openOverlay({ mod: "my-markdown", kind: "dialog", frame: "none", width: 950, height: 800, props: { viewer: true, folder: place?.folder ?? null, machine: place?.machine ?? null } });
        })
        .child(svg("mods/my-markdown/icons/file-text.svg").size(14)).child("Markdown"));

    const close = () => closeOverlay(p.overlay);
    const button = (id, label, action) => div().id(id).px(9).py(5).rounded(6).text_size(12).cursor_pointer()
      .text_color(t.foreground).hover((el) => el.bg(t.hover)).role("button").accessibility_label(label).on_click(action).child(label);
    const header = h_flex().h(44).flex_none().px(14).gap(8).items_center().border_b(1).border_color(t.border);
    if (this.selected) header.child(button("markdown-back", "Files", (_e, cx) => { this.selected = null; this.content = null; this.error = null; cx.notify(); }));
    header.child(div().flex_1().min_w(0).truncate().font_medium().text_color(t.foreground).child(this.selected ? this.selected.slice(p.folder.length + (p.folder.endsWith("/") ? 0 : 1)) : "Changed Markdown files"));
    header.child(button("markdown-close", "Close", close));

    let body;
    if (this.loading) body = div().flex_1().flex().items_center().justify_center().text_color(t.dim).child(this.selected ? "Loading Markdown…" : "Checking changed Markdown files…");
    else if (this.error) body = div().flex_1().p(18).text_color(t.blocked).child(this.error);
    else if (this.selected) body = div().id("markdown-document-scroll").flex_1().min_h(0).p(18).overflow_y_scrollbar()
      .child(TextView.markdown("markdown-document", this.content ?? "").text_size(17.5));
    else if (!this.files.length) body = div().flex_1().flex().items_center().justify_center().text_color(t.dim).child("No new or modified Markdown files in this project.");
    else body = v_flex().id("markdown-file-list").flex_1().min_h(0).p(8).gap(2).overflow_y_scrollbar()
      .children(this.files.map((path, index) => {
        const name = path.slice(p.folder.length + (p.folder.endsWith("/") ? 0 : 1));
        return h_flex().id(`markdown-file-${index}`).h(34).flex_none().px(8).gap(8).items_center().rounded(6).cursor_pointer()
          .text_size(15).text_color(t.foreground).hover((el) => el.bg(t.hover)).role("button")
          .accessibility_label(`Open ${name}`).on_click((_e, cx) => this.openFile(path, cx))
          .child(svg("mods/my-markdown/icons/file-text.svg").size(14).text_color(t.dim))
          .child(div().min_w(0).truncate().child(name));
      }));

    const overlay = v_flex().id("markdown-viewer").size_full().rounded(14).border(1).border_color(t.border).bg(t.popover).shadow_2xl()
      .on_key_down((e, cx) => { if (e.key === "escape") { close(); cx.stop_propagation(); } });
    if (this.focus) overlay.track_focus(this.focus);
    return overlay.child(header).child(body);
  }
}
