import { create } from "@bufbuild/protobuf";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { useUpdateWhiteboard, whiteboardKeys } from "@/hooks/useWhiteboardQueries";
import { WhiteboardSchema } from "@/types/proto/api/whiteboard_service_pb";

const api = vi.hoisted(() => ({ updateWhiteboard: vi.fn() }));
vi.mock("@/connect", () => ({ whiteboardServiceClient: api }));

describe("whiteboard query mutations", () => {
  it("uses field masks without replacing a cached drawing with a stale metadata response", async () => {
    const viewer = "users/owner";
    const name = "whiteboards/one";
    const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
    const current = create(WhiteboardSchema, { name, title: "Original", document: "newer drawing" });
    client.setQueryData(whiteboardKeys.detail(viewer, name), current);
    api.updateWhiteboard.mockResolvedValue(create(WhiteboardSchema, { name, title: "Changed", document: "older drawing" }));
    const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
    const { result } = renderHook(() => useUpdateWhiteboard(viewer, name), { wrapper });
    await act(async () => {
      await result.current.mutateAsync({ whiteboard: { title: "Changed" }, updateMask: ["title"] });
    });
    expect(api.updateWhiteboard).toHaveBeenCalledWith({
      whiteboard: expect.objectContaining({ name, title: "Changed" }),
      updateMask: { paths: ["title"] },
    });
    expect(client.getQueryData(whiteboardKeys.detail(viewer, name))).toEqual(current);
    expect(client.getQueryState(whiteboardKeys.detail(viewer, name))?.isInvalidated).toBe(true);
    expect(whiteboardKeys.detail("users/other", name)).not.toEqual(whiteboardKeys.detail(viewer, name));
    client.clear();
  });
});
