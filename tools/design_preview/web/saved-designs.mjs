import { PRESETS, validateSettings } from "./settings.mjs";

export const SAVED_DESIGNS_KEY = "la-machina.landscape-studio.saved-designs.v1";
export const STARTING_POINT_KEY = "la-machina.landscape-studio.starting-point.v1";

export function readSavedDesigns() {
  try {
    const data = JSON.parse(localStorage.getItem(SAVED_DESIGNS_KEY) || "[]");
    if (!Array.isArray(data)) return [];
    return data.flatMap(item => {
      try {
        if (!item || typeof item.name !== "string" || !item.name.trim() || item.name.length > 80) return [];
        return [{ name: item.name, startingPoint: PRESETS.some(p => p.name === item.startingPoint) ? item.startingPoint : "Default", settings: validateSettings(item.settings) }];
      } catch { return []; }
    });
  } catch { return []; }
}

function letters(index) {
  let label = "";
  for (let n = index; n > 0; n = Math.floor((n - 1) / 26)) label = String.fromCharCode(65 + (n - 1) % 26) + label;
  return label;
}

export function quickNames(saved, startingPoint) {
  const names = new Set(saved.map(item => item.name.toLowerCase()));
  let modification = 1, version = 1;
  while (names.has(`${startingPoint} Mod ${letters(modification)}`.toLowerCase())) modification++;
  while (names.has(`default v${String(version).padStart(2, "0")}`)) version++;
  return [`${startingPoint} Mod ${letters(modification)}`, `Default v${String(version).padStart(2, "0")}`];
}

export function saveDesign(saved, name, settings, startingPoint) {
  name = name.trim();
  if (!name || name.length > 80) throw new Error("Enter a name between 1 and 80 characters.");
  if (saved.some(item => item.name.toLowerCase() === name.toLowerCase())) throw new Error("That name is already saved. Choose a new name to keep both designs.");
  const next = [...saved, { name, startingPoint, settings: validateSettings(settings) }];
  // Commit to state only after storage succeeds; never claim a failed save succeeded.
  localStorage.setItem(SAVED_DESIGNS_KEY, JSON.stringify(next));
  return next;
}
