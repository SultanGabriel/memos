import { timestampDate } from "@bufbuild/protobuf/wkt";
import { useQuery } from "@tanstack/react-query";
import { PencilRulerIcon, Trash2Icon } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { attachmentServiceClient } from "@/connect";
import { whiteboardPath } from "@/lib/whiteboard";
import type { Whiteboard } from "@/types/proto/api/whiteboard_service_pb";
import { getAttachmentUrl } from "@/utils/attachment";
import { useTranslate } from "@/utils/i18n";

export default function WhiteboardCard({ board, viewer, onDelete }: { board: Whiteboard; viewer: string; onDelete: () => void }) {
  const t = useTranslate();
  const [failedPreview, setFailedPreview] = useState("");
  const preview = useQuery({
    queryKey: ["whiteboard-thumbnail", viewer, board.thumbnail],
    queryFn: ({ signal }) => attachmentServiceClient.getAttachment({ name: board.thumbnail }, { signal }),
    enabled: Boolean(board.thumbnail),
    staleTime: 60000,
    retry: false,
  });
  return (
    <article className="whiteboard-card relative overflow-hidden rounded-xl border border-border bg-card transition-colors">
      <Link to={whiteboardPath(board.name)} className="block focus-visible:outline-2 focus-visible:outline-offset-[-2px]">
        <div className="flex aspect-video items-center justify-center overflow-hidden bg-muted/40">
          {preview.data && failedPreview !== board.thumbnail ? (
            <img
              src={getAttachmentUrl(preview.data)}
              alt=""
              loading="lazy"
              className="size-full object-contain"
              onError={() => setFailedPreview(board.thumbnail)}
            />
          ) : (
            <PencilRulerIcon className="size-10 text-muted-foreground/30" strokeWidth={1} />
          )}
        </div>
        <div className="space-y-2 p-4 pe-10">
          <h2 className="truncate font-medium">{board.title}</h2>
          <div className="flex min-h-5 flex-wrap gap-1">
            {board.tags.map((tag) => (
              <span key={tag} className="max-w-full truncate rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
                {tag}
              </span>
            ))}
          </div>
          {board.updateTime && (
            <time dateTime={timestampDate(board.updateTime).toISOString()} className="block text-xs text-muted-foreground">
              {timestampDate(board.updateTime).toLocaleString()}
            </time>
          )}
        </div>
      </Link>
      <Button
        variant="ghost"
        size="icon-sm"
        className="absolute bottom-4 end-3"
        onClick={onDelete}
        aria-label={t("whiteboards.delete-named", { title: board.title })}
      >
        <Trash2Icon className="size-4" />
      </Button>
    </article>
  );
}
