import { ArrowLeftIcon } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "react-hot-toast";
import { createPortal } from "react-dom";
import { Link, useBlocker, useNavigate } from "react-router-dom";
import { createTLStore, type Editor, Tldraw } from "tldraw";
import "tldraw/tldraw.css";
import ConfirmDialog from "@/components/ConfirmDialog";
import SidebarSection from "@/components/AppSidebar/SidebarSection";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAppSidebar } from "@/contexts/AppSidebarContext";
import useCurrentUser from "@/hooks/useCurrentUser";
import { useResolvedTheme } from "@/hooks/useResolvedTheme";
import { useDuplicateWhiteboard, useUpdateWhiteboard } from "@/hooks/useWhiteboardQueries";
import { useWhiteboardSession } from "@/hooks/useWhiteboardSession";
import { cn } from "@/lib/utils";
import { whiteboardConflictCopy } from "@/lib/whiteboard-conflict-copy";
import type { Whiteboard } from "@/types/proto/api/whiteboard_service_pb";
import { useTranslate } from "@/utils/i18n";
import { isDarkTheme } from "@/utils/theme";
import { createWhiteboardAssets, WHITEBOARD_IMAGE_TYPES } from "./assets";
import { BACKGROUND_LAYOUTS, backgroundLayout } from "./background-layout";
import { loadWhiteboardDocument, reloadWhiteboardDocument, serializeWhiteboardDocument } from "./persistence";
import WhiteboardConflictNotice from "./WhiteboardConflictNotice";
import { createWhiteboardThumbnails } from "./thumbnail";
import { WHITEBOARD_COMPONENTS, WhiteboardBackgroundContext } from "./WhiteboardBackground";
import { TOOL_DOCK_POSITIONS, useWhiteboardToolDock } from "./tool-dock-preferences";
import { WhiteboardToolDockContext } from "./WhiteboardToolDock";
import WritingPenSettings from "./writingPen/settings";
import { WRITING_PEN_SHAPE_UTILS } from "./writingPen/shape";
import { useWritingPenPreferences } from "./writingPen/storage";
import { attachWritingPenProfile, WRITING_PEN_TOOLS } from "./writingPen/tool";
import "./whiteboard.css";

// tldraw configures asset utilities by array identity. Inline arrays recreate the editor.
const NO_MEDIA_TYPES: readonly string[] = [];
const licenseKey = import.meta.env.VITE_TLDRAW_LICENSE_KEY || undefined;

export default function WhiteboardEditor({ whiteboard }: { whiteboard: Whiteboard }) {
  // This session is initialized once; metadata mutation responses never reload the drawing.
  const board = useRef(whiteboard).current;
  const user = useCurrentUser();
  const viewer = user?.name ?? "";
  const isOwner = viewer === board.creator;
  const t = useTranslate();
  const { whiteboardSidebarTargets, setMobileOpen } = useAppSidebar();
  const messages = useRef(t);
  messages.current = t;
  const mutation = useUpdateWhiteboard(viewer, board.name, board.revision);
  const { mutateAsync: patch, coordinator, conflict } = mutation;
  const duplicate = useDuplicateWhiteboard(viewer);
  const navigate = useNavigate();
  const allowLeave = useRef(false);
  const [recovering, setRecovering] = useState(false);
  const dark = isDarkTheme(useResolvedTheme());
  const dock = useWhiteboardToolDock();
  const dockPositions = useMemo(() => ({ toolbar: dock.position, styles: dock.stylePosition }), [dock.position, dock.stylePosition]);
  const [pendingUploads, setPendingUploads] = useState(0);
  const pending = useRef(0);
  const editorRef = useRef<Editor | null>(null);
  const [liveEditor, setLiveEditor] = useState<Editor | null>(null);
  const writingPen = useWritingPenPreferences();
  const { getProfile } = writingPen;
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
    initialBackground: backgroundLayout(board.backgroundLayout),
    conflicted: conflict,
    isConflicted: () => coordinator.getSnapshot().conflict,
    patch,
    getDocument: async (editor) => {
      await assets.whenIdle();
      return serializeWhiteboardDocument(editor);
    },
    onDocumentSaved: () => thumbnails.current?.markSaved(),
  });
  const { attachDocument, isDocumentClean, isDirty, saveNow } = session;
  const blocker = useBlocker(() => !allowLeave.current && (isDirty() || pending.current > 0));
  useEffect(() => {
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (allowLeave.current || (!isDirty() && pending.current === 0)) return;
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
  const startThumbnails = useCallback((editor: Editor, initialThumbnail: string) => {
    thumbnails.current?.dispose();
    thumbnails.current = createWhiteboardThumbnails({
      editor, initialThumbnail, canGenerate: isOwner, isClean: isDocumentClean,
      link: (thumbnail) => patch({ whiteboard: { thumbnail }, updateMask: ["thumbnail"] }),
      onError: () => {
        if (!coordinator.getSnapshot().conflict)
          toast.error(messages.current("whiteboards.thumbnail-error"), { id: "whiteboard-thumbnail-error" });
      },
    });
    if (isOwner) thumbnails.current.markSaved();
  }, [isOwner, isDocumentClean, patch, coordinator]);
  useEffect(() => {
    if (conflict) {
      thumbnails.current?.dispose();
      thumbnails.current = null;
    }
  }, [conflict]);
  const onMount = useCallback(
    (editor: Editor) => {
      editorRef.current = editor;
      setLiveEditor(editor);
      const detachWritingPen = attachWritingPenProfile(editor, getProfile);
      editor.user.updateUserPreferences({ colorScheme: colorScheme.current });
      // Keep stock file/paste/drop and pen handling. URL embeds are outside v1.
      editor.registerExternalContentHandler("url", async () => {
        toast.error(messages.current("whiteboards.images-only"));
      });
      const stopDocument = attachDocument(editor);
      startThumbnails(editor, board.thumbnail);
      return () => {
        detachWritingPen();
        stopDocument();
        thumbnails.current?.dispose();
        thumbnails.current = null;
        if (editorRef.current === editor) editorRef.current = null;
      };
    },
    [board, attachDocument, startThumbnails, getProfile],
  );
  const saveDuplicate = async () => {
    const editor = editorRef.current;
    if (!editor || recovering) return;
    setRecovering(true);
    try {
      await assets.whenIdle();
      const local = session.getMetadata();
      const created = await duplicate.mutateAsync(whiteboardConflictCopy({
        document: serializeWhiteboardDocument(editor), title: local.title, tags: local.tags, backgroundLayout: local.background,
      }));
      allowLeave.current = true;
      navigate(`/${created.name}`);
    } catch {
      toast.error(messages.current("whiteboards.conflict-recovery-error"));
    } finally {
      setRecovering(false);
    }
  };
  const reloadNewer = async () => {
    const editor = editorRef.current;
    if (!editor || recovering) return;
    setRecovering(true);
    try {
      await session.whenIdle();
      const latest = await mutation.reloadFromServer((latest) => {
        session.replaceDocument(() => reloadWhiteboardDocument(editor, latest.document));
        session.resetFromServer({ title: latest.title, tags: latest.tags, background: backgroundLayout(latest.backgroundLayout) });
      });
      startThumbnails(editor, latest.thumbnail);
    } catch {
      toast.error(messages.current("whiteboards.conflict-recovery-error"));
    } finally {
      setRecovering(false);
    }
  };
  const statusLabels = {
    saved: t("whiteboards.saved"),
    unsaved: t("whiteboards.unsaved"),
    saving: t("whiteboards.saving"),
    error: t("whiteboards.save-error"),
    conflict: t("whiteboards.conflict-status"),
  };
  const sidebarControls = (
    <SidebarSection label={t("whiteboards.title")}>
      <div className="whiteboard-ui flex flex-col gap-3 py-2 text-sm" inert={recovering}>
        <Link
          to="/whiteboards"
          onClick={() => setMobileOpen(false)}
          className="inline-flex items-center gap-1"
          aria-label={t("whiteboards.back")}
        >
          <ArrowLeftIcon className="size-4" />
          <span>{t("whiteboards.back")}</span>
        </Link>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-muted-foreground">{t("whiteboards.board-title")}</span>
          <Input
            aria-label={t("whiteboards.board-title")}
            value={session.title}
            onChange={(event) => session.setTitle(event.target.value)}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-muted-foreground">{t("whiteboards.tags")}</span>
          <Input
            aria-label={t("whiteboards.tags")}
            placeholder={t("whiteboards.tags-hint")}
            value={session.tags}
            onChange={(event) => session.setTags(event.target.value)}
          />
        </label>
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
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 text-xs text-muted-foreground">{t("whiteboards.background")}</legend>
          <RadioGroup
            aria-label={t("whiteboards.background")}
            value={session.background}
            onValueChange={(value) => session.setBackground(backgroundLayout(String(value)))}
          >
            {BACKGROUND_LAYOUTS.map((layout) => (
              <label key={layout} className="flex cursor-pointer items-center gap-2 py-1">
                <RadioGroupItem value={layout} />
                <span>{t(`whiteboards.background-${layout}`)}</span>
              </label>
            ))}
          </RadioGroup>
        </fieldset>
        <div className="flex flex-col gap-2">
          <span className="text-xs text-muted-foreground">{t("whiteboards.toolbar-position")}</span>
          <Select value={dock.position} onValueChange={dock.setPosition}>
            <SelectTrigger aria-label={t("whiteboards.toolbar-position")}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TOOL_DOCK_POSITIONS.map((position) => (
                <SelectItem key={position} value={position}>
                  {t(`whiteboards.toolbar-${position}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-2">
          <span className="text-xs text-muted-foreground">{t("whiteboards.style-panel-position")}</span>
          <Select value={dock.stylePosition} onValueChange={dock.setStylePosition}>
            <SelectTrigger aria-label={t("whiteboards.style-panel-position")}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TOOL_DOCK_POSITIONS.map((position) => (
                <SelectItem key={position} value={position}>
                  {t(`whiteboards.toolbar-${position}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <WritingPenSettings editor={liveEditor} preferences={writingPen} />
        {!isOwner && <p className="w-full text-xs text-muted-foreground">{t("whiteboards.foreign-board")}</p>}
      </div>
    </SidebarSection>
  );
  return (
    <div className={cn("whiteboard-ui relative flex min-h-0 w-full flex-1 flex-col overflow-hidden", dark && "whiteboard-dark")}>
      {whiteboardSidebarTargets.map((target) => createPortal(sidebarControls, target))}
      <div className="relative min-h-0 flex-1">
        <div className="absolute inset-0 isolate">
          {canvas.store && (
            <WhiteboardBackgroundContext value={session.background}>
              <WhiteboardToolDockContext value={dockPositions}>
                <Tldraw
                  store={canvas.store}
                  components={WHITEBOARD_COMPONENTS}
                  shapeUtils={WRITING_PEN_SHAPE_UTILS}
                  tools={WRITING_PEN_TOOLS}
                  onMount={onMount}
                  licenseKey={licenseKey}
                  acceptedImageMimeTypes={isOwner ? WHITEBOARD_IMAGE_TYPES : NO_MEDIA_TYPES}
                  acceptedVideoMimeTypes={NO_MEDIA_TYPES}
                />
              </WhiteboardToolDockContext>
            </WhiteboardBackgroundContext>
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
      </div>
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
      {recovering && (
        <div role="status" className="absolute inset-0 z-40 grid place-content-center bg-background/70">
          {t("whiteboards.conflict-recovering")}
        </div>
      )}
      <WhiteboardConflictNotice
        conflict={conflict}
        busy={recovering}
        onDuplicate={() => { void saveDuplicate(); }}
        onReload={() => { void reloadNewer(); }}
      />
    </div>
  );
}
