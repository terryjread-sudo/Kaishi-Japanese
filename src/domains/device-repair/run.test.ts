import { canRevealNewWord, createRepairRun, createServiceTags, nextFault } from "./run";
import { describe, expect, it } from "vitest";

const words = ["one", "two", "three", "new"].map((id) => ({
  id,
  word: id,
  reading: id,
  meaning: id,
}));

describe("device repair run", () => {
  it("creates a deterministic three-fault chain before revealing its new word", () => {
    const run = createRepairRun({
      seed: 4,
      track: "review",
      knownWords: words.slice(0, 3),
      newWord: words[3]!,
      now: 10,
    });
    expect(run.device).toBe("pager");
    expect(nextFault(run)?.id).toBe("contacts");
    expect(run.diagnosticStep).toBe(0);
    expect(run.serviceTags.map((tag) => tag.wordId)).toEqual(["one", "two", "three"]);
    expect(run.serviceTags.map((tag) => tag.component)).toEqual([
      "cassette-door",
      "play-button",
      "volume-dial",
    ]);
    expect(canRevealNewWord(run)).toBe(false);
    run.solvedFaultIds.push(...run.faults.map((fault) => fault.id));
    expect(canRevealNewWord(run)).toBe(true);
  });

  it("uses only supplied introduced words for the changeable service tags", () => {
    expect(createServiceTags(words.slice(0, 3)).map((tag) => tag.word)).toEqual([
      "one", "two", "three",
    ]);
  });
});
