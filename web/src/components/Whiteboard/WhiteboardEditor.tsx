import { ArrowLeftIcon, PanelTopIcon } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "react-hot-toast";
import { Link, useBlocker } from "react-router-dom";
import { createTLStore, type Editor, Tldraw } from "tldraw";
import "tldraw/tldraw.css";
import ConfirmDialog from "@/components/ConfirmDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import useCurrentUser from "@/hooks/useCurrentUser";
import { useResolvedTheme } from "@/hooks/useResolvedTheme";
import { useUpdateWhiteboard } from "@/hooks/useWhiteboardQueries";
import { useWhiteboardSession } from "@/hooks/useWhiteboardSession";
import { cn } from "@/lib/utils";
import type { Whiteboard } from "@/types/proto/api/whiteboard_service_pb";
import { useTranslate } from "@/utils/i18n";
import { isDarkTheme } from "@/utils/theme";
import { createWhiteboardAssets, WHITEBOARD_IMAGE_TYPES } from "./assets";
import { loadWhiteboardDocument, serializeWhiteboardDocument } from "./persistence";
import { createWhiteboardThumbnails } from "./thumbnail";
import "./whiteboard.css";

type BarPlacement = "top" | "bottom" | "hidden";
// tldraw configures asset utilities by array identity. Inline arrays recreate the editor.
const NO_MEDIA_TYPES: readonly string[] = [];
const placementKey = "memos:whiteboard-bar";
const initialPlacement = (): BarPlacement => {
  try {
    const value = localStorage.getItem(placementKey);
    return value === "bottom" || value === "hidden" ? value : "top";
  } catch {
    return "top";
  }
};

export default function WhiteboardEditor({ whiteboard }: { whiteboard: Whiteboard }) {
  // This session is initialized once; metadata mutation responses never reload the drawing.
  const board = useRef(whiteboard).current;
  const user = useCurrentUser();
  const viewer = user?.name ?? "";
  const isOwner = viewer === board.creator;
  const t = useTranslate();
  const messages = useRef(t);
  messages.current = t;
  const { mutateAsync: patch } = useUpdateWhiteboard(viewer, board.name);
  const dark = isDarkTheme(useResolvedTheme());
  const [placement, setPlacement] = useState<BarPlacement>(initialPlacement);
  const [pendingUploads, setPendingUploads] = useState(0);
  const pending = useRef(0);
  const editorRef = useRef<Editor | null>(null);
  const colorScheme = useRef<"dark" | "light">(dark ? "dark" : "light");
  colorScheme.current = dark ? "dark" : "light";
  const thumbnails = useRef<ReturnType<typeof createWhiteboardThumbnails> | null>(null);
  const assets = useMemo(
    () =>
      createWhiteboardAssets({
        canUpload: isOwner,
        onError: () => toast.error(messages.current("whiteboards.image-error"), { id: "whiteboard-image-error" }),
        onPending: (count) => {
          pending.current = count;
          setPendingUploads(count);
        },
      }),
    [isOwner],
  );
  // The keyed route owns this state. Dirty/status renders never construct or reload a store.
  const [canvas] = useState(() => {
    try {
      const store = createTLStore({ assets: assets.assets });
      loadWhiteboardDocument(store, board.document);
      return { store, loadError: false };
    } catch {
      return { store: undefined, loadError: true };
    }
  });
  useEffect(() => {
    // Changing colorScheme as a Tldraw prop also recreates Editor in this version.
    editorRef.current?.user.updateUserPreferences({ colorScheme: dark ? "dark" : "light" });
  }, [dark]);
  const session = useWhiteboardSession({
    initialTitle: board.title,
    initialTags: board.tags,
    patch,
    getDocument: async (editor) => {
      await assets.whenIdle();
      return serializeWhiteboardDocument(editor);
    },
    onDocumentSaved: () => thumbnails.current?.markSaved(),
  });
  const { attachDocument, isDocumentClean, isDirty, saveNow } = session;
  const blocker = useBlocker(() => isDirty() || pending.current > 0);
  useEffect(() => {
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (!isDirty() && pending.current === 0) return;
      event.preventDefault();
      event.returnValue = "";
    };
    const keydown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();
        event.stopPropagation();
        void saveNow();
      }
    };
    window.addEventListener("beforeunload", beforeUnload);
    window.addEventListener("keydown", keydown, true);
    return () => {
      window.removeEventListener("beforeunload", beforeUnload);
      window.removeEventListener("keydown", keydown, true);
    };
  }, [isDirty, saveNow]);
  const onMount = useCallback(
    (editor: Editor) => {
      editorRef.current = editor;
      editor.user.updateUserPreferences({ colorScheme: colorScheme.current });
      // Keep stock file/paste/drop and pen handling. URL embeds are outside v1.
      editor.registerExternalContentHandler("url", async () => {
        toast.error(messages.current("whiteboards.images-only"));
      });
      const stopDocument = attachDocument(editor);
      const previews = createWhiteboardThumbnails({
        editor,
        initialThumbnail: board.thumbnail,
        canGenerate: isOwner,
        isClean: isDocumentClean,
        link: (thumbnail) => patch({ whiteboard: { thumbnail }, updateMask: ["thumbnail"] }),
        onError: () => toast.error(messages.current("whiteboards.thumbnail-error"), { id: "whiteboard-thumbnail-error" }),
      });
      thumbnails.current = previews;
      // A prior session may have closed before its preview debounce fired.
      if (isOwner) previews.markSaved();
      return () => {
        stopDocument();
        previews.dispose();
        thumbnails.current = null;
        if (editorRef.current === editor) editorRef.current = null;
      };
    },
    [board, attachDocument, isDocumentClean, isOwner, patch],
  );
  const moveBar = (value: string) => {
    if (value !== "top" && value !== "bottom" && value !== "hidden") return;
    setPlacement(value);
    try {
      localStorage.setItem(placementKey, value);
    } catch {
      /* Preference is optional. */
    }
  };
  const statusLabels = {
    saved: t("whiteboards.saved"),
    unsaved: t("whiteboards.unsaved"),
    saving: t("whiteboards.saving"),
    error: t("whiteboards.save-error"),
  };
  const bar = (
    <div className="whiteboard-bar flex shrink-0 flex-wrap items-center gap-2 border-border bg-background px-3 py-2 text-sm">
      <Link to="/whiteboards" className="inline-flex items-center gap-1" aria-label={t("whiteboards.back")}>
        <ArrowLeftIcon className="size-4" />
        <span className="hidden sm:inline">{t("whiteboards.title")}</span>
      </Link>
      <Input
        aria-label={t("whiteboards.board-title")}
        value={session.title}
        onChange={(event) => session.setTitle(event.target.value)}
        className="w-40 flex-1"
      />
      <Input
        aria-label={t("whiteboards.tags")}
        placeholder={t("whiteboards.tags-hint")}
        value={session.tags}
        onChange={(event) => session.setTags(event.target.value)}
        className="w-36 flex-1"
      />
      <Button
        variant="ghost"
        size="sm"
        onClick={() => {
          void saveNow();
        }}
        aria-live="polite"
      >
        {pendingUploads ? t("whiteboards.uploading") : statusLabels[session.status]}
      </Button>
      <Select value={placement} onValueChange={moveBar}>
        <SelectTrigger aria-label={t("whiteboards.bar-position")}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="top">{t("whiteboards.bar-top")}</SelectItem>
          <SelectItem value="bottom">{t("whiteboards.bar-bottom")}</SelectItem>
          <SelectItem value="hidden">{t("whiteboards.bar-hidden")}</SelectItem>
        </SelectContent>
      </Select>
      {!isOwner && <p className="w-full text-xs text-muted-foreground">{t("whiteboards.foreign-board")}</p>}
    </div>
  );
  return (
    <div className={cn("whiteboard-ui relative flex min-h-0 w-full flex-1 flex-col overflow-hidden", dark && "whiteboard-dark")}>
      {placement === "top" && bar}
      <div className="relative min-h-0 flex-1">
        <div className="absolute inset-0">
          {canvas.store && (
            <Tldraw
              store={canvas.store}
              onMount={onMount}
              licenseKey={import.meta.env.VITE_TLDRAW_LICENSE_KEY || undefined}
              acceptedImageMimeTypes={isOwner ? WHITEBOARD_IMAGE_TYPES : NO_MEDIA_TYPES}
              acceptedVideoMimeTypes={NO_MEDIA_TYPES}
            />
          )}
        </div>
        {canvas.loadError && (
          <div role="alert" className="absolute inset-0 z-50 grid place-content-center gap-3 bg-background p-6">
            <p>{t("whiteboards.load-error")}</p>
            <Link to="/whiteboards" className="underline">
              {t("whiteboards.back")}
            </Link>
          </div>
        )}
        {placement === "hidden" && (
          <Button
            className="absolute end-3 top-16 z-40"
            variant="outline"
            size="icon"
            onClick={() => moveBar("top")}
            aria-label={t("whiteboards.show-bar")}
          >
            <PanelTopIcon className="size-4" />
          </Button>
        )}
      </div>
      {placement === "bottom" && bar}
      <ConfirmDialog
        open={blocker.state === "blocked"}
        onOpenChange={(open) => {
          if (!open && blocker.state === "blocked") blocker.reset();
        }}
        title={t("whiteboards.leave-title")}
        description={t("whiteboards.leave-description")}
        confirmLabel={t("whiteboards.leave")}
        cancelLabel={t("common.cancel")}
        confirmVariant="destructive"
        onConfirm={() => {
          if (blocker.state === "blocked") blocker.proceed();
        }}
      />
    </div>
  );
}
