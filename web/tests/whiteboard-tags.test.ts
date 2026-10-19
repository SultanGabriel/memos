import { describe, expect, it } from "vitest";
import { parseWhiteboardTags } from "@/lib/whiteboard-tags";

// Commas delimit metadata; case and spelling are preserved.
describe("whiteboard metadata tags", () => {
  it.each([
    { text: "", expected: [] },
    { text: " ,  , ", expected: [] },
    { text: " work, ideas ,work,, Work,ideas ", expected: ["work", "ideas", "Work"] },
    { text: "project/alpha, two words, #literal", expected: ["project/alpha", "two words", "#literal"] },
  ])("parses $text conservatively", ({ text, expected }) => {
    expect(parseWhiteboardTags(text)).toEqual(expected);
  });
});
