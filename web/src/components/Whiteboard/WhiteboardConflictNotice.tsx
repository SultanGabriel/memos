import { useEffect, useState } from "react";
import ConfirmDialog from "@/components/ConfirmDialog";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useTranslate } from "@/utils/i18n";

export default function WhiteboardConflictNotice({
  conflict,
  busy,
  onDuplicate,
  onReload,
}: {
  conflict: boolean;
  busy: boolean;
  onDuplicate: () => void;
  onReload: () => void;
}) {
  const t = useTranslate();
  const [open, setOpen] = useState(false);
  const [confirmReload, setConfirmReload] = useState(false);
  useEffect(() => { setOpen(conflict); }, [conflict]);
  if (!conflict) return null;
  return (
    <>
      <div
        role="alert"
        className="absolute start-10 end-3 top-3 z-40 flex flex-wrap items-center justify-center gap-2 rounded-lg border bg-background p-2 text-sm shadow-sm"
      >
        <span>{t("whiteboards.conflict-title")}</span>
        <Button variant="outline" size="sm" disabled={busy} onClick={() => setOpen(true)}>
          {t("whiteboards.conflict-actions")}
        </Button>
      </div>
      <Dialog open={open && !confirmReload} onOpenChange={(value) => { if (!busy) setOpen(value); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("whiteboards.conflict-title")}</DialogTitle>
            <DialogDescription>{t("whiteboards.conflict-description")}</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2">
            <Button disabled={busy} onClick={onDuplicate}>
              {t("whiteboards.conflict-duplicate")}
            </Button>
            <Button variant="outline" disabled={busy} onClick={() => setConfirmReload(true)}>
              {t("whiteboards.conflict-reload")}
            </Button>
            <Button variant="ghost" disabled={busy} onClick={() => setOpen(false)}>
              {t("whiteboards.conflict-keep")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      <ConfirmDialog
        open={confirmReload}
        onOpenChange={(value) => { setConfirmReload(value); if (!value) setOpen(true); }}
        title={t("whiteboards.conflict-reload")}
        description={t("whiteboards.conflict-reload-confirm")}
        confirmLabel={t("whiteboards.conflict-reload")}
        cancelLabel={t("common.cancel")}
        confirmVariant="destructive"
        onConfirm={() => { setConfirmReload(false); setOpen(false); onReload(); }}
      />
    </>
  );
}
