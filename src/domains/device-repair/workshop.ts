export type RepairSkin = "bench" | "midnight" | "sakura";
export type RepairModuleUnlock = "standard" | "advanced" | "master";

export interface RepairWorkshopState {
  schemaVersion: 1;
  xp: number;
  level: number;
  selectedSkin: RepairSkin;
  unlockedSkins: RepairSkin[];
  unlockedModules: RepairModuleUnlock[];
  soundPack: "mechanical" | "arcade";
  updatedAt: number;
}

export function createRepairWorkshopState(now = Date.now()): RepairWorkshopState {
  return {
    schemaVersion: 1,
    xp: 0,
    level: 1,
    selectedSkin: "bench",
    unlockedSkins: ["bench"],
    unlockedModules: ["standard"],
    soundPack: "mechanical",
    updatedAt: now,
  };
}

export function repairWorkshopLevel(xp: number) {
  return Math.min(10, Math.max(1, Math.floor(Math.max(0, xp) / 500) + 1));
}

export function awardRepairWorkshopXp(state: RepairWorkshopState, score: number, completed: boolean, now = Date.now()) {
  const xp = Math.max(0, Math.round((completed ? 100 : 25) + Math.min(500, Math.max(0, score)) / 5));
  const total = state.xp + xp;
  const level = repairWorkshopLevel(total);
  const unlockedSkins = [...state.unlockedSkins];
  if (level >= 2 && !unlockedSkins.includes("midnight")) unlockedSkins.push("midnight");
  if (level >= 4 && !unlockedSkins.includes("sakura")) unlockedSkins.push("sakura");
  const unlockedModules = [...state.unlockedModules];
  if (level >= 3 && !unlockedModules.includes("advanced")) unlockedModules.push("advanced");
  if (level >= 7 && !unlockedModules.includes("master")) unlockedModules.push("master");
  return { ...state, xp: total, level, unlockedSkins, unlockedModules, updatedAt: now, awardedXp: xp };
}
