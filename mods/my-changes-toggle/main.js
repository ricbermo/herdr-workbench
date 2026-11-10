import { View, svg } from "gpui-kit";
import { h_flex } from "gpui-base";
import { theme, run, layout, nextCommand } from "herdr";

const find = (node, id) => node?.id === id ? node : (node?.children ?? []).map((child) => find(child, id)).find(Boolean);

function togglePanel() {
  const isOpen = !find(layout(), "panel")?.hidden && find(layout(), "panel-body")?.active === "changes";
  if (isOpen) run("layout.hide", { id: "panel" });
  else { run("layout.select", { stack: "panel-body", child: "changes" }); run("layout.show", { id: "panel" }); }
}

export default class ChangesToggle extends View {
  init(_props, cx) {
    cx.spawn(async () => { for (;;) if (await nextCommand() === "toggle") togglePanel(); });
  }

  render() {
    const t = theme(), isOpen = !find(layout(), "panel")?.hidden && find(layout(), "panel-body")?.active === "changes";
    return h_flex().id("changes-toggle").w_full().h_full().px(8).items_center().justify_center()
      .child(h_flex().h(24).px(7).gap(5).items_center().rounded(8).border(1).border_color(t.border)
        .text_size(12).cursor_pointer().text_color(isOpen ? t.foreground : t.dim)
        .role("button").accessibility_label(isOpen ? "Close Changes" : "Open Changes")
        .hover((el) => el.bg(t.hover).text_color(t.foreground))
        .on_click(togglePanel)
        .child(svg("mods/changes/changes.svg").size(14)).child("Changes"));
  }
}
