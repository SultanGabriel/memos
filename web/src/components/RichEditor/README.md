# Rich Editor

This independent CodeMirror editor edits a Markdown string. Memo loading, permissions,
content-only saves, and debounced autosave belong to `pages/MemoRichEditor.tsx`.

`settings.ts` defines the version 1 schema, defaults, and validation. The preferences
hook stores one global object in `memos-rich-editor-settings`, migrates the former Vim
and autosave keys, and synchronizes changes from other browser tabs. Invalid or missing
fields fall back to defaults; unknown fields are discarded.

Runtime configuration uses Compartments. Only changed extensions are reconfigured,
so unrelated preferences preserve Vim mode, editor selection, and undo history.
The stable core comes from `minimalSetup`; optional native extensions replace the
nonconfigurable `basicSetup` bundle. Native search/replace and Markdown folding remain
enabled, and line numbers and fold controls have independent Compartments.
Tab size controls displayed tabs, and `indentUnit` controls tabs or spaces used for indentation.
These settings do not rewrite existing whitespace.

The column guide is a CodeMirror theme on `.cm-content`, measured in `ch` using the
base monospace font. It follows font-size changes and horizontal document scrolling.
It represents source columns, not the width of rendered Markdown: enlarged headings,
images, tables, and wide Unicode characters may not align exactly with the guide.
The guide does not wrap at visual line breaks or change document content.

Native whitespace decorators visualize spaces/tabs without changing them. Nothing
trims or reformats Markdown on save. `scrollPastEnd` operates inside the editor's
scrollable viewport; line height applies to its content and rendered code lines.
New settings default to 14px, Wide content, and 1.6 line height. Previously saved
valid font sizes and widths remain in effect.

`headings.ts` extracts ATX and Setext headings from the Markdown syntax tree for
cursor breadcrumbs; `#tag` is not a heading. `status.ts` derives line/column,
selection length, source word counts, and Unicode character counts from normal
editor updates, caching counts until the document changes and headings until the
parse tree changes. Columns account for tab size. Vim mode uses the package's
mode-change event. None of these features poll or mutate the document.

`tagHighlights.ts` adds soft primary-color pills using the shared Memos tag
grammar. Markdown headings, code, links/images, raw HTML, and escaped introducers
are excluded using the syntax tree. Decorations affect visible text only, work
with live preview on or off, and do not replace or change the `#tag` source.
