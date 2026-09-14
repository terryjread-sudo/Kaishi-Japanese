import { canRevealNewWord, createRepairRun, nextFault } from "./run";

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
    expect(canRevealNewWord(run)).toBe(false);
    run.solvedFaultIds.push(...run.faults.map((fault) => fault.id));
    expect(canRevealNewWord(run)).toBe(true);
  });
});
