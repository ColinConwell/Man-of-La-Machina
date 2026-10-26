import { FONT_OPTIONS } from "./typography.mjs";

export const STORAGE_KEY = "la-machina.landscape-studio.v1";
export const SCENES = [
  ["olive-plains", "Andalusian Olive Plains"],
  ["windmills", "Windmill Country"],
  ["grain-tower", "The Old Grain Tower"],
  ["aqueduct", "A Ruined Aqueduct"],
  ["moorish-palace", "A Distant Moorish Palace"],
  ["andorran-valley", "An Andorran Valley"],
];
export const OPTIONS = {
  appFont: FONT_OPTIONS,
  readingFont: FONT_OPTIONS,
  humanFont: [["inherit", "Use Reading Font"], ...FONT_OPTIONS],
  machineFont: [["inherit", "Use Reading Font"], ...FONT_OPTIONS],
  scene: SCENES,
  composition: [
    ["margins", "Illustrated Margins"],
    ["horizon", "Continuous Horizon"],
    ["full", "Full Landscape"],
  ],
  treatment: [
    ["natural", "Natural Color"],
    ["sepia", "Deep Sepia Wash"],
    ["grayscale", "Monochrome Wash"],
    ["ink-sepia", "Sepia Ink & Hatching"],
    ["graphite", "Graphite & Hatching"],
  ],
  theme: [
    ["parchment", "Parchment & Rust"],
    ["sage", "Linen & Sage"],
    ["moonlight", "Moonlight & Copper"],
  ],
  layout: [
    ["conversation", "Conversation"],
    ["folio", "Reading Folio"],
    ["theater", "Open Stage"],
  ],
  schematic: [
    ["reader", "Reading"],
    ["branching", "Branching"],
    ["comparison", "Comparison"],
    ["events", "Events"],
    ["editorial", "Editorial"],
    ["onboarding", "First Visit"],
  ],
  density: [
    ["short", "Short Passages"],
    ["long", "Long Passages"],
    ["none", "Landscape Only"],
  ],
  motion: [
    ["all", "Atmosphere & Figures"],
    ["atmosphere", "Clouds & Mist"],
    ["vegetation", "Vegetation"],
    ["windmill", "Windmill Sails"],
    ["traveler", "Traveler Silhouette"],
    ["none", "Still Landscape"],
  ],
  viewport: [
    ["desktop", "Responsive Desktop"],
    ["mobile", "Mobile · 390 px"],
  ],
  veilMode: [
    ["column", "Soft Reading Column"],
    ["window", "Fit Window Automatically"],
    ["messages", "Beveled Message Boxes"],
    ["contours", "Follow Text Contours"],
  ],
};
const positions = [["full", "Full Width"], ["left", "Left"], ["center", "Center"], ["right", "Right"]];
const alignments = [["left", "Left / Ragged Right"], ["center", "Centered"], ["right", "Right / Ragged Left"], ["justify", "Fully Justified"]];
for (const speaker of ["traveler", "companion"]) {
  OPTIONS[`${speaker}Position`] = positions;
  OPTIONS[`${speaker}Align`] = alignments;
}
export const DEFAULTS = Object.freeze({
  scene: "olive-plains",
  composition: "full",
  treatment: "natural",
  theme: "parchment",
  layout: "theater",
  schematic: "reader",
  density: "short",
  motion: "atmosphere",
  viewport: "desktop",
  readingOpacity: 0.84,
  controlOpacity: 0.82,
  blur: 14,
  intensity: 0.35,
  speed: 0.65,
  paused: false,
  veilMode: "column",
  veilPadding: 20,
  messageWidth: 0.88,
  travelerPosition: "full",
  travelerAlign: "left",
  companionPosition: "full",
  companionAlign: "left",
  appFont: "classic",
  readingFont: "classic",
  humanFont: "inherit",
  machineFont: "inherit",
  textScale: 1,
  lineHeight: 1.6,
});
export const PRESETS = [
  {
    name: "Natural Margins",
    detail: "A landscape at the edges",
    settings: {
      composition: "margins",
      treatment: "natural",
      readingOpacity: 0.98,
      controlOpacity: 1,
    },
  },
  {
    name: "Sepia Sketch",
    detail: "An illustrated manuscript",
    settings: {
      composition: "margins",
      treatment: "ink-sepia",
      readingOpacity: 0.96,
      controlOpacity: 1,
    },
  },
  {
    name: "Continuous Horizon",
    detail: "One uninterrupted landscape",
    settings: {
      composition: "horizon",
      treatment: "natural",
      readingOpacity: 0.84,
      controlOpacity: 1,
    },
  },
  {
    name: "Liquid Landscape",
    detail: "Scenery beneath the controls",
    settings: {
      composition: "full",
      treatment: "natural",
      readingOpacity: 0.84,
      controlOpacity: 0.72,
    },
  },
];
const RANGES = {
  readingOpacity: [0, 1],
  controlOpacity: [0, 1],
  blur: [0, 30],
  intensity: [0, 1],
  speed: [0.25, 2],
  veilPadding: [8, 40],
  messageWidth: [0.55, 1],
  textScale: [0.85, 1.35],
  lineHeight: [1.35, 2.1],
};
export function validateSettings(value) {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("Choose a Landscape Studio preset JSON file.");
  // Migrate earlier exports and browser settings without discarding their choices.
  value = { ...value };
  for (const [oldKey, newKey] of [["headingFont", "appFont"], ["travelerFont", "humanFont"], ["companionFont", "machineFont"]]) {
    if (!(newKey in value) && oldKey in value) value[newKey] = value[oldKey];
  }
  const result = { ...DEFAULTS };
  for (const key of Object.keys(DEFAULTS)) {
    if (!(key in value)) continue;
    if (OPTIONS[key] && !OPTIONS[key].some(([id]) => id === value[key]))
      throw new Error(`The preset has an unsupported ${key}.`);
    if (
      RANGES[key] &&
      (typeof value[key] !== "number" ||
        !Number.isFinite(value[key]) ||
        value[key] < RANGES[key][0] ||
        value[key] > RANGES[key][1])
    )
      throw new Error(`The preset has an invalid ${key}.`);
    if (key === "paused" && typeof value[key] !== "boolean")
      throw new Error("The preset has an invalid pause setting.");
    result[key] = value[key];
  }
  return result;
}
export function parsePreset(text) {
  const parsed = JSON.parse(text);
  if (!parsed || typeof parsed !== "object" || parsed.schemaVersion !== 1)
    throw new Error(
      "This preset version is not supported. Choose a version 1 Landscape Studio export.",
    );
  return validateSettings(parsed.settings);
}
export function loadSettings() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? parsePreset(saved) : { ...DEFAULTS };
  } catch {
    return { ...DEFAULTS };
  }
}
export function serializePreset(settings) {
  return JSON.stringify(
    { schemaVersion: 1, settings: validateSettings(settings) },
    null,
    2,
  );
}
