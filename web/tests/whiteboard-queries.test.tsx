import { create } from "@bufbuild/protobuf";
import { Code, ConnectError } from "@connectrpc/connect";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { useUpdateWhiteboard, whiteboardKeys } from "@/hooks/useWhiteboardQueries";
import { type Whiteboard, WhiteboardSchema } from "@/types/proto/api/whiteboard_service_pb";

const api = vi.hoisted(() => ({ updateWhiteboard: vi.fn(), getWhiteboard: vi.fn() }));
vi.mock("@/connect", () => ({ whiteboardServiceClient: api }));

describe("whiteboard query mutations", () => {
  it("uses field masks without replacing a cached drawing with a stale metadata response", async () => {
    const viewer = "users/owner";
    const name = "whiteboards/one";
    const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
    const current = create(WhiteboardSchema, { name, title: "Original", document: "newer drawing", revision: 10n });
    client.setQueryData(whiteboardKeys.detail(viewer, name), current);
    api.updateWhiteboard
      .mockResolvedValueOnce(create(WhiteboardSchema, { name, title: "Changed", document: "older drawing", revision: 11n }))
      .mockResolvedValueOnce(create(WhiteboardSchema, { name, revision: 12n }));
    const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
    const { result } = renderHook(() => useUpdateWhiteboard(viewer, name), { wrapper });
    await act(async () => {
      await result.current.mutateAsync({ whiteboard: { title: "Changed" }, updateMask: ["title"] });
    });
    expect(api.updateWhiteboard).toHaveBeenCalledWith({
      whiteboard: expect.objectContaining({ name, title: "Changed" }),
      updateMask: { paths: ["title"] },
      expectedRevision: 10n,
    });
    expect(client.getQueryData(whiteboardKeys.detail(viewer, name))).toMatchObject({
      document: current.document, title: current.title, revision: 11n,
    });
    await act(async () => {
      await result.current.mutateAsync({ whiteboard: { backgroundLayout: "isometric" }, updateMask: ["background_layout"] });
    });
    expect(api.updateWhiteboard).toHaveBeenLastCalledWith({
      whiteboard: expect.objectContaining({ name, backgroundLayout: "isometric" }),
      updateMask: { paths: ["background_layout"] },
      expectedRevision: 11n,
    });
    expect(client.getQueryData(whiteboardKeys.detail(viewer, name))).toMatchObject({
      document: current.document, title: current.title, revision: 12n,
    });
    expect(result.current.currentRevision).toBe(12n);
    expect(client.getQueryState(whiteboardKeys.detail(viewer, name))?.isInvalidated).toBe(true);
    expect(whiteboardKeys.detail("users/other", name)).not.toEqual(whiteboardKeys.detail(viewer, name));
    client.clear();
  });

  it("serializes different hook instances through one revision queue", async () => {
    const client = new QueryClient();
    const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
    const { result } = renderHook(() => ({
      document: useUpdateWhiteboard("users/owner", "whiteboards/one", 1n),
      metadata: useUpdateWhiteboard("users/owner", "whiteboards/one", 1n),
    }), { wrapper });
    let complete!: (board: Whiteboard) => void;
    api.updateWhiteboard
      .mockImplementationOnce(() => new Promise((resolve) => { complete = resolve; }))
      .mockResolvedValueOnce(create(WhiteboardSchema, { revision: 3n }));
    await act(async () => {
      const document = result.current.document.mutateAsync({ whiteboard: { document: "{}" }, updateMask: ["document"] });
      const title = result.current.metadata.mutateAsync({ whiteboard: { title: "New" }, updateMask: ["title"] });
      await vi.waitFor(() => expect(api.updateWhiteboard).toHaveBeenCalledTimes(1));
      expect(api.updateWhiteboard.mock.calls[0][0].expectedRevision).toBe(1n);
      complete(create(WhiteboardSchema, { revision: 2n }));
      await Promise.all([document, title]);
    });
    expect(api.updateWhiteboard.mock.calls[1][0].expectedRevision).toBe(2n);
    expect(result.current.document.currentRevision).toBe(3n);
    expect(result.current.metadata.currentRevision).toBe(3n);
  });

  it("blocks queued writes on conflict and resumes only after explicit reload", async () => {
    const client = new QueryClient();
    const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
    const { result } = renderHook(() => useUpdateWhiteboard("users/owner", "whiteboards/one", 1n), { wrapper });
    api.updateWhiteboard.mockRejectedValueOnce(new ConnectError("stale", Code.FailedPrecondition));
    await act(async () => {
      const outcomes = await Promise.allSettled([
        result.current.mutateAsync({ whiteboard: { title: "A" }, updateMask: ["title"] }),
        result.current.mutateAsync({ whiteboard: { thumbnail: "attachments/new" }, updateMask: ["thumbnail"] }),
      ]);
      expect(outcomes.map((outcome) => outcome.status)).toEqual(["rejected", "rejected"]);
    });
    expect(api.updateWhiteboard).toHaveBeenCalledTimes(1);
    expect(result.current.conflict).toBe(true);
    expect(result.current.currentRevision).toBe(1n);
    // A cache/refetch revision alone cannot resolve a conflict or advance the live coordinator.
    act(() => client.setQueryData(whiteboardKeys.detail("users/owner", "whiteboards/one"), create(WhiteboardSchema, { revision: 9n })));
    expect(result.current.currentRevision).toBe(1n);
    api.getWhiteboard.mockResolvedValueOnce(create(WhiteboardSchema, { revision: 5n, document: "explicit reload" }));
    const apply = vi.fn();
    await act(async () => { await result.current.reloadFromServer(apply); });
    expect(apply).toHaveBeenCalledWith(expect.objectContaining({ revision: 5n }));
    expect(result.current.conflict).toBe(false);
    api.updateWhiteboard.mockResolvedValueOnce(create(WhiteboardSchema, { revision: 6n }));
    await act(async () => { await result.current.mutateAsync({ whiteboard: { title: "Recovered" }, updateMask: ["title"] }); });
    expect(api.updateWhiteboard).toHaveBeenLastCalledWith(expect.objectContaining({ expectedRevision: 5n }));
    expect(result.current.currentRevision).toBe(6n);
  });
});
