import { describe, expect, it } from "vitest";
import { scoreTypingAnswer } from "./run";

describe("typing lab", () => {
  it("accepts normalized Japanese text and gives useful near-miss feedback", () => {
    expect(scoreTypingAnswer("おはよう", " おはよう ").correct).toBe(true);
    expect(scoreTypingAnswer("おはよう", "おはよ").accuracy).toBeGreaterThan(70);
  });
});
