# Changelog

Changes specific to this personal fork of Memos. Fork release tags use `v0.x.x`, independently of upstream's release versions.

Add upcoming changes under **Unreleased**, then move them into a new version section when tagging a release. Keep the newest release first and group entries under Added, Changed, or Fixed as needed.

## Unreleased

## v0.1.0 — 2026-10-14

### Added

- A dedicated Rich Editor page for existing memos, built with CodeMirror and available from the memo header and action menu.
- Markdown live preview for formatted text, tables, images, links, and code blocks, plus highlighted Memos tags.
- Optional Vim keybindings, search and replace, and Markdown folding.
- Manual saving with the Save button or Ctrl/Cmd+S, configurable autosave, save status, and warnings before leaving with unsaved changes.
- Editor preferences for font size, content width, line height, line numbers, wrapping, indentation, spellcheck, and live preview.
- Optional column guide, whitespace indicators, active-line and selection-match highlighting, bracket matching and closing, and scrolling past the end.
- A status bar with cursor position, selection length, heading breadcrumbs, optional word and character counts, and Vim mode.
- Browser-local editor preferences that persist across visits and synchronize between tabs.

### Changed

- Memo headers and action menus now offer an “Open in Rich Editor” shortcut for memos the current user can manage, including archived memos in the action menu.
- The Rich Editor saves memo content only, preserving other memo fields and edits made while a save is in progress.
