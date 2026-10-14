import type { RichEditorSettings } from "./settings";
import type { RichEditorStatus } from "./status";

interface StatusBarProps {
  editorStatus: RichEditorStatus | null;
  settings: RichEditorSettings;
  saveStatus: string;
  vimMode: string | null;
}

export default function RichEditorStatusBar({ editorStatus, settings, saveStatus, vimMode }: StatusBarProps) {
  return (
    <footer
      aria-label="Editor status"
      className="flex shrink-0 flex-wrap items-center gap-x-4 gap-y-1 border-t border-border bg-background px-4 py-2 text-xs text-muted-foreground"
    >
      {editorStatus && (
        <span>
          Ln {editorStatus.line}, Col {editorStatus.column}
        </span>
      )}
      {settings.showWordCount && editorStatus && <span>{editorStatus.words.toLocaleString()} words</span>}
      {settings.showCharacterCount && editorStatus && <span>{editorStatus.characters.toLocaleString()} characters</span>}
      {!!editorStatus?.selectionLength && <span>{editorStatus.selectionLength.toLocaleString()} selected</span>}
      <span>
        {saveStatus} · Autosave {settings.autosaveSeconds === 0 ? "Off" : `${settings.autosaveSeconds}s`}
      </span>
      {settings.vim && vimMode && <span>{vimMode}</span>}
      {!!editorStatus?.headingPath.length && (
        <span className="min-w-0 truncate" title={editorStatus.headingPath.join(" > ")}>
          {editorStatus.headingPath.join(" > ")}
        </span>
      )}
    </footer>
  );
}
