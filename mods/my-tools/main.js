import { View, div, svg } from "gpui-kit";
import { h_flex } from "gpui-base";
import { focused, hc, nextCommand, notify, openOverlay, spaces, theme } from "herdr";

export function launchArgs(argv, cwd, machine) {
  return ["run", "--bg", "--json", "--no-parent", "--cwd", cwd, ...(machine ? ["--on", machine] : []), "--", ...argv];
}

export default class Tools extends View {
  init(_props, cx) {
    cx.spawn(async () => {
      for (;;) {
        const command = await nextCommand();
        if (command === "nvim") this.launch(["nvim"], "Neovim");
        if (command === "lazygit") this.launch(["lazygit"], "lazygit");
      }
    });
  }

  async launch(argv, name) {
    const focus = focused();
    const space = spaces().find((item) => item.id === focus?.space) ?? spaces().find((item) => item.active);
    const cwd = focus?.cwd || space?.folder;
    if (!cwd) return notify({ title: `No folder for ${name}`, level: "error" });

    try {
      const result = await hc(launchArgs(argv, cwd, space?.machine));
      if (result.code !== 0) throw new Error((result.stderr || result.stdout || `Could not start ${name}.`).trim());
      const address = JSON.parse(result.stdout).address;
      if (!address) throw new Error(`Herdr did not return a terminal for ${name}.`);
      openOverlay({
        kind: "dialog",
        modal: true,
        width: 0.94,
        height: 0.94,
        layout: { type: "block", background: "background", content: { terminal: address } },
      });
    } catch (error) {
      notify({ title: `Could not open ${name}`, body: String(error?.message ?? error), level: "error" });
    }
  }

  render() {
    const t = theme();
    const button = (id, label, argv, icon) => h_flex().id(id).h(24).px(7).gap(5).items_center().rounded(8).border(1).border_color(t.border)
      .text_size(12).cursor_pointer().text_color(t.dim).hover((el) => el.bg(t.hover).text_color(t.foreground))
      .role("button").accessibility_label(`Open ${label} in a modal terminal`)
      .on_click(() => this.launch(argv, label)).child(svg(icon).size(14)).child(label);
    return h_flex().size_full().items_center().justify_center().gap(16)
      .child(button("my-tools-nvim", "Neovim", ["nvim"], "mods/my-tools/icons/nvim.svg"))
      .child(button("my-tools-lazygit", "Lazygit", ["lazygit"], "mods/my-tools/icons/lazygit.svg"));
  }
}
