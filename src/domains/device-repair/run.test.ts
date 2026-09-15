import { canRevealNewWord, createRepairRun, createServiceTags, nextRepairModule } from "./run";
import { describe, expect, it } from "vitest";

const words = ["one", "two", "three", "new"].map((id) => ({
  id,
  word: id,
  reading: id,
  meaning: id,
}));

describe("device repair run", () => {
  it("creates a deterministic six-module repair before revealing its new word", () => {
    const run = createRepairRun({
      seed: 4,
      track: "review",
      knownWords: words.slice(0, 3),
      newWord: words[3]!,
      now: 10,
    });
    expect(run.device).toBe("pager");
    expect(nextRepairModule(run)?.id).toBe("cover");
    expect(run.diagnosticStep).toBe(0);
    expect(run.serviceTags.map((tag) => tag.wordId)).toEqual(["one", "two", "three"]);
    expect(run.serviceTags.map((tag) => tag.component)).toEqual([
      "cassette-door",
      "play-button",
      "volume-dial",
    ]);
    expect(canRevealNewWord(run)).toBe(false);
    expect(run.modules).toHaveLength(6);
    run.solvedFaultIds.push(...run.modules.map((item) => item.id));
    expect(canRevealNewWord(run)).toBe(true);
  });

  it("uses only supplied introduced words for the changeable service tags", () => {
    expect(createServiceTags(words.slice(0, 3)).map((tag) => tag.word)).toEqual([
      "one", "two", "three",
    ]);
  });

  it("builds an eight-module advanced cassette repair", () => {
    const run = createRepairRun({
      seed: 4,
      track: "review",
      knownWords: words.slice(0, 3),
      newWord: words[3]!,
      device: "cassette",
      advanced: true,
    });
    expect(run.device).toBe("cassette");
    expect(run.modules).toHaveLength(8);
    expect(run.modules.map((item) => item.interaction)).toContain("drag");
    expect(run.modules.map((item) => item.interaction)).toContain("sequence");
  });
});
