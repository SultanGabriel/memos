import { useCallback, useEffect, useRef, useState } from "react";
import { DEFAULT_RICH_EDITOR_SETTINGS, type RichEditorSettings, validateRichEditorSettings } from "@/components/RichEditor/settings";

const SETTINGS_KEY = "memos-rich-editor-settings";

function readSettings(): RichEditorSettings {
  try {
    const stored = localStorage.getItem(SETTINGS_KEY);
    if (stored !== null) return validateRichEditorSettings(JSON.parse(stored));
    // One-time migration from the original two preferences.
    const vim = localStorage.getItem("memos-rich-editor-vim");
    const autosave = localStorage.getItem("memos-rich-editor-autosave");
    return validateRichEditorSettings({
      vim: vim === "true" ? true : vim === "false" ? false : undefined,
      autosaveSeconds:
        autosave === "off" ? 0 : autosave !== null && ["3", "5", "10", "30", "60"].includes(autosave) ? Number(autosave) : undefined,
    });
  } catch {
    return { ...DEFAULT_RICH_EDITOR_SETTINGS };
  }
}

function persistSettings(settings: RichEditorSettings) {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    localStorage.removeItem("memos-rich-editor-vim");
    localStorage.removeItem("memos-rich-editor-autosave");
  } catch {
    // Settings still work for this visit when storage is unavailable.
  }
}

export function useRichEditorPreferences() {
  const [settings, setSettings] = useState(readSettings);
  const current = useRef(settings);

  useEffect(() => {
    // Store a canonical versioned object, including defaults for missing fields.
    persistSettings(current.current);
    const sync = (event: StorageEvent) => {
      if (event.key !== SETTINGS_KEY && event.key !== null) return;
      const next = readSettings();
      current.current = next;
      setSettings(next);
    };
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, []);

  const updateSettings = useCallback((patch: Partial<Omit<RichEditorSettings, "version">>) => {
    const next = validateRichEditorSettings({ ...current.current, ...patch });
    current.current = next;
    setSettings(next);
    persistSettings(next);
  }, []);

  return { settings, updateSettings };
}
