# Herdr Workbench
A dark, terminal-first workspace with agent activity and project spaces on the left, tabs and quick actions above the terminal, and an optional GitHub issues/PR panel. The layout inherits the user's theme and fonts. ![Herdr Workbench](preview.png)

## What you see
- **Left sidebar (256px; min 208, max 480; not resizable):** 40px brand header; flexible agent and spaces lists (each min 90px); 44px footer. Agent entries group into Needs you, Done, Working, and Idle. Spaces use equal profile-aware lists. The sidebar uses the theme's `chrome` color.
- **Top bar (40px):** flexible tabs, a 124px GitHub toggle, 108px Add action control, and a 36px tab-bar end control.
- **Work area:** active tab with 8px horizontal inset and gap. Panes have always-visible 28px top headers, 8px radius/gap and 2px theme-background borders; focused panes use the same border color. Terminals have `[8,0]` padding and zero opacity.
- **GitHub panel:** hidden by default; when shown, 400px wide (min 300, max 650), alongside the terminal. An 8px bottom inset and hidden 28px status block finish the work column. Root title bar is hidden; macOS traffic lights are at `[16,12]`.

## How it behaves
- Agent states rank **Needs you** (blocked), **Done**, **Working**, **Idle**. Working uses a spinner; blocked uses an exclamation mark; idle a ring; done a dot. Sub-agents contribute to their parent's urgency. Rows can be focused, folded, pinned, and opened; hover reveals controls and labels. This `t3-agents` list does not send standalone macOS notifications.
- Spaces are grouped by repository/worktree and machine. The profile picker lets people create, rename, delete, and switch profiles, and move spaces between them. New spaces belong to the active profile; rows can be selected, reordered, or opened in another machine. Git status and project icons update from the current folders.
- Tabs can be selected, renamed, reordered, and closed. Pane headers split, zoom, focus, or close panes. Add action and new-space/tab controls open their respective menus. The terminal right-click menu is `t3-menu`.
- **Issues & PRs** toggles the GitHub panel. It finds the active project's GitHub remote, fetches open issues/PRs, shows PR checks separately from mergeability, and opens selected items in a browser. Successful PR checks trigger a macOS notification; polling is every five minutes.

## Built from
Use `layouts/herdr-workbench.json`. Its root is a row: a 256px `sidebar` column (`t3-chrome`, `t3-agents`, `my-spaces` with `newMenu: t3-new-menu`, and `t3-chrome` footer) beside `work`. `work` contains the top bar (`t3-tabs`, `my-github-toggle`, `t3-actions` with `block: actions`, `t3-tabs` with `part: end`), then the active tab and hidden `my-github` panel, an 8px inset, and hidden `workspace-status`. The active-tab block uses `t3-pane` for pane headers. `t3-menu` is the layout's terminal menu.

Bundle every directory under `mods/`: `my-spaces`, `my-github`, `my-github-toggle`, `t3-actions`, `t3-agents`, `t3-chrome`, `t3-home`, `t3-menu`, `t3-new-menu`, `t3-pane`, `t3-picker`, `t3-tabs`, `workspace-chrome`, and `workspace-status`. The T3 mods provide the branded sidebar, agent list, tab bar, pane controls, Home/Go to views, action/new/context menus, and shared icons; the three `my-*` mods add profiles and GitHub. They use Herdr's `spaces`, `panes`, `agents`, `machines`, `shared`/`setShared`, `theme`, `props`, `hc`, `exec`, `openOverlay`, and `run` APIs, including `space.*`, `tab.*`, `pane.*`, `layout.toggle`, and `agent.focus` commands.

## Watch out
`my-github` requires the `gh` CLI authenticated to GitHub and a GitHub remote in the active project's repository. It calls GitHub's REST API and uses macOS `osascript` for notifications/opening links. `my-spaces`, `t3-agents`, and `t3-new-menu` run local `git`/`sh` commands, inspect project folders for Git status and icons, and cache icons under Herdr's app home; remote spaces run commands on their machine. The layout inherits theme/fonts from settings rather than fixing them. The inherited sidebar mode switch expects an Inbox stack child, which this layout does not define, so that switch has no effect.

## Done when
- `herdr-app check <each mods/<name> folder>` passes for every bundled mod.
- Install the layout and mods, then `layout.switch {name: "herdr-workbench"}`; the sidebar, tabs, actions, and pane header render.
- Toggle GitHub open in a space whose folder has an authenticated GitHub remote; both lists load, a PR detail shows Checks and Mergeability separately, and the panel hides again from the top-bar button.
- Create two profiles and verify a new space appears only in the active profile; move it to confirm the destination changes.
