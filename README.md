# Herdr Workbench

A terminal-first Herdr layout with profile-aware spaces, agent activity, a Changes panel, and an optional GitHub issues/PR panel.

![Herdr Workbench](preview.png)

See [`RECIPE.md`](RECIPE.md) for the full layout specification, required mods, behavior, limitations, and verification steps. The complete installable package is under `layouts/` and `mods/`.

## Requirements

- Herdr App.
- `git` and `sh` on the machine running the spaces; the layout uses them to inspect projects and worktrees.
- **Optional GitHub panel:** the [`gh` CLI](https://cli.github.com/) installed and authenticated (`gh auth login`), plus an active space whose Git remote points to GitHub. The rest of the layout works without it.
- **macOS notifications:** PR-check success alerts use `osascript` and therefore work only on macOS. The bundled agent list does not send separate desktop alerts when an agent needs you. The “Open on GitHub” button invokes macOS’s `open` command; adapt it on other operating systems.

## Included mods

The layout directly uses `t3-chrome` (brand/footer), `t3-agents`, `my-spaces`, `t3-tabs`, `t3-pane`, `t3-menu`, and `t3-new-menu`. `t3-home` and `t3-picker` are opened through the tab bar's Home/Go to flows; `t3-actions` provides close-confirmation dialogs. The Changes panel uses `my-changes-toggle` and Herdr's built-in `changes` mod. The optional GitHub panel uses both `my-github-toggle` and `my-github`.

`workspace-chrome` is bundled for SVG assets referenced by the mods; its `main.js` is not loaded by this layout. `workspace-status` is referenced only by a hidden layout block and has no other callers, so it can be removed if you don't plan to show that status bar.

Licensed under Apache-2.0; see [`LICENSE`](LICENSE) and [`THIRD-PARTY-NOTICES.md`](THIRD-PARTY-NOTICES.md).
