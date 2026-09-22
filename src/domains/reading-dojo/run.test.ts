import { describe, expect, it } from "vitest";
import { passageProgressKey, scoreReadingAnswer } from "./run";

describe("reading dojo", () => {
  it("scores the selected comprehension answer", () => {
    expect(scoreReadingAnswer({ prompt: "", answers: ["a"], correct: 0, explanation: "" }, 0)).toBe(true);
    expect(scoreReadingAnswer({ prompt: "", answers: ["a"], correct: 0, explanation: "" }, 1)).toBe(false);
  });

  it("uses a stable progress key", () => expect(passageProgressKey("morning-shop")).toBe("reading:morning-shop"));
});
