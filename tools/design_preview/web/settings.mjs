import { FONT_OPTIONS } from "./typography.mjs";

export const STORAGE_KEY = "la-machina.landscape-studio.v1";
export const SCENES = [
  ["olive-plains", "Andalusian Olive Plains"],
  ["windmills", "Windmill Country"],
  ["grain-tower", "The Old Grain Tower"],
  ["aqueduct", "A Ruined Aqueduct"],
  ["moorish-palace", "A Distant Moorish Palace"],
  ["andorran-valley", "An Andorran Valley"],
  ["rose-windmills", "Rose & Graphite Windmills"],
  ["celadon-circuitry", "Celadon Circuitry"],
  ["lilac-automata", "Lilac Automata"],
  ["clockwork-windmills", "Clockwork Windmills"],
  ["circuit-orchard", "The Circuit Orchard"],
  ["brass-aqueduct", "The Brass Aqueduct"],
];
export const OPTIONS = {
  replyLayout: [["buttons", "Original Buttons"], ["composer", "Open Composer"], ["inline", "Inline Original Link"], ["tabs", "Reply Tabs"], ["reading", "Reading First"], ["suggestions", "Suggested Directions"], ["attached", "Attached to Messages"]],
  roadmapLayout: [["vertical", "Vertical Roadmap"], ["responsive", "Responsive Roadmap"], ["sidebar", "Always-Open Context Sidebar"]],
  navbarSurface: [["soft", "Soft / Open"], ["beveled", "Beveled Bar"]],
  footerSurface: [["plain", "Compact Note"], ["beveled", "Beveled Bar"], ["text", "Text Only"]],
  messageEdges: [["natural", "Natural Edges"], ["opposed", "Defined Outer Edges"]],
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
    ["rose", "Rose & Graphite"],
    ["celadon", "Celadon & Copper"],
    ["lilac", "Lilac & Brass"],
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
    ["placeholder", "Placeholder Text-Only"],
    ["all", "Atmosphere & Figures"],
    ["atmosphere", "Clouds & Mist"],
    ["vegetation", "Vegetation"],
    ["windmill", "Windmill Sails"],
    ["traveler", "Traveler Silhouette"],
    ["brush", "Living Brushstrokes"],
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
    ["cloud", "Soft Reading Cloud"],
    ["message-clouds", "Message Clouds"],
    ["contour-clouds", "Text Contour Clouds"],
  ],
};
const positions = [["full", "Full Width"], ["left", "Left"], ["center", "Center"], ["right", "Right"]];
const alignments = [["left", "Left / Ragged Right"], ["center", "Centered"], ["right", "Right / Ragged Left"], ["justify", "Fully Justified"]];
for (const speaker of ["traveler", "companion"]) {
  OPTIONS[`${speaker}Position`] = positions;
  OPTIONS[`${speaker}Align`] = alignments;
  OPTIONS[`${speaker}Label`] = [["enclosed", "Enclosed in Message"], ["above", "Above Message"], ["hidden", "Hidden"]];
}
export const DEFAULTS = Object.freeze({
  replyLayout: "buttons",
  roadmapLayout: "vertical",
  readingBevel: .4,
  navbarBevel: 1,
  footerBevel: 1,
  controlBevel: 1,
  animationsEnabled: true,
  backgroundOpacity: 1,
  navbarSurface: "soft",
  footerSurface: "plain",
  messageEdges: "natural",
  travelerLabel: "enclosed",
  companionLabel: "enclosed",
  travelerWidth: 1,
  companionWidth: 1,
  travelerInset: 0,
  companionInset: 0,
  scene: "olive-plains",
  composition: "full",
  treatment: "natural",
  theme: "parchment",
  layout: "theater",
  schematic: "reader",
  density: "short",
  motion: "placeholder",
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
  appFont: "tektur",
  readingFont: "ibm-plex-serif",
  humanFont: "allison",
  machineFont: "tektur",
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
      veilMode: "cloud", motion: "vegetation", blur: 8, intensity: 0.25, speed: 0.65,
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
      veilMode: "contour-clouds", motion: "brush", blur: 0, intensity: 0.25, speed: 0.65,
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
      veilMode: "cloud", motion: "atmosphere", blur: 8, intensity: 0.25, speed: 0.65,
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
      veilMode: "messages", motion: "atmosphere", blur: 14, intensity: 0.35, speed: 0.65,
      readingOpacity: 0.84,
      controlOpacity: 0.72,
    },
  },
  {
    name: "Rose Reverie", detail: "Rose pencil landscape, soft reading cloud and quiet brushstrokes",
    settings: { scene: "rose-windmills", theme: "rose", composition: "full", treatment: "natural", veilMode: "cloud", motion: "brush", readingOpacity: .9, controlOpacity: .9, blur: 8, intensity: .25, speed: .5 },
  },
  {
    name: "Copper & Code", detail: "Celadon and copper landscape with separate message clouds",
    settings: { scene: "celadon-circuitry", theme: "celadon", composition: "full", treatment: "natural", veilMode: "message-clouds", motion: "brush", readingOpacity: .92, controlOpacity: .9, blur: 8, intensity: .3, speed: .5 },
  },
  {
    name: "Mechanical Dusk", detail: "Lilac and brass drawing with clouds around each line",
    settings: { scene: "lilac-automata", theme: "lilac", composition: "full", treatment: "natural", veilMode: "contour-clouds", motion: "brush", readingOpacity: .92, controlOpacity: .9, blur: 8, intensity: .25, speed: .5 },
  },
];
const RANGES = {
  readingBevel: [0, 2],
  navbarBevel: [0, 2],
  footerBevel: [0, 2],
  controlBevel: [0, 2],
  backgroundOpacity: [0, 1],
  travelerWidth: [.55, 1],
  companionWidth: [.55, 1],
  travelerInset: [0, .2],
  companionInset: [0, .2],
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
    if (["paused", "animationsEnabled"].includes(key) && typeof value[key] !== "boolean")
      throw new Error(`The preset has an invalid ${key} setting.`);
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
