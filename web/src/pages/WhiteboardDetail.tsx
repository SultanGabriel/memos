import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import WhiteboardEditor from "@/components/Whiteboard/WhiteboardEditor";
import { Button } from "@/components/ui/button";
import useCurrentUser from "@/hooks/useCurrentUser";
import { useWhiteboard } from "@/hooks/useWhiteboardQueries";
import { whiteboardName } from "@/lib/whiteboard";
import type { Whiteboard } from "@/types/proto/api/whiteboard_service_pb";
import { useTranslate } from "@/utils/i18n";

export default function WhiteboardDetail() {
  const { uid = "" } = useParams();
  const user = useCurrentUser();
  const viewer = user?.name ?? "";
  const name = uid ? whiteboardName(uid) : "";
  return <WhiteboardDetailSession key={`${viewer}:${name}`} viewer={viewer} name={name} />;
}

function WhiteboardDetailSession({ viewer, name }: { viewer: string; name: string }) {
  const t = useTranslate();
  const query = useWhiteboard(viewer, name);
  const [initialBoard, setInitialBoard] = useState<Whiteboard | null>(null);
  useEffect(() => {
    if (!initialBoard && query.isFetchedAfterMount && !query.isError && query.data) setInitialBoard(query.data);
  }, [initialBoard, query.data, query.isFetchedAfterMount, query.isError]);
  // After initialization, query refetches/errors cannot replace or remove the live editor.
  if (initialBoard) return <WhiteboardEditor whiteboard={initialBoard} />;
  if (!query.isError) {
    return (
      <p role="status" className="p-6">
        {t("whiteboards.loading")}
      </p>
    );
  }
  return (
      <div role="alert" className="space-y-3 p-6">
        <p>{t("whiteboards.load-error")}</p>
        <Button
          variant="outline"
          onClick={() => {
            void query.refetch();
          }}
        >
          {t("whiteboards.retry")}
        </Button>
        <Link to="/whiteboards" className="block underline">
          {t("whiteboards.back")}
        </Link>
      </div>
  );
}
