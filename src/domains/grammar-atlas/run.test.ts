import { describe, expect, it } from "vitest";
import { composeFromTiles, scoreComposition } from "./run";

describe("grammar atlas composition", () => {
  it("assembles and grades guided tiles", () => {
    const exercise = { id: "x", japanese: "これは本です。", prompt: "Say this is a book", tiles: ["これは", "本", "です。"], accepted: ["これは本です。"], explanation: "です marks the polite ending." };
    expect(composeFromTiles(exercise.tiles)).toBe("これは本です。");
    expect(scoreComposition(exercise, "これは 本 です。")).toBe(true);
  });
});
