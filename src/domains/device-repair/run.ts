export type RepairTrack = "review" | "japan-ready";
export type DeviceKind = "handheld" | "cassette" | "radio" | "camera" | "pager";
export type RepairSkill = "meaning" | "reading" | "listening" | "sentence";
export type RepairInteraction = "drag" | "switch" | "dial" | "press" | "sequence" | "listen";

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

export interface RepairModule {
  id: string;
  title: string;
  component: string;
  interaction: RepairInteraction;
  skill: RepairSkill;
  prerequisiteIds: string[];
  wordIndex: number;
  instruction: string;
  output: string;
}

export interface DeviceRepairRun {
  schemaVersion: 2;
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
  modules: RepairModule[];
  timePenalties: number;
}

const module = (id: string, title: string, component: string, interaction: RepairInteraction, skill: RepairSkill, wordIndex: number, instruction: string, output: string, prerequisiteIds: string[] = []): RepairModule => ({ id, title, component, interaction, skill, wordIndex, instruction, output, prerequisiteIds });

const MODULES: Record<DeviceKind, RepairModule[]> = {
  cassette: [
    module("unlock", "Release cassette door", "door latch", "press", "reading", 0, "Find the matching maintenance code and release the latch.", "The cassette bay opens."),
    module("insert", "Seat the cassette", "cassette well", "drag", "meaning", 1, "Place the marked cassette into its matching guide.", "The cassette locks into the transport.", ["unlock"]),
    module("direction", "Set tape direction", "direction switch", "switch", "reading", 2, "Move the switch to the handbook's Japanese code.", "Tape direction is correct.", ["insert"]),
    module("levels", "Balance audio levels", "equalizer dial", "dial", "listening", 0, "Hear the code, then rotate the marked dial.", "The level meter steadies.", ["direction"]),
    module("transport", "Start diagnostic tape", "transport key", "sequence", "sentence", 1, "Read the short service instruction and press the codes in order.", "The reels begin turning.", ["levels"]),
    module("confirm", "Confirm playback", "test button", "press", "listening", 2, "Listen for the final Japanese confirmation, then press the matching control.", "Diagnostic tape plays clearly.", ["transport"]),
    module("head-clean", "Clean tape head", "head-cleaner", "drag", "meaning", 0, "Place the correct cleaning card on the tape head.", "Playback distortion clears.", ["confirm"]),
    module("record", "Save calibration", "record lock", "switch", "reading", 1, "Set the calibration lock to the listed code.", "Calibration is stored.", ["head-clean"]),
  ],
  handheld: [
    module("cover", "Open battery cover", "battery cover", "press", "reading", 0, "Release the cover with the matching code.", "Battery bay is accessible."),
    module("cells", "Install power cells", "battery slots", "drag", "meaning", 1, "Drag each coded cell into the matching slot.", "Power reaches the console.", ["cover"]),
    module("cart", "Insert game cartridge", "cartridge bay", "drag", "reading", 2, "Seat the cartridge bearing the handbook code.", "The cartridge clicks in.", ["cells"]),
    module("power", "Set power switch", "power slider", "switch", "listening", 0, "Hear the code and move the power slider.", "The screen wakes.", ["cart"]),
    module("pad", "Enter boot code", "D-pad", "sequence", "sentence", 1, "Read the code order and enter it on the D-pad.", "Boot check accepts the sequence.", ["power"]),
    module("start", "Run boot test", "start button", "press", "listening", 2, "Press the matching control after the spoken prompt.", "Console boot succeeds."),
  ],
  radio: [
    module("hatch", "Open cell hatch", "battery hatch", "press", "reading", 0, "Release the hatch using the matching code.", "The battery bay opens."),
    module("cells", "Install radio cells", "battery slots", "drag", "meaning", 1, "Place the labelled cells into their matching contacts.", "The radio powers up.", ["hatch"]),
    module("antenna", "Extend antenna", "antenna switch", "switch", "reading", 2, "Move the antenna control to the listed code.", "Signal strength rises.", ["cells"]),
    module("band", "Choose broadcast band", "band dial", "dial", "listening", 0, "Hear the code and tune the dial.", "A station becomes available.", ["antenna"]),
    module("preset", "Store station code", "preset buttons", "sequence", "sentence", 1, "Follow the Japanese order in the handbook.", "Station is stored.", ["band"]),
    module("confirm", "Confirm transmission", "confirm button", "press", "listening", 2, "Press the matching key after the station call.", "Broadcast is clear."),
  ],
  camera: [
    module("door", "Release film door", "film latch", "press", "reading", 0, "Find the code and release the film latch.", "Film door opens."),
    module("film", "Load film pack", "film rails", "drag", "meaning", 1, "Place the marked film pack into the matching rails.", "Film pack seats correctly.", ["door"]),
    module("focus", "Set focus ring", "focus ring", "dial", "reading", 2, "Turn the ring until it shows the handbook code.", "Viewfinder sharpens.", ["film"]),
    module("flash", "Set flash mode", "flash switch", "switch", "listening", 0, "Hear the code, then move the flash switch.", "Flash charges.", ["focus"]),
    module("exposure", "Set exposure", "exposure wheel", "sequence", "sentence", 1, "Read the order of Japanese calibration codes.", "Exposure is balanced.", ["flash"]),
    module("shutter", "Capture test frame", "shutter button", "press", "listening", 2, "Press the matching shutter prompt.", "A test photo ejects."),
  ],
  pager: [
    module("cover", "Open rear cover", "cover latch", "press", "reading", 0, "Release the coded rear latch.", "The contact panel opens."),
    module("contacts", "Install contact strip", "contact bay", "drag", "meaning", 1, "Drag the marked strip to its matching rail.", "The pager vibrates.", ["cover"]),
    module("wheel", "Set message code", "code wheel", "dial", "reading", 2, "Turn the code wheel to the Japanese label.", "A message header appears.", ["contacts"]),
    module("channel", "Set relay channel", "channel switch", "switch", "listening", 0, "Hear the code and set the relay switch.", "Incoming signal locks.", ["wheel"]),
    module("reply", "Compose reply", "keypad", "sequence", "sentence", 1, "Use the handbook's Japanese code sequence.", "Reply is queued.", ["channel"]),
    module("send", "Send acknowledgement", "send key", "press", "listening", 2, "Press the matching key after the audio cue.", "Message is delivered."),
  ],
};

export function repairModules(device: DeviceKind, advanced = false): RepairModule[] {
  return MODULES[device].slice(0, advanced ? 8 : 6);
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
  advanced?: boolean;
  now?: number;
}): DeviceRepairRun {
  if (input.knownWords.length < 3)
    throw new Error("A repair run needs three known words.");
  const now = input.now ?? Date.now();
  const device = input.device ?? pick(Object.keys(FAULTS) as DeviceKind[], input.seed);
  const faults = FAULTS[device];
  return {
    schemaVersion: 2,
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
    modules: repairModules(device, input.advanced),
    timePenalties: 0,
  };
}

export function nextFault(run: DeviceRepairRun): RepairFault | null {
  return (
    run.faults.find((fault) => !run.solvedFaultIds.includes(fault.id)) ?? null
  );
}

export function nextRepairModule(run: DeviceRepairRun): RepairModule | null {
  return run.modules.find((item) => !run.solvedFaultIds.includes(item.id)) ?? null;
}

export function canRevealNewWord(run: DeviceRepairRun) {
  return run.solvedFaultIds.length === run.modules.length;
}
export function repairScore(run: DeviceRepairRun, now = Date.now()) {
  const remaining = Math.max(0, run.deadlineAt - now);
  return Math.max(
    0,
    Math.round(500 + (remaining / 1000) * 2 - run.hintsUsed * 75 - run.timePenalties * 30),
  );
}
