import { useCallback, useEffect, useRef, useState } from "react";
import { DEFAULT_WRITING_PEN, normalizeWritingPen, type WritingPenConfig } from "./config";

export const WRITING_PEN_STORAGE_KEY = "memos-whiteboard-writing-pen";

export function readWritingPen(): WritingPenConfig {
  try {
    const stored = localStorage.getItem(WRITING_PEN_STORAGE_KEY);
    if (stored !== null) {
      const value: unknown = JSON.parse(stored);
      if (value && typeof value === "object" && "version" in value && value.version === 1) return normalizeWritingPen(value);
    }
  } catch {
    // Defaults also work when storage is unavailable or contains malformed JSON.
  }
  return { ...DEFAULT_WRITING_PEN };
}

function persistWritingPen(config: WritingPenConfig) {
  try {
    localStorage.setItem(WRITING_PEN_STORAGE_KEY, JSON.stringify(config));
  } catch {
    // Keep this visit's settings usable when local storage is disabled/full.
  }
}

export function useWritingPenPreferences() {
  const [settings, setSettings] = useState(readWritingPen);
  const current = useRef(settings);
  const getProfile = useCallback(() => current.current, []);
  const updateSettings = useCallback((patch: Partial<Omit<WritingPenConfig, "version">>) => {
    const next = normalizeWritingPen({ ...current.current, ...patch });
    current.current = next;
    setSettings(next);
    persistWritingPen(next);
  }, []);
  const reset = useCallback(() => {
    const next = { ...DEFAULT_WRITING_PEN };
    current.current = next;
    setSettings(next);
    persistWritingPen(next);
  }, []);
  useEffect(() => {
    const sync = (event: StorageEvent) => {
      if (event.key !== WRITING_PEN_STORAGE_KEY && event.key !== null) return;
      const next = readWritingPen();
      current.current = next;
      setSettings(next);
    };
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, []);
  return { settings, getProfile, updateSettings, reset };
}
