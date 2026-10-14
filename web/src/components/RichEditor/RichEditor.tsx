import { openSearchPanel } from "@codemirror/search";
import { Compartment, EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { type CSSProperties, useEffect, useRef, useState } from "react";
import { configuration, configurationChanged, configurationKeys } from "./configuration";
import { editorExtensions } from "./extensions";
import type { RichEditorSettings } from "./settings";
import { type RichEditorStatus, createStatusReporter } from "./status";
import { watchVimMode } from "./vim";
import "./rich-editor.css";

interface RichEditorProps {
  value: string;
  onChange: (value: string) => void;
  onSave: () => void;
  settings: RichEditorSettings;
  readOnly?: boolean;
  onStatusChange: (status: RichEditorStatus) => void;
  onVimModeChange: (mode: string | null) => void;
}

export default function RichEditor(props: RichEditorProps) {
  const host = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const callbacks = useRef(props);
  callbacks.current = props;
  const [compartments] = useState(() => Object.fromEntries(configurationKeys.map((key) => [key, new Compartment()])));
  const readOnlyCompartment = useRef(new Compartment());
  const previousSettings = useRef(props.settings);

  useEffect(() => {
    if (!host.current) return;
    const initial = callbacks.current;
    previousSettings.current = initial.settings;
    const reporter = createStatusReporter((status) => callbacks.current.onStatusChange(status));
    const initialConfiguration = configuration(initial.settings);
    const view = new EditorView({
      parent: host.current,
      state: EditorState.create({
        doc: initial.value,
        extensions: [
          ...configurationKeys.map((key) => compartments[key].of(initialConfiguration[key])),
          readOnlyCompartment.current.of(EditorState.readOnly.of(!!initial.readOnly)),
          // Split only on LF so even mixed CRLF/LF source is preserved verbatim.
          EditorState.lineSeparator.of("\n"),
          editorExtensions(),
          reporter.extension,
          EditorView.updateListener.of((update) => {
            if (update.docChanged) callbacks.current.onChange(update.state.doc.toString());
          }),
        ],
      }),
    });
    const save = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();
        event.stopPropagation();
        callbacks.current.onSave();
      } else if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "f") {
        event.preventDefault();
        event.stopPropagation();
        openSearchPanel(view);
      }
    };
    // Capture before Vim or the browser consumes the shortcut.
    view.dom.addEventListener("keydown", save, true);
    viewRef.current = view;
    reporter.report(view.state);
    return () => {
      view.dom.removeEventListener("keydown", save, true);
      viewRef.current = null;
      view.destroy();
    };
  }, []);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    const previous = previousSettings.current;
    const next = props.settings;
    const extensions = configuration(next);
    const effects = configurationKeys
      .filter((key) => configurationChanged(key, previous, next))
      .map((key) => compartments[key].reconfigure(extensions[key]));
    // Unrelated preferences must not reset Vim's mode or live-preview state.
    if (effects.length) view.dispatch({ effects });
    previousSettings.current = next;
    view.requestMeasure();
  }, [props.settings, compartments]);

  useEffect(() => {
    const view = viewRef.current;
    if (view) return watchVimMode(view, (mode) => callbacks.current.onVimModeChange(mode));
  }, [props.settings.vim]);

  useEffect(() => {
    viewRef.current?.dispatch({ effects: readOnlyCompartment.current.reconfigure(EditorState.readOnly.of(!!props.readOnly)) });
  }, [props.readOnly]);

  useEffect(() => {
    const view = viewRef.current;
    if (view && view.state.doc.toString() !== props.value) {
      view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: props.value } });
    }
  }, [props.value]);

  return (
    <div
      ref={host}
      className="rich-editor h-full min-h-0 w-full"
      style={
        {
          "--rich-editor-font-size": `${props.settings.fontSize}px`,
          "--rich-editor-line-height": props.settings.lineHeight,
        } as CSSProperties
      }
    />
  );
}
