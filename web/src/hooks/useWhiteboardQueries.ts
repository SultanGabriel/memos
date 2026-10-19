import { create, type MessageInitShape } from "@bufbuild/protobuf";
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { whiteboardServiceClient } from "@/connect";
import { WhiteboardSchema } from "@/types/proto/api/whiteboard_service_pb";

export const whiteboardKeys = {
  lists: (viewer: string) => ["whiteboards", viewer, "list"] as const,
  list: (viewer: string, filter: string, orderBy: string) => [...whiteboardKeys.lists(viewer), filter, orderBy] as const,
  detail: (viewer: string, name: string) => ["whiteboards", viewer, "detail", name] as const,
};

export function useWhiteboards(viewer: string, filter: string, orderBy: string) {
  return useInfiniteQuery({
    queryKey: whiteboardKeys.list(viewer, filter, orderBy),
    queryFn: ({ pageParam, signal }) =>
      whiteboardServiceClient.listWhiteboards({ filter, orderBy, pageSize: 30, pageToken: pageParam }, { signal }),
    initialPageParam: "",
    getNextPageParam: (page) => page.nextPageToken || undefined,
    enabled: Boolean(viewer),
  });
}

export function useWhiteboard(viewer: string, name: string) {
  return useQuery({
    queryKey: whiteboardKeys.detail(viewer, name),
    queryFn: ({ signal }) => whiteboardServiceClient.getWhiteboard({ name }, { signal }),
    enabled: Boolean(viewer && name),
    refetchOnMount: "always",
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    retry: false,
  });
}

export function useCreateWhiteboard(viewer: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: () => whiteboardServiceClient.createWhiteboard({ whiteboard: create(WhiteboardSchema) }),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: whiteboardKeys.lists(viewer) });
    },
  });
}

export type WhiteboardPatch = { whiteboard: MessageInitShape<typeof WhiteboardSchema>; updateMask: string[] };

export function useUpdateWhiteboard(viewer: string, name: string) {
  const client = useQueryClient();
  return useMutation({
    // All writes for this board share one queue, including different hook instances.
    scope: { id: `whiteboard:${viewer}:${name}` },
    mutationFn: ({ whiteboard, updateMask }: WhiteboardPatch) =>
      whiteboardServiceClient.updateWhiteboard({
        whiteboard: create(WhiteboardSchema, { ...whiteboard, name }),
        updateMask: { paths: updateMask },
      }),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: whiteboardKeys.lists(viewer) });
      // Responses from title/thumbnail saves must never replace a newer editor document.
      void client.invalidateQueries({ queryKey: whiteboardKeys.detail(viewer, name), refetchType: "none" });
    },
  });
}

export function useDeleteWhiteboard(viewer: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (name: string) => whiteboardServiceClient.deleteWhiteboard({ name }),
    onSuccess: (_, name) => {
      client.removeQueries({ queryKey: whiteboardKeys.detail(viewer, name) });
      void client.invalidateQueries({ queryKey: whiteboardKeys.lists(viewer) });
    },
  });
}
