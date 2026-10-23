# Changelog

Changes specific to this personal fork of Memos. Fork release tags use `v0.x.x`, independently of upstream's release versions.

Add upcoming changes under **Unreleased**, then move them into a new version section when tagging a release. Keep the newest release first and group entries under Added, Changed, or Fixed as needed.

## v0.2.0 — Unreleased

### Added

- Whiteboards (WIP): a separate, private tldraw feature with a top-level sidebar entry, searchable card library, tags, sorting, and immediate creation.
- Whiteboard APIs and persistence for SQLite, MySQL, and PostgreSQL, with creator/admin access and attachment-backed images and previews.
- Document-only autosave, Ctrl/Cmd+S, unsaved-change protection, and independent metadata updates.
- Client-generated previews with failure-safe replacement and old-thumbnail cleanup; image uploads and preview regeneration are disabled for admins editing another user's board.
- Per-whiteboard backgrounds persisted across all three databases: Blank, Lines, Engineering Grid, Graph Paper, and Isometric, with world-space patterns and zoom-dependent fading.
- A separate Writing Pen with local controls for size, smoothing, streamline, thinning, pressure simulation, taper, and caps; each stroke keeps its original rendering settings.
- Independently movable toolbar and color/style docks with local Top, Bottom, Left, and Right preferences, shared docking on the same edge, and iPad safe-area spacing.
- Build-time tldraw license configuration through `VITE_TLDRAW_LICENSE_KEY`, with a frontend environment example and setup documentation.
- Resource-wide revision protection prevents stale clients from overwriting documents or metadata. Conflicts pause saving and offer a duplicate, a confirmed server reload, or keeping the local copy open.

### Changed

- Whiteboard title, tags, save status, background selection, and local tool settings now live in Memos' existing sidebar, leaving more room for the canvas.
- Whiteboard routes offer a centered sidebar collapse/expand handle, using shared sidebar controls and preserving the mobile navigation drawer.
- New Whiteboard UI translations are maintained in English and German.

### Fixed

- Keep the Whiteboard editor/store stable across drawing, save-status updates, and background query changes so new strokes are preserved.
- Keep Whiteboard application controls above the canvas UI, without rebuilding the editor when backgrounds, pen settings, dock positions, or sidebar visibility change.

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
