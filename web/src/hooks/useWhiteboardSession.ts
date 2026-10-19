import { useCallback, useEffect, useRef, useState } from "react";
import type { Editor } from "tldraw";
import type { BackgroundLayout } from "@/components/Whiteboard/background-layout";
import { createWhiteboardAutosave, type SaveStatus, type WhiteboardAutosaveController } from "@/lib/whiteboard-autosave";
import { parseWhiteboardTags } from "@/lib/whiteboard-tags";
import type { WhiteboardPatch } from "./useWhiteboardQueries";

/** Independent field saves share the board's mutation queue. Metadata never constructs a document snapshot. */
export function useWhiteboardSession({
  initialTitle,
  initialTags,
  initialBackground,
  patch,
  onDocumentSaved,
  getDocument,
}: {
  initialTitle: string;
  initialTags: string[];
  initialBackground: BackgroundLayout;
  patch: (value: WhiteboardPatch) => Promise<unknown>;
  onDocumentSaved: () => void;
  getDocument: (editor: Editor) => Promise<string>;
}) {
  const [title, setTitle] = useState(initialTitle);
  const [tags, setTags] = useState(initialTags.join(", "));
  const [background, setBackground] = useState(initialBackground);
  const values = useRef({ title, tags, background });
  const callbacks = useRef({ patch, onDocumentSaved, getDocument });
  callbacks.current = { patch, onDocumentSaved, getDocument };
  const controllers = useRef<{
    title?: WhiteboardAutosaveController;
    tags?: WhiteboardAutosaveController;
    document?: WhiteboardAutosaveController;
    background?: WhiteboardAutosaveController;
  }>({});
  const [, render] = useState(0);
  const refresh = useCallback(() => render((value) => value + 1), []);

  useEffect(() => {
    const titleSave = createWhiteboardAutosave({
      getSnapshot: () => values.current.title,
      save: async (title) => {
        if (!title.trim()) throw new Error("Title must not be empty");
        await callbacks.current.patch({ whiteboard: { title }, updateMask: ["title"] });
      },
      debounceMs: 700,
    });
    const tagSave = createWhiteboardAutosave({
      getSnapshot: () => parseWhiteboardTags(values.current.tags),
      save: async (tags) => {
        await callbacks.current.patch({ whiteboard: { tags }, updateMask: ["tags"] });
      },
      debounceMs: 700,
    });
    controllers.current.title = titleSave;
    const backgroundSave = createWhiteboardAutosave({
      getSnapshot: () => values.current.background,
      save: async (backgroundLayout) => {
        await callbacks.current.patch({ whiteboard: { backgroundLayout }, updateMask: ["background_layout"] });
      },
      debounceMs: 0,
    });
    controllers.current.background = backgroundSave;
    const offBackground = backgroundSave.subscribe(refresh);
    controllers.current.tags = tagSave;
    const offTitle = titleSave.subscribe(refresh);
    const offTags = tagSave.subscribe(refresh);
    return () => {
      offTitle();
      offBackground();
      backgroundSave.dispose();
      offTags();
      titleSave.dispose();
      tagSave.dispose();
    };
  }, [refresh]);

  const attachDocument = useCallback(
    (editor: Editor) => {
      const document = createWhiteboardAutosave({
        getSnapshot: () => callbacks.current.getDocument(editor),
        save: async (snapshot) => {
          const json = await snapshot;
          await callbacks.current.patch({ whiteboard: { document: json }, updateMask: ["document"] });
          callbacks.current.onDocumentSaved();
        },
      });
      controllers.current.document = document;
      const unsubscribe = document.subscribe(refresh);
      const stopListening = editor.store.listen(() => document.markChanged(), { scope: "document" });
      return () => {
        stopListening();
        unsubscribe();
        document.dispose();
        if (controllers.current.document === document) controllers.current.document = undefined;
      };
    },
    [refresh],
  );
  const isDirty = useCallback(() => Object.values(controllers.current).some((controller) => controller?.dirty), []);
  const isDocumentClean = useCallback(() => !controllers.current.document?.dirty, []);
  const saveNow = useCallback(async () => {
    await Promise.all(Object.values(controllers.current).map((controller) => controller?.saveNow()));
  }, []);
  const statuses = Object.values(controllers.current).map((controller) => controller?.status);
  const status: SaveStatus = statuses.includes("error")
    ? "error"
    : statuses.includes("saving")
      ? "saving"
      : isDirty()
        ? "unsaved"
        : "saved";
  return {
    title,
    tags,
    background,
    status,
    isDirty,
    isDocumentClean,
    saveNow,
    attachDocument,
    setBackground(value: BackgroundLayout) {
      values.current.background = value;
      setBackground(value);
      controllers.current.background?.markChanged();
    },
    setTitle(value: string) {
      values.current.title = value;
      setTitle(value);
      controllers.current.title?.markChanged();
    },
    setTags(value: string) {
      values.current.tags = value;
      setTags(value);
      controllers.current.tags?.markChanged();
    },
  };
}
