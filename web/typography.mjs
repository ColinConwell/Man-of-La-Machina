export const FONTS = [
  { id: "classic", name: "Classic Serif", label: "Classic Serif · Georgia", family: 'Georgia, "Times New Roman", serif', scale: 1, note: "The original reading face; familiar proportions and a quiet page." },
  { id: "garamond", name: "EB Garamond", label: "EB Garamond · Renaissance Book", family: '"EB Garamond", Georgia, serif', scale: 1.1, note: "A revival of sixteenth-century book type, with an open, flowing rhythm." },
  { id: "fell", name: "IM Fell English", label: "IM Fell English · Letterpress", family: '"IM Fell English", Georgia, serif', scale: 1.04, note: "Uneven, ink-like edges evoke historic Oxford printing." },
  { id: "quintessential", name: "Quintessential", label: "Quintessential · Calligraphic", family: '"Quintessential", Georgia, serif', scale: 1.08, note: "Broad-pen strokes and handwritten forms, with mostly separate letters." },
  { id: "italianno", name: "Italianno", label: "Italianno · Flowing Cursive", family: '"Italianno", cursive', scale: 1.38, note: "Connected, sweeping script. Try it on a short passage or a single speaker." },
  { id: "blackletter", name: "UnifrakturMaguntia", label: "UnifrakturMaguntia · Blackletter", family: '"UnifrakturMaguntia", Georgia, serif', scale: 1.08, note: "Dense, angular blackletter. Especially useful for titles and brief passages." },
];
export const FONT_OPTIONS = FONTS.map(({ id, label }) => [id, label]);
export function fontFor(id) {
  return FONTS.find(font => font.id === id) || FONTS[0];
}
export function readingFontStyle(id) {
  const font = fontFor(id);
  return {
    "--reading-font": font.family,
    "--font-scale": font.scale,
    "--font-tracking": id === "classic" ? "-.45px" : "0px",
    "--font-leading": id === "italianno" ? 1.55 : 1.35,
  };
}
export const TYPE_PRESETS = [
  { name: "Renaissance Book", settings: { headingFont: "garamond", readingFont: "garamond" } },
  { name: "Quill & Print", settings: { headingFont: "fell", readingFont: "quintessential" } },
  { name: "Flowing Script", settings: { headingFont: "garamond", readingFont: "italianno" } },
  { name: "Blackletter Title", settings: { headingFont: "blackletter", readingFont: "garamond" } },
];
