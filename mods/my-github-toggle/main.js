import { View, svg } from "gpui-kit";
import { h_flex } from "gpui-base";
import { theme, run, layout, nextCommand } from "herdr";

const find = (node, id) => node?.id === id ? node : (node?.children ?? []).map((child) => find(child, id)).find(Boolean);

function togglePanel() {
  const isOpen = !find(layout(), "panel")?.hidden && find(layout(), "panel-body")?.active === "github";
  if (isOpen) run("layout.hide", { id: "panel" });
  else { run("layout.select", { stack: "panel-body", child: "github" }); run("layout.show", { id: "panel" }); }
}

export default class GitHubToggle extends View {
  init(_props, cx) {
    cx.spawn(async () => { for (;;) if (await nextCommand() === "toggle") togglePanel(); });
  }

  render() {
    const t = theme();
    const isOpen = !find(layout(), "panel")?.hidden && find(layout(), "panel-body")?.active === "github";
    return h_flex().id("github-toggle").w_full().h_full().px(8).items_center().justify_center()
      .child(h_flex().h(24).px(7).gap(5).items_center().rounded(8).border(1).border_color(t.border)
        .text_size(12).cursor_pointer().text_color(isOpen ? t.foreground : t.dim)
        .role("button").accessibility_label(isOpen ? "Close GitHub issues and pull requests" : "Open GitHub issues and pull requests")
        .hover((el) => el.bg(t.hover).text_color(t.foreground))
        .on_click(togglePanel)
        .child(svg("mods/my-github-toggle/github.svg").size(14)).child("Issues & PRs"));
  }
}
