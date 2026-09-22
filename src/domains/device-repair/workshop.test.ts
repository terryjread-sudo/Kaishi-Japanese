import { describe, expect, it } from "vitest";
import { awardRepairWorkshopXp, createRepairWorkshopState } from "./workshop";

describe("repair workshop", () => {
  it("turns completed repairs into progression and unlocks", () => {
    let state = createRepairWorkshopState(10);
    for (let i = 0; i < 6; i += 1) state = awardRepairWorkshopXp(state, 500, true, 20 + i);
    expect(state.level).toBeGreaterThan(1);
    expect(state.unlockedSkins).toContain("midnight");
    expect(state.unlockedModules).toContain("advanced");
  });
});
