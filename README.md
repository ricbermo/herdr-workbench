# Herdr Workbench

A Dracula Classic terminal-first Herdr layout with profile-aware spaces, agent activity, a Changes panel, and an optional GitHub issues/PR panel.

![Herdr Workbench](preview.png)

See [`RECIPE.md`](RECIPE.md) for the full layout specification, required mods, behavior, limitations, and verification steps. The package is under `layouts/`, `mods/`, and `themes/`; install `themes/dracula.json` as `~/.config/herdr-app/themes/dracula.json` so the layout can load its palette.

## Requirements

- Herdr App.
- `git` and `sh` on the machine running the spaces; the layout uses them to inspect projects and worktrees.
- **Optional GitHub panel:** the [`gh` CLI](https://cli.github.com/) installed and authenticated (`gh auth login`), plus an active space whose Git remote points to GitHub. The rest of the layout works without it.
- **macOS notifications:** Agent-needs-attention and PR-check success alerts use `osascript` and therefore work only on macOS. The “Open on GitHub” button invokes macOS’s `open` command; adapt it on other operating systems.

## Theme

The layout pins Dracula Classic: background `#282A36`, foreground `#F8F8F2`, selection `#44475A`, and purple accent `#BD93F9`. Its 16 ANSI colors and Herdr UI role mappings are in [`themes/dracula.json`](themes/dracula.json), based on the [official Dracula specification](https://draculatheme.com/spec).

## Included mods

The layout directly uses `t3-chrome` (brand/footer), `t3-agents`, `my-spaces`, `t3-tabs`, `t3-pane`, `t3-menu`, and `t3-new-menu`. `t3-home` and `t3-picker` are opened through the tab bar's Home/Go to flows. Tab-close confirmation is owned by `t3-tabs`. The Changes panel uses `my-changes-toggle` and Herdr's built-in `changes` mod. The optional GitHub panel uses both `my-github-toggle` and `my-github`.

The former shared chrome icons are replaced with layout-authored SVGs stored in the mods that use them; `workspace-chrome` is no longer bundled just for shared assets.

Licensed under Apache-2.0; see [`LICENSE`](LICENSE) and [`THIRD-PARTY-NOTICES.md`](THIRD-PARTY-NOTICES.md).
