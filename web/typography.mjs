const face = (id, name, group, scale, note, weight = 400, fallback = 'Georgia, serif') => ({
  id, name, label: name, group, scale, note, weight,
  family: `"${name}", ${fallback}`,
});
export const FONTS = [
  { id: "classic", name: "Classic Serif", label: "Classic Serif · Georgia", family: 'Georgia, "Times New Roman", serif', group: "Classic", scale: 1, weight: 400, note: "The original reading face; familiar proportions and a quiet page." },
  face("uncial", "Uncial Antiqua", "Historical", 1.02, "Rounded uncial letterforms for a manuscript-like page."),
  face("tapestry", "Tapestry", "Historical", 1.06, "An expressive, textured hand for titles and dialogue."),
  face("blackletter", "UnifrakturMaguntia", "Historical", 1.08, "Angular blackletter; especially useful for titles and brief passages."),
  face("garamond", "EB Garamond", "Historical", 1.1, "A revival of sixteenth-century book type, with an open, flowing rhythm."),
  face("fell", "IM Fell English", "Historical", 1.04, "Uneven, ink-like edges evoke historic Oxford printing."),
  face("lovers-quarrel", "Lovers Quarrel", "Literary", 1.5, "Sweeping, connected strokes for intimate correspondence."),
  face("monte-carlo", "MonteCarlo", "Literary", 1.35, "A flowing hand for an exchange of letters."),
  face("mea-culpa", "Mea Culpa", "Literary", 1.4, "Flourished capitals and connected cursive strokes."),
  face("monsieur", "Monsieur La Doulaise", "Literary", 1.5, "Fine, elaborate flourishes; allow extra space between lines."),
  face("ruthie", "Ruthie", "Literary", 1.4, "A decorative hand with generous capital flourishes."),
  face("allison", "Allison", "Literary", 1.4, "Loose, fluid handwriting for a personal voice."),
  face("birthstone", "Birthstone", "Literary", 1.3, "A lively handwritten rhythm with broad, curving strokes."),
  face("ballet", "Ballet", "Literary", 1.35, "Ornate calligraphy with extended strokes; try wider line spacing."),
  face("updock", "Updock", "Literary", 1.4, "Slender cursive with a flowing handwritten rhythm."),
  face("rouge-script", "Rouge Script", "Literary", 1.35, "Rounded connected script for letter-like dialogue."),
  face("quintessential", "Quintessential", "Literary", 1.08, "Broad-pen strokes and mostly separate handwritten forms."),
  face("italianno", "Italianno", "Literary", 1.38, "Connected, sweeping script. Try it on a short passage or one speaker."),
  face("ibm-plex-serif", "IBM Plex Serif", "Machine", 1, "Structured serif forms for a measured machine voice."),
  face("tektur", "Tektur", "Machine", 1, "Squared, geometric lettering for a technological tone.", 400, 'Arial, sans-serif'),
  face("anta", "Anta", "Machine", 1, "Geometric forms with an engineered feel.", 400, 'Arial, sans-serif'),
  face("tomorrow", "Tomorrow", "Machine", 1, "Angular sans-serif forms for a precise voice.", 400, 'Arial, sans-serif'),
  face("syne-mono", "Syne Mono", "Machine", 1, "Monospaced characters with an irregular, mechanical rhythm.", 400, 'monospace'),
  face("oxanium", "Oxanium", "Machine", 1, "Squared forms for a digital or robotic voice.", 400, 'Arial, sans-serif'),
  face("noto-serif", "Noto Serif", "Machine", 1, "Light serif strokes, served at weight 300.", 300),
];
export const FONT_GROUPS = ["Historical", "Literary", "Machine", "Classic"];
export const FONT_OPTIONS = FONTS.map(({ id, label }) => [id, id === "noto-serif" ? `${label} · Light 300` : label]);
export function fontFor(id) {
  return FONTS.find(font => font.id === id) || FONTS[0];
}
export function readingFontStyle(id) {
  const font = fontFor(id);
  return {
    "--reading-font": font.family,
    "--reading-weight": font.weight,
    "--font-scale": font.scale,
    "--font-tracking": id === "classic" ? "-.45px" : "0px",
  };
}
const typeSet = (name, detail, appFont, readingFont, humanFont = "inherit", machineFont = "inherit", textScale = 1, lineHeight = 1.6) => ({
  name, detail, settings: { appFont, readingFont, humanFont, machineFont, textScale, lineHeight },
});
export const TYPE_PRESETS = [
  typeSet("Quixotic Chronicle", "Tapestry & Uncial Antiqua", "tapestry", "uncial", "inherit", "inherit", 1, 1.7),
  typeSet("Letters & Logic", "MonteCarlo · Syne Mono", "ibm-plex-serif", "noto-serif", "monte-carlo", "syne-mono", 1.05, 1.7),
  typeSet("Courtly Correspondence", "Mea Culpa · Monsieur La Doulaise", "tapestry", "birthstone", "mea-culpa", "monsieur", 1.05, 1.8),
  typeSet("Human & Automaton", "Lovers Quarrel · Oxanium", "tektur", "ibm-plex-serif", "lovers-quarrel", "oxanium", 1, 1.75),
  typeSet("Flourished Letters", "Ballet · Ruthie", "fell", "rouge-script", "ballet", "ruthie", 1.1, 1.85),
  typeSet("Light & Mechanical", "Allison · Tomorrow", "anta", "noto-serif", "allison", "tomorrow", 1.05, 1.75),
  typeSet("Renaissance Book", "EB Garamond throughout", "garamond", "garamond"),
  typeSet("Quill & Print", "IM Fell English & Quintessential", "fell", "quintessential"),
  typeSet("Flowing Script", "EB Garamond & Italianno", "garamond", "italianno", "inherit", "inherit", 1, 1.7),
  typeSet("Blackletter Title", "UnifrakturMaguntia & EB Garamond", "blackletter", "garamond"),
];
