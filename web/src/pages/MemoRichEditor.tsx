import { ArrowLeftIcon } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Link, Navigate, useBlocker, useParams } from "react-router-dom";
import ConfirmDialog from "@/components/ConfirmDialog";
import RichEditor from "@/components/RichEditor/RichEditor";
import RichEditorSettingsPopover from "@/components/RichEditor/RichEditorSettingsPopover";
import RichEditorStatusBar from "@/components/RichEditor/RichEditorStatusBar";
import { contentWidths } from "@/components/RichEditor/settings";
import type { RichEditorStatus } from "@/components/RichEditor/status";
import { Button } from "@/components/ui/button";
import useCurrentUser from "@/hooks/useCurrentUser";
import { useMemo, useUpdateMemo } from "@/hooks/useMemoQueries";
import { useRichEditorPreferences } from "@/hooks/useRichEditorPreferences";
import { memoNamePrefix } from "@/lib/resource-names";
import type { Memo } from "@/types/proto/api/memo_service_pb";
import { canManageMemo } from "@/utils/user";

// A keyed session initializes once per memo, independently of query refreshes.
function RichEditorSession({ memo }: { memo: Memo }) {
  const currentUser = useCurrentUser();
  const editable = canManageMemo(memo, currentUser);
  const [content, setContent] = useState(memo.content);
  const [savedContent, setSavedContent] = useState(memo.content);
  const [saving, setSaving] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);
  const [editorStatus, setEditorStatus] = useState<RichEditorStatus | null>(null);
  const [vimMode, setVimMode] = useState<string | null>(null);
  const latestContent = useRef(content);
  const savedContentRef = useRef(savedContent);
  const savingRef = useRef(false);
  const discardingRef = useRef(false);
  const mounted = useRef(true);
  const { mutateAsync } = useUpdateMemo();
  const { settings, updateSettings } = useRichEditorPreferences();
  const autosave = settings.autosaveSeconds;
  const dirty = content !== savedContent;
  const blocker = useBlocker(() => editable && latestContent.current !== savedContentRef.current);

  useEffect(() => {
    if (blocker.state !== "blocked") discardingRef.current = false;
  }, [blocker.state]);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const changeContent = useCallback((value: string) => {
    latestContent.current = value;
    setContent(value);
    setSaveFailed(false);
  }, []);

  const save = useCallback(async () => {
    const submittedContent = latestContent.current;
    if (!editable || savingRef.current || submittedContent === savedContentRef.current) return;
    savingRef.current = true;
    setSaving(true);
    setSaveFailed(false);
    try {
      const updatedMemo = await mutateAsync({
        update: { name: memo.name, content: submittedContent },
        updateMask: ["content"],
      });
      if (!mounted.current) return;
      savedContentRef.current = updatedMemo.content;
      setSavedContent(updatedMemo.content);
      // A completed save must never replace edits made while it was in flight.
      if (latestContent.current === submittedContent) {
        latestContent.current = updatedMemo.content;
        setContent(updatedMemo.content);
      }
    } catch {
      if (mounted.current) setSaveFailed(true);
    } finally {
      savingRef.current = false;
      if (mounted.current) setSaving(false);
    }
  }, [editable, memo.name, mutateAsync]);

  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (latestContent.current === savedContentRef.current) return;
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, []);

  // Cover shortcuts while the header (rather than CodeMirror) has focus too.
  useEffect(() => {
    const shortcut = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();
        void save();
      }
    };
    window.addEventListener("keydown", shortcut);
    return () => window.removeEventListener("keydown", shortcut);
  }, [save]);

  useEffect(() => {
    if (!editable || !dirty || saving || autosave === 0 || blocker.state === "blocked") return;
    const timer = window.setTimeout(() => {
      void save();
    }, autosave * 1000);
    return () => window.clearTimeout(timer);
  }, [content, dirty, saving, autosave, editable, save, blocker.state]);

  // If the pending save finishes while the navigation dialog is open, leave freely.
  useEffect(() => {
    if (!dirty && blocker.state === "blocked") blocker.proceed();
  }, [dirty, blocker]);

  const status = saving ? "Saving…" : saveFailed ? "Save failed" : dirty ? "Unsaved" : "Saved";
  return (
    <section className="flex h-[calc(100dvh-3rem)] min-h-[24rem] w-full flex-col bg-background text-foreground md:h-dvh">
      <header className="z-10 flex shrink-0 flex-wrap items-center gap-3 border-b border-border bg-background px-4 py-3">
        <Button variant="ghost" size="sm" render={<Link to={`/${memo.name}`} />}>
          <ArrowLeftIcon className="size-4" /> Back
        </Button>
        <span role="status" aria-live="polite" className="text-sm text-muted-foreground">
          {status}
        </span>
        <div className="ms-auto flex flex-wrap items-center gap-3">
          <span className="text-xs text-muted-foreground">
            Autosave: {autosave === 0 ? "Off" : autosave === 60 ? "1 min" : `${autosave} sec`}
          </span>
          <RichEditorSettingsPopover settings={settings} onChange={updateSettings} />
          <Button
            size="sm"
            disabled={!editable || !dirty || saving}
            onClick={() => {
              void save();
            }}
          >
            Save
          </Button>
        </div>
      </header>
      <div className="min-h-0 w-full flex-1 px-5 sm:px-10">
        <div className="mx-auto h-full w-full" style={{ maxWidth: contentWidths[settings.contentWidth] }}>
          <RichEditor
            value={content}
            onChange={changeContent}
            onSave={() => {
              void save();
            }}
            settings={settings}
            readOnly={!editable}
            onStatusChange={setEditorStatus}
            onVimModeChange={setVimMode}
          />
        </div>
      </div>
      <RichEditorStatusBar editorStatus={editorStatus} settings={settings} saveStatus={status} vimMode={vimMode} />
      <ConfirmDialog
        open={blocker.state === "blocked" && dirty}
        title="Discard unsaved changes?"
        description="Your latest changes have not been saved. Stay to keep editing, or discard them and leave."
        cancelLabel="Stay"
        confirmLabel="Discard"
        confirmVariant="destructive"
        onOpenChange={(open) => {
          if (!open && !discardingRef.current && blocker.state === "blocked") blocker.reset();
        }}
        onConfirm={() => {
          if (blocker.state === "blocked") {
            discardingRef.current = true;
            blocker.proceed();
          }
        }}
      />
    </section>
  );
}

export default function MemoRichEditor() {
  const { uid } = useParams();
  const name = uid ? `${memoNamePrefix}${uid}` : "";
  const currentUser = useCurrentUser();
  const { data: memo, error, isUnavailable, fetchStatus, refetch } = useMemo(name, { enabled: !!name });

  if (!name || (isUnavailable && fetchStatus === "idle" && !error)) return <Navigate to="/404" replace />;
  if (error && !memo) {
    return (
      <div className="flex flex-col items-center gap-3 p-8">
        <p role="alert">Could not load this memo.</p>
        <Button
          onClick={() => {
            void refetch();
          }}
        >
          Retry
        </Button>
        <Link to={`/${name}`} className="text-primary underline">
          Back to memo
        </Link>
      </div>
    );
  }
  if (!memo)
    return (
      <p role="status" className="p-8 text-muted-foreground">
        Loading memo…
      </p>
    );
  if (!canManageMemo(memo, currentUser)) return <Navigate to={`/${name}`} replace />;
  return <RichEditorSession key={memo.name} memo={memo} />;
}
