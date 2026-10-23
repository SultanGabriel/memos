import { create, type MessageInitShape } from "@bufbuild/protobuf";
import { type QueryClient, useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useSyncExternalStore } from "react";
import { whiteboardServiceClient } from "@/connect";
import { createWhiteboardRevisionCoordinator } from "@/lib/whiteboard-revision";
import { type Whiteboard, WhiteboardSchema } from "@/types/proto/api/whiteboard_service_pb";

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

type RevisionEntry = { coordinator: ReturnType<typeof createWhiteboardRevisionCoordinator>; consumers: number };
const revisionSessions = new WeakMap<QueryClient, Map<string, RevisionEntry>>();

export function useUpdateWhiteboard(viewer: string, name: string, initialRevision?: bigint) {
  const client = useQueryClient();
  const entry = useMemo(() => {
    let sessions = revisionSessions.get(client);
    if (!sessions) {
      sessions = new Map();
      revisionSessions.set(client, sessions);
    }
    const key = JSON.stringify([viewer, name]);
    let entry = sessions.get(key);
    if (!entry) {
      const cached = client.getQueryData<Whiteboard>(whiteboardKeys.detail(viewer, name));
      entry = { coordinator: createWhiteboardRevisionCoordinator(initialRevision ?? cached?.revision ?? 0n), consumers: 0 };
      sessions.set(key, entry);
    }
    return entry;
    // Initial revision is latched with the session, never reseeded by a cache/refetch render.
  }, [client, viewer, name, initialRevision]);
  useEffect(() => {
    entry.consumers++;
    return () => {
      entry.consumers--;
      // StrictMode may immediately resubscribe to the same session.
      queueMicrotask(() => {
        const sessions = revisionSessions.get(client);
        const key = JSON.stringify([viewer, name]);
        if (!entry.consumers && sessions?.get(key) === entry) {
          sessions.delete(key);
          entry.coordinator.dispose();
        }
      });
    };
  }, [client, entry, viewer, name]);
  const coordinator = entry.coordinator;
  const revisionState = useSyncExternalStore(coordinator.subscribe, coordinator.getSnapshot, coordinator.getSnapshot);
  const mutation = useMutation({
    retry: false,
    mutationFn: ({ whiteboard, updateMask }: WhiteboardPatch) =>
      coordinator.enqueue((expectedRevision) => whiteboardServiceClient.updateWhiteboard({
        whiteboard: create(WhiteboardSchema, { ...whiteboard, name }),
        updateMask: { paths: updateMask },
        expectedRevision,
      })),
    onSuccess: (response) => {
      client.setQueryData<Whiteboard>(whiteboardKeys.detail(viewer, name), (cached) =>
        cached && cached.revision <= response.revision
          ? { ...cached, revision: response.revision, updateTime: response.updateTime }
          : cached,
      );
      void client.invalidateQueries({ queryKey: whiteboardKeys.lists(viewer) });
      // Responses from title/thumbnail saves must never replace a newer editor document.
      void client.invalidateQueries({ queryKey: whiteboardKeys.detail(viewer, name), refetchType: "none" });
    },
  });
  return {
    ...mutation,
    coordinator,
    conflict: revisionState.conflict,
    currentRevision: revisionState.revision,
    async reloadFromServer(apply: (latest: Whiteboard) => void) {
      if (!coordinator.getSnapshot().conflict) throw new Error("Explicit conflict recovery required");
      await coordinator.whenIdle();
      const latest = await whiteboardServiceClient.getWhiteboard({ name });
      if (latest.revision < 1n) throw new Error("Invalid Whiteboard revision");
      apply(latest);
      coordinator.reset(latest.revision);
      client.setQueryData(whiteboardKeys.detail(viewer, name), latest);
      void client.invalidateQueries({ queryKey: whiteboardKeys.lists(viewer) });
      return latest;
    },
  };
}

export function useDuplicateWhiteboard(viewer: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (whiteboard: MessageInitShape<typeof WhiteboardSchema>) =>
      whiteboardServiceClient.createWhiteboard({ whiteboard: create(WhiteboardSchema, whiteboard) }),
    retry: false,
    onSuccess: () => { void client.invalidateQueries({ queryKey: whiteboardKeys.lists(viewer) }); },
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
