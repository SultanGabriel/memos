import { create } from "@bufbuild/protobuf";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { useEffect, useRef } from "react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import type { Editor, TldrawProps } from "tldraw";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import WhiteboardDetail from "@/pages/WhiteboardDetail";
import WhiteboardSidebarSlot from "@/components/Whiteboard/WhiteboardSidebarSlot";
import { AppSidebarProvider } from "@/contexts/AppSidebarContext";
import { type Whiteboard, WhiteboardSchema } from "@/types/proto/api/whiteboard_service_pb";

interface TestStore {
  document: { schema: object; store: Record<string, unknown> };
  listeners: Set<() => void>;
  listen(listener: () => void): () => void;
}

const state = vi.hoisted(() => ({
  createStore: vi.fn(),
  loadSnapshot: vi.fn(),
  getSnapshot: vi.fn(),
  patch: vi.fn(),
  stores: [] as TestStore[],
  editor: null as Editor | null,
  mounts: 0,
  unmounts: 0,
  theme: "light" as "light" | "dark",
  sidebarOpen: true,
  query: {} as { data?: Whiteboard; isPending: boolean; isError: boolean; isFetchedAfterMount: boolean },
}));

// Substitute only the canvas boundary. Exercise our real route, session, persistence, and autosave code.
// Model the installed tldraw version's documented identity-sensitive initialization inputs.
vi.mock("tldraw", () => ({
  DrawShapeTool: class {},
  DrawShapeUtil: class {},
  useValue: (_name: string, getValue: () => unknown) => getValue(),
  createTLStore: state.createStore,
  loadSnapshot: state.loadSnapshot,
  getSnapshot: state.getSnapshot,
  Tldraw: ({ store, onMount, acceptedImageMimeTypes, acceptedVideoMimeTypes, colorScheme, components, shapeUtils, tools }: TldrawProps) => {
    const mount = useRef(onMount);
    mount.current = onMount;
    useEffect(() => {
      state.mounts++;
      const editor = {
        store,
        registerExternalContentHandler: vi.fn(),
        getCurrentToolId: vi.fn(() => "select"),
        setCurrentTool: vi.fn(),
        user: { updateUserPreferences: vi.fn() },
      } as unknown as Editor;
      state.editor = editor;
      const dispose = mount.current?.(editor);
      return () => { state.unmounts++; dispose?.(); };
    }, [store, acceptedImageMimeTypes, acceptedVideoMimeTypes, colorScheme, components, shapeUtils, tools]);
    return <div data-testid="whiteboard-canvas" />;
  },
}));
vi.mock("@/hooks/useCurrentUser", () => ({ default: () => ({ name: "users/owner" }) }));
vi.mock("@/hooks/useResolvedTheme", () => ({ useResolvedTheme: () => state.theme }));
vi.mock("@/hooks/useWhiteboardQueries", () => ({
  useWhiteboard: () => ({ ...state.query, refetch: vi.fn() }),
  useUpdateWhiteboard: () => ({ mutateAsync: state.patch }),
}));
vi.mock("@/utils/i18n", () => ({ useTranslate: () => (key: string) => key }));
vi.mock("@/components/ConfirmDialog", () => ({ default: () => null }));
vi.mock("@/components/Whiteboard/assets", () => ({
  WHITEBOARD_IMAGE_TYPES: ["image/png"],
  createWhiteboardAssets: () => ({ assets: {}, whenIdle: async () => {} }),
}));
vi.mock("@/components/Whiteboard/thumbnail", () => ({
  createWhiteboardThumbnails: () => ({ markSaved: vi.fn(), dispose: vi.fn() }),
}));
vi.mock("react-router-dom", async (importOriginal) => ({
  ...await importOriginal<typeof import("react-router-dom")>(),
  useBlocker: () => ({ state: "unblocked" }),
}));

const tree = () => (
  <MemoryRouter initialEntries={["/whiteboards/one"]}>
    <AppSidebarProvider>
      {state.sidebarOpen && <WhiteboardSidebarSlot />}
      <Routes><Route path="/whiteboards/:uid" element={<WhiteboardDetail />} /></Routes>
    </AppSidebarProvider>
  </MemoryRouter>
);

beforeEach(() => {
  vi.useFakeTimers();
  state.stores = [];
  state.editor = null;
  state.mounts = 0;
  state.unmounts = 0;
  state.theme = "light";
  state.sidebarOpen = true;
  localStorage.removeItem("memos-whiteboard-writing-pen");
  localStorage.removeItem("memos-whiteboard-toolbar-position");
  localStorage.removeItem("memos-whiteboard-style-panel-position");
  state.query = {
    data: create(WhiteboardSchema, { name: "whiteboards/one", creator: "users/owner", title: "One", document: "{}" }),
    isPending: false, isError: false, isFetchedAfterMount: true,
  };
  state.createStore.mockImplementation(() => {
    const store: TestStore = {
      document: { schema: {}, store: {} },
      listeners: new Set(),
      listen(listener) { store.listeners.add(listener); return () => { store.listeners.delete(listener); }; },
    };
    state.stores.push(store);
    return store;
  });
  state.loadSnapshot.mockImplementation((store: TestStore, { document }: { document: TestStore["document"] }) => {
    store.document = document;
  });
  state.getSnapshot.mockImplementation((store: TestStore) => ({ document: store.document, session: {} }));
});
afterEach(() => vi.useRealTimers());

describe("whiteboard editor lifecycle", () => {
  it("preserves the live store and stroke through dirty, saving, metadata, theme, and query state changes", async () => {
    const initial = { schema: {}, store: {} };
    if (state.query.data) state.query.data.document = JSON.stringify(initial);
    let finishSave!: () => void;
    state.patch.mockImplementation(({ updateMask }: { updateMask: string[] }) => updateMask.includes("document")
      ? new Promise<void>((resolve) => { finishSave = resolve; }) : Promise.resolve());
    const view = render(tree());
    const store = state.stores[0];
    const editor = state.editor;
    const canvas = screen.getByTestId("whiteboard-canvas");
    expect(state.createStore).toHaveBeenCalledTimes(1);
    expect(state.loadSnapshot).toHaveBeenCalledTimes(1);

    const stroke = { schema: {}, store: { "shape:stroke": { typeName: "shape", type: "draw" } } };
    act(() => {
      store.document = stroke;
      for (const listener of store.listeners) listener();
    });
    expect(screen.getByText("whiteboards.unsaved")).toBeInTheDocument();
    expect(state.patch).not.toHaveBeenCalled();
    expect(state.editor).toBe(editor);
    expect(store.document).toBe(stroke);
    expect(state.mounts).toBe(1);
    expect(state.unmounts).toBe(0);

    await act(async () => vi.advanceTimersByTimeAsync(2000));
    expect(screen.getByText("whiteboards.saving")).toBeInTheDocument();
    expect(state.patch).toHaveBeenCalledWith({ whiteboard: { document: JSON.stringify(stroke) }, updateMask: ["document"] });
    fireEvent.change(screen.getByLabelText("whiteboards.board-title"), { target: { value: "Renamed" } });
    await act(async () => vi.advanceTimersByTimeAsync(700));

    // Background metadata/refetch states, including failure, must not remove the initialized editor.
    state.query = { data: undefined, isPending: true, isError: false, isFetchedAfterMount: false };
    view.rerender(tree());
    expect(screen.getByTestId("whiteboard-canvas")).toBe(canvas);
    state.query = { data: undefined, isPending: false, isError: true, isFetchedAfterMount: true };
    view.rerender(tree());
    expect(screen.getByTestId("whiteboard-canvas")).toBe(canvas);
    state.query = {
      data: create(WhiteboardSchema, { name: "whiteboards/one", document: JSON.stringify(initial), title: "Server response" }),
      isPending: false, isError: false, isFetchedAfterMount: true,
    };
    state.theme = "dark";
    view.rerender(tree());
    await act(async () => { finishSave(); });
    expect(screen.getByText("whiteboards.saved")).toBeInTheDocument();
    expect(screen.getByLabelText("whiteboards.board-title")).toHaveValue("Renamed");
    const documentSaves = state.patch.mock.calls.filter(([request]) => request.updateMask.includes("document")).length;
    expect(screen.getByRole("radiogroup", { name: "whiteboards.background" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "whiteboards.background-blank" })).toBeChecked();
    fireEvent.click(screen.getByRole("radio", { name: "whiteboards.background-isometric" }));
    expect(screen.getByRole("radio", { name: "whiteboards.background-isometric" })).toBeChecked();
    await act(async () => vi.advanceTimersByTimeAsync(1));
    expect(state.patch).toHaveBeenLastCalledWith({
      whiteboard: { backgroundLayout: "isometric" }, updateMask: ["background_layout"],
    });
    expect(state.patch.mock.calls.filter(([request]) => request.updateMask.includes("document"))).toHaveLength(documentSaves);
    const settingsPanel = screen.getByText("whiteboards.writing-pen.settings").closest("details");
    settingsPanel?.setAttribute("open", "");
    fireEvent.change(screen.getByRole("slider", { name: "whiteboards.writing-pen.smoothing" }), { target: { value: "0.15" } });
    fireEvent.click(screen.getByRole("button", { name: "whiteboards.writing-pen.title" }));
    expect(editor?.setCurrentTool).toHaveBeenCalledWith("writing-pen");
    expect(screen.getByText("whiteboards.saved")).toBeInTheDocument();
    expect(state.patch.mock.calls.filter(([request]) => request.updateMask.includes("document"))).toHaveLength(documentSaves);
    fireEvent.click(screen.getByRole("button", { name: "whiteboards.writing-pen.reset" }));
    expect(screen.getByRole("slider", { name: "whiteboards.writing-pen.smoothing" })).toHaveValue("0.25");
    // Dock preferences must not dirty the document or change editor configuration identity.
    for (const label of ["whiteboards.toolbar-position", "whiteboards.style-panel-position"]) {
      fireEvent.click(screen.getByLabelText(label));
      fireEvent.click(screen.getByRole("option", { name: "whiteboards.toolbar-left" }));
    }
    expect(state.patch.mock.calls.filter(([request]) => request.updateMask.includes("document"))).toHaveLength(documentSaves);
    // Closing/reopening the mobile sidebar removes controls, never the live canvas.
    state.sidebarOpen = false;
    view.rerender(tree());
    expect(screen.queryByLabelText("whiteboards.board-title")).not.toBeInTheDocument();
    expect(screen.getByTestId("whiteboard-canvas")).toBe(canvas);
    state.sidebarOpen = true;
    view.rerender(tree());
    expect(screen.getByLabelText("whiteboards.board-title")).toHaveValue("Renamed");
    expect(screen.getByRole("radio", { name: "whiteboards.background-isometric" })).toBeChecked();
    expect(state.editor).toBe(editor);
    expect(store.document).toBe(stroke);
    expect(state.createStore).toHaveBeenCalledTimes(1);
    expect(state.loadSnapshot).toHaveBeenCalledTimes(1);
    expect(state.mounts).toBe(1);
    expect(state.unmounts).toBe(0);
    view.unmount();
  });
});
