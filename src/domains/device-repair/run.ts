export type RepairTrack = "review" | "japan-ready";
export type DeviceKind = "handheld" | "cassette" | "radio" | "camera" | "pager";
export type RepairSkill = "meaning" | "reading" | "listening" | "sentence";

export interface RepairWord {
  id: string;
  word: string;
  reading: string;
  meaning: string;
  wordAudio?: string;
}

export interface RepairFault {
  id: string;
  title: string;
  subsystem: string;
  skill: RepairSkill;
  instruction: string;
  output: string;
}

export interface DeviceRepairRun {
  schemaVersion: 1;
  id: string;
  seed: number;
  track: RepairTrack;
  device: DeviceKind;
  startedAt: number;
  deadlineAt: number;
  faults: RepairFault[];
  knownWords: RepairWord[];
  newWord: RepairWord;
  solvedFaultIds: string[];
  revealedNewWord: boolean;
  completed: boolean;
  hintsUsed: number;
  interactionValues: number[];
  diagnosticStep: number;
  /** Changeable repair labels let a real component practise any introduced word. */
  serviceTags: ServiceTag[];
}

export type RepairComponent =
  | "cassette-door"
  | "play-button"
  | "volume-dial";

export interface ServiceTag {
  component: RepairComponent;
  wordId: string;
  word: string;
  reading: string;
  meaning: string;
}

export function createServiceTags(words: readonly RepairWord[]): ServiceTag[] {
  return words.slice(0, 3).map((word, index) => ({
    component: (["cassette-door", "play-button", "volume-dial"] as const)[index]!,
    wordId: word.id,
    word: word.word,
    reading: word.reading,
    meaning: word.meaning,
  }));
}

export const DEVICE_LABELS: Record<DeviceKind, string> = {
  handheld: "Handheld console",
  cassette: "Cassette player",
  radio: "Pocket radio",
  camera: "Instant camera",
  pager: "Pager",
};

const FAULTS: Record<DeviceKind, RepairFault[]> = {
  handheld: [
    {
      id: "battery",
      title: "Battery polarity",
      subsystem: "battery bay",
      skill: "reading",
      instruction:
        "Use the manual’s Japanese reading order to orient both batteries.",
      output: "Power reaches the console.",
    },
    {
      id: "cartridge",
      title: "Cartridge match",
      subsystem: "cartridge slot",
      skill: "meaning",
      instruction:
        "Choose the cartridge whose Japanese label matches the repair card.",
      output: "The game cartridge clicks into place.",
    },
    {
      id: "controls",
      title: "Control calibration",
      subsystem: "volume and buttons",
      skill: "listening",
      instruction:
        "Listen to the boot tone, then set the slider and press the matching control.",
      output: "The boot screen unlocks.",
    },
  ],
  cassette: [
    {
      id: "spool",
      title: "Tape direction",
      subsystem: "cassette well",
      skill: "reading",
      instruction:
        "Match the Japanese label order to the tape’s two spool markers.",
      output: "The tape seats correctly.",
    },
    {
      id: "contacts",
      title: "Contact repair",
      subsystem: "power contacts",
      skill: "meaning",
      instruction:
        "Select the Japanese-labelled contact that completes the circuit.",
      output: "The transport motor wakes.",
    },
    {
      id: "equalizer",
      title: "Audio calibration",
      subsystem: "equalizer",
      skill: "listening",
      instruction: "Use the spoken clue to set the three audio sliders.",
      output: "The recording plays clearly.",
    },
  ],
  radio: [
    {
      id: "cell",
      title: "Cell orientation",
      subsystem: "battery compartment",
      skill: "reading",
      instruction:
        "Place the Japanese-labelled cells in the order shown by the manual.",
      output: "The dial lights up.",
    },
    {
      id: "antenna",
      title: "Antenna switch",
      subsystem: "antenna",
      skill: "meaning",
      instruction:
        "Choose the antenna position named by the Japanese service note.",
      output: "A signal appears.",
    },
    {
      id: "tuner",
      title: "Station tuning",
      subsystem: "frequency dial",
      skill: "listening",
      instruction: "Hear the station ident and tune to its matching mark.",
      output: "The broadcast becomes clear.",
    },
  ],
  camera: [
    {
      id: "film",
      title: "Film alignment",
      subsystem: "film door",
      skill: "reading",
      instruction:
        "Align the film markers in the Japanese order printed in the guide.",
      output: "Film advances.",
    },
    {
      id: "focus",
      title: "Focus wheel",
      subsystem: "lens",
      skill: "meaning",
      instruction:
        "Set the focus symbol that matches the Japanese repair label.",
      output: "The viewfinder clears.",
    },
    {
      id: "flash",
      title: "Flash timing",
      subsystem: "flash control",
      skill: "listening",
      instruction: "Use the spoken cue to choose the correct flash sequence.",
      output: "The shutter is ready.",
    },
  ],
  pager: [
    {
      id: "contacts",
      title: "Contact order",
      subsystem: "battery contacts",
      skill: "reading",
      instruction: "Put the contact strips in the Japanese reading order.",
      output: "The pager vibrates.",
    },
    {
      id: "codewheel",
      title: "Code wheel",
      subsystem: "code wheel",
      skill: "meaning",
      instruction:
        "Turn the wheel to the Japanese word named in the service slip.",
      output: "A message header appears.",
    },
    {
      id: "acknowledge",
      title: "Message relay",
      subsystem: "reply buttons",
      skill: "listening",
      instruction:
        "Listen to the message and press its Japanese reply in order.",
      output: "The message is received.",
    },
  ],
};

function pick<T>(items: readonly T[], seed: number): T {
  return items[seed % items.length]!;
}

export function createRepairRun(input: {
  seed: number;
  track: RepairTrack;
  knownWords: RepairWord[];
  newWord: RepairWord;
  device?: DeviceKind;
  now?: number;
}): DeviceRepairRun {
  if (input.knownWords.length < 3)
    throw new Error("A repair run needs three known words.");
  const now = input.now ?? Date.now();
  const device = input.device ?? pick(Object.keys(FAULTS) as DeviceKind[], input.seed);
  const faults = FAULTS[device];
  return {
    schemaVersion: 1,
    id: `repair-${input.seed.toString(36)}-${now.toString(36)}`,
    seed: input.seed,
    track: input.track,
    device,
    startedAt: now,
    deadlineAt: now + 10 * 60_000,
    faults,
    knownWords: input.knownWords.slice(0, 3),
    newWord: input.newWord,
    solvedFaultIds: [],
    revealedNewWord: false,
    completed: false,
    hintsUsed: 0,
    interactionValues: [0, 0, 0, 0, 0, 0],
    diagnosticStep: 0,
    serviceTags: createServiceTags(input.knownWords),
  };
}

export function nextFault(run: DeviceRepairRun): RepairFault | null {
  return (
    run.faults.find((fault) => !run.solvedFaultIds.includes(fault.id)) ?? null
  );
}

export function canRevealNewWord(run: DeviceRepairRun) {
  return run.solvedFaultIds.length === run.faults.length;
}
export function repairScore(run: DeviceRepairRun, now = Date.now()) {
  const remaining = Math.max(0, run.deadlineAt - now);
  return Math.max(
    0,
    Math.round(500 + (remaining / 1000) * 2 - run.hintsUsed * 75),
  );
}
