import { type Editor, useValue } from "tldraw";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { useTranslate } from "@/utils/i18n";
import { WRITING_PEN_RANGES } from "./config";
import type { useWritingPenPreferences } from "./storage";
import { selectWritingPen, WRITING_PEN_TOOL_ID } from "./tool";

export default function WritingPenSettings({
  editor,
  preferences,
}: {
  editor: Editor | null;
  preferences: ReturnType<typeof useWritingPenPreferences>;
}) {
  const t = useTranslate();
  const { settings, updateSettings, reset } = preferences;
  const active = useValue("writing pen selected", () => editor?.getCurrentToolId() === WRITING_PEN_TOOL_ID, [editor]);
  return (
    <fieldset className="flex flex-col gap-3">
      <legend className="mb-2 text-xs text-muted-foreground">{t("whiteboards.writing-pen.title")}</legend>
      <div className="grid grid-cols-2 gap-2">
        <Button
          variant={active ? "secondary" : "outline"}
          size="sm"
          aria-pressed={active}
          disabled={!editor}
          onClick={() => {
            if (editor) selectWritingPen(editor);
          }}
        >
          {t("whiteboards.writing-pen.title")}
        </Button>
        <Button variant="outline" size="sm" disabled={!editor} onClick={() => editor?.setCurrentTool("draw")}>
          {t("whiteboards.writing-pen.stock-pen")}
        </Button>
      </div>
      <details>
        <summary className="cursor-pointer py-2 text-xs">{t("whiteboards.writing-pen.settings")}</summary>
        <div className="flex flex-col gap-3 pt-2">
          {(Object.keys(WRITING_PEN_RANGES) as (keyof typeof WRITING_PEN_RANGES)[]).map((key) => (
            <label key={key} className="flex flex-col gap-1 text-xs">
              <span className="flex justify-between gap-2">
                <span>{t(`whiteboards.writing-pen.${key}`)}</span>
                <span className="tabular-nums">{settings[key]}</span>
              </span>
              <input
                type="range"
                {...WRITING_PEN_RANGES[key]}
                value={settings[key]}
                aria-label={t(`whiteboards.writing-pen.${key}`)}
                className="min-h-8 w-full cursor-pointer accent-(--whiteboard-accent)"
                onChange={(event) => updateSettings({ [key]: Number(event.target.value) })}
              />
            </label>
          ))}
          {(["simulatePressure", "capStart", "capEnd"] as const).map((key) => (
            <label key={key} className="flex min-h-8 cursor-pointer items-center gap-2 text-xs">
              <Checkbox checked={settings[key]} onCheckedChange={(checked) => updateSettings({ [key]: checked })} />
              <span>{t(`whiteboards.writing-pen.${key}`)}</span>
            </label>
          ))}
          <p className="text-xs text-muted-foreground">{t("whiteboards.writing-pen.hint")}</p>
          <Button variant="ghost" size="sm" onClick={reset}>
            {t("whiteboards.writing-pen.reset")}
          </Button>
        </div>
      </details>
    </fieldset>
  );
}
