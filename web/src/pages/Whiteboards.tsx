import { PlusIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "react-hot-toast";
import { useNavigate } from "react-router-dom";
import ConfirmDialog from "@/components/ConfirmDialog";
import WhiteboardCard from "@/components/Whiteboard/WhiteboardCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import useCurrentUser from "@/hooks/useCurrentUser";
import { useCreateWhiteboard, useDeleteWhiteboard, useWhiteboards } from "@/hooks/useWhiteboardQueries";
import { whiteboardFilter, whiteboardPath } from "@/lib/whiteboard";
import type { Whiteboard } from "@/types/proto/api/whiteboard_service_pb";
import { useTranslate } from "@/utils/i18n";
import "@/components/Whiteboard/whiteboard.css";

export default function Whiteboards() {
  const user = useCurrentUser();
  const viewer = user?.name ?? "";
  const t = useTranslate();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [tag, setTag] = useState("");
  const [filter, setFilter] = useState("");
  const [order, setOrder] = useState("update_time desc");
  const [deleting, setDeleting] = useState<Whiteboard | null>(null);
  useEffect(() => {
    const timer = setTimeout(() => setFilter(whiteboardFilter(search, tag)), 300);
    return () => clearTimeout(timer);
  }, [search, tag]);
  const boards = useWhiteboards(viewer, filter, order);
  const createBoard = useCreateWhiteboard(viewer);
  const deleteBoard = useDeleteWhiteboard(viewer);
  const items = boards.data?.pages.flatMap((page) => page.whiteboards) ?? [];
  const sortOptions = [
    ["update_time desc", t("whiteboards.updated-desc")],
    ["update_time asc", t("whiteboards.updated-asc")],
    ["create_time desc", t("whiteboards.created-desc")],
    ["create_time asc", t("whiteboards.created-asc")],
    ["title asc", t("whiteboards.title-asc")],
    ["title desc", t("whiteboards.title-desc")],
  ];
  const create = async () => {
    try {
      const board = await createBoard.mutateAsync();
      void navigate(whiteboardPath(board.name));
    } catch {
      toast.error(t("whiteboards.create-error"));
    }
  };
  return (
    <section className="whiteboard-ui mx-auto w-full max-w-7xl space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">{t("whiteboards.title")}</h1>
        <Button
          className="whiteboard-action"
          onClick={() => {
            void create();
          }}
          disabled={createBoard.isPending}
        >
          <PlusIcon className="size-4" />
          {t("whiteboards.new")}
        </Button>
      </header>
      <div className="flex flex-wrap items-center gap-2">
        <Input
          type="search"
          aria-label={t("whiteboards.search")}
          placeholder={t("whiteboards.search")}
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          className="w-56 flex-1"
        />
        <Input
          aria-label={t("whiteboards.tag-filter")}
          placeholder={t("whiteboards.tag-filter")}
          value={tag}
          onChange={(event) => setTag(event.target.value)}
          className="w-40 flex-1"
        />
        <Select value={order} onValueChange={setOrder}>
          <SelectTrigger aria-label={t("whiteboards.sort")}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {sortOptions.map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {boards.isPending && (
        <p role="status" className="text-muted-foreground">
          {t("whiteboards.loading")}
        </p>
      )}
      {boards.isError && (
        <div role="alert" className="space-y-2">
          <p>{t("whiteboards.list-error")}</p>
          <Button
            variant="outline"
            onClick={() => {
              void boards.refetch();
            }}
          >
            {t("whiteboards.retry")}
          </Button>
        </div>
      )}
      {boards.isSuccess && items.length === 0 && <p className="py-12 text-center text-muted-foreground">{t("whiteboards.empty")}</p>}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {items.map((board) => (
          <WhiteboardCard key={board.name} board={board} viewer={viewer} onDelete={() => setDeleting(board)} />
        ))}
      </div>
      {boards.hasNextPage && (
        <Button
          variant="outline"
          disabled={boards.isFetchingNextPage}
          onClick={() => {
            void boards.fetchNextPage();
          }}
        >
          {t("whiteboards.load-more")}
        </Button>
      )}
      <ConfirmDialog
        open={Boolean(deleting)}
        onOpenChange={(open) => {
          if (!open) setDeleting(null);
        }}
        title={t("whiteboards.delete-title")}
        description={t("whiteboards.delete-description", { title: deleting?.title })}
        confirmLabel={t("common.delete")}
        cancelLabel={t("common.cancel")}
        confirmVariant="destructive"
        onConfirm={async () => {
          if (!deleting) return;
          try {
            await deleteBoard.mutateAsync(deleting.name);
          } catch (error) {
            toast.error(t("whiteboards.delete-error"));
            throw error;
          }
        }}
      />
    </section>
  );
}
