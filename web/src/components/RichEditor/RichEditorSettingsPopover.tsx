import { SettingsIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import { type RichEditorSettings, autosaveOptions, contentWidthOptions, fontSizeOptions, lineHeightOptions } from "./settings";

interface SettingsProps {
  settings: RichEditorSettings;
  onChange: (patch: Partial<Omit<RichEditorSettings, "version">>) => void;
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <label className="flex items-center justify-between gap-4 text-sm">
      {label}
      <Switch aria-label={label} checked={checked} onCheckedChange={onChange} />
    </label>
  );
}

function Select({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string | number;
  options: { value: string | number; label: string }[];
  onChange: (value: string) => void;
}) {
  return (
    <label className="flex items-center justify-between gap-4 text-sm">
      {label}
      <select
        className="rounded-md border border-border bg-background px-2 py-1 text-foreground"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export default function RichEditorSettingsPopover({ settings, onChange }: SettingsProps) {
  const [customMarker, setCustomMarker] = useState(false);
  const [markerInput, setMarkerInput] = useState(String(settings.columnMarker ?? 80));
  const marker = settings.columnMarker;
  const markerChoice = marker === null ? "off" : customMarker || ![80, 100, 120].includes(marker) ? "custom" : String(marker);

  useEffect(() => {
    setMarkerInput(String(settings.columnMarker ?? 80));
  }, [settings.columnMarker]);

  return (
    <Popover>
      <PopoverTrigger render={<Button variant="ghost" size="sm" />}>
        <SettingsIcon className="size-4" />
        Settings
      </PopoverTrigger>
      <PopoverContent align="end" className="max-h-[80dvh] w-80 max-w-[calc(100vw-2rem)] overflow-y-auto p-4">
        <h2 className="mb-4 font-medium">Rich Editor settings</h2>
        <div className="flex flex-col gap-3">
          <Toggle label="Vim mode" checked={settings.vim} onChange={(vim) => onChange({ vim })} />
          <Select
            label="Autosave"
            value={settings.autosaveSeconds}
            options={autosaveOptions.map((value) => ({ value, label: value === 0 ? "Off" : value === 60 ? "1 min" : `${value} sec` }))}
            onChange={(value) => onChange({ autosaveSeconds: Number(value) as RichEditorSettings["autosaveSeconds"] })}
          />
          <Toggle label="Line numbers" checked={settings.lineNumbers} onChange={(lineNumbers) => onChange({ lineNumbers })} />
          <Toggle label="Line wrapping" checked={settings.lineWrapping} onChange={(lineWrapping) => onChange({ lineWrapping })} />
          <Select
            label="Font size"
            value={settings.fontSize}
            options={fontSizeOptions.map((value) => ({ value, label: `${value}px` }))}
            onChange={(value) => onChange({ fontSize: Number(value) as RichEditorSettings["fontSize"] })}
          />
          <Select
            label="Line height"
            value={settings.lineHeight}
            options={lineHeightOptions.map((value) => ({ value, label: value === 1.4 ? "Compact" : value === 1.6 ? "Normal" : "Relaxed" }))}
            onChange={(value) => onChange({ lineHeight: Number(value) as RichEditorSettings["lineHeight"] })}
          />
          <Select
            label="Content width"
            value={settings.contentWidth}
            options={contentWidthOptions.map((value) => ({ value, label: value[0].toUpperCase() + value.slice(1) }))}
            onChange={(value) => onChange({ contentWidth: value as RichEditorSettings["contentWidth"] })}
          />
          <Select
            label="Tab size"
            value={settings.tabSize}
            options={[2, 4].map((value) => ({ value, label: String(value) }))}
            onChange={(value) => onChange({ tabSize: Number(value) as RichEditorSettings["tabSize"] })}
          />
          <Toggle label="Indent with tabs" checked={settings.indentWithTabs} onChange={(indentWithTabs) => onChange({ indentWithTabs })} />
          <Toggle label="Spellcheck" checked={settings.spellcheck} onChange={(spellcheck) => onChange({ spellcheck })} />
          <Toggle label="Live preview" checked={settings.livePreview} onChange={(livePreview) => onChange({ livePreview })} />
          <Toggle
            label="Highlight active line"
            checked={settings.highlightActiveLine}
            onChange={(highlightActiveLine) => onChange({ highlightActiveLine })}
          />
          <Toggle
            label="Highlight selection matches"
            checked={settings.highlightSelectionMatches}
            onChange={(highlightSelectionMatches) => onChange({ highlightSelectionMatches })}
          />
          <Toggle
            label="Bracket matching"
            checked={settings.bracketMatching}
            onChange={(bracketMatching) => onChange({ bracketMatching })}
          />
          <Toggle label="Close brackets" checked={settings.closeBrackets} onChange={(closeBrackets) => onChange({ closeBrackets })} />
          <Toggle label="Fold gutter" checked={settings.foldGutter} onChange={(foldGutter) => onChange({ foldGutter })} />
          <Select
            label="Whitespace"
            value={settings.showWhitespace}
            options={[
              { value: "off", label: "Off" },
              { value: "trailing", label: "Trailing only" },
              { value: "all", label: "All" },
            ]}
            onChange={(value) => onChange({ showWhitespace: value as RichEditorSettings["showWhitespace"] })}
          />
          <Toggle label="Scroll past end" checked={settings.scrollPastEnd} onChange={(scrollPastEnd) => onChange({ scrollPastEnd })} />
          <Toggle label="Show word count" checked={settings.showWordCount} onChange={(showWordCount) => onChange({ showWordCount })} />
          <Toggle
            label="Show character count"
            checked={settings.showCharacterCount}
            onChange={(showCharacterCount) => onChange({ showCharacterCount })}
          />
          <Select
            label="Column marker"
            value={markerChoice}
            options={[
              { value: "off", label: "Off" },
              ...[80, 100, 120].map((value) => ({ value, label: String(value) })),
              { value: "custom", label: "Custom" },
            ]}
            onChange={(value) => {
              setCustomMarker(value === "custom");
              onChange({ columnMarker: value === "off" ? null : value === "custom" ? (marker ?? 80) : Number(value) });
            }}
          />
          {markerChoice === "custom" && (
            <label className="flex items-center justify-between gap-4 text-sm">
              Custom column
              <input
                type="number"
                min={40}
                max={200}
                step={1}
                value={markerInput}
                className="w-20 rounded-md border border-border bg-background px-2 py-1"
                onChange={(event) => {
                  setMarkerInput(event.target.value);
                  const value = Number(event.target.value);
                  if (Number.isInteger(value) && value >= 40 && value <= 200) onChange({ columnMarker: value });
                }}
              />
            </label>
          )}
          <p className="text-xs text-muted-foreground">
            Column guide: 40–200 base monospace characters. Rendered headings and widgets may use different widths.
          </p>
        </div>
      </PopoverContent>
    </Popover>
  );
}
