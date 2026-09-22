export const eventNames = {
  "april-1": "April 1",
  "may-8": "May 8",
  "may-10": "May 10",
  "april-1-to-may-8": "April 1 → May 8",
  "may-8-to-may-10": "May 8 → May 10",
  "april-1-to-may-10": "April 1 → May 10",
};
export const conditionNames = {
  "single-dialogue-fixed": "One Author · Fixed Dialogue",
  "single-dialogue-adaptive": "One Author · Adaptive Dialogue",
  "two-dialogue-fixed": "Two Agents · Fixed Dialogue",
  "two-dialogue-adaptive": "Two Agents · Adaptive Dialogue",
  "single-annotated-adaptive": "One Author · Annotations",
  "two-annotated-adaptive": "Two Agents · Annotations",
  "single-timeline-adaptive": "One Author · Timeline",
  "two-timeline-adaptive": "Two Agents · Timeline",
  "single-dialogue-state-first": "One Author · State First",
  "two-dialogue-state-first": "Two Agents · State First",
  "single-dialogue-compact": "One Author · Compact Context",
  "two-dialogue-anthropic": "Two Agents · Anthropic Companion",
  baseline: "Baseline",
  "memory-compact": "Compact History",
  "memory-rolling": "Rolling Memory",
  "persona-minimal": "Minimal Persona",
  "persona-retrospective": "Retrospective Persona",
  "forward-static": "Static Future",
  "forward-dynamic": "Dynamic Future",
  "forward-adapted": "Adapted Future",
  "companion-anthropic": "Anthropic Companion",
  "traveler-anthropic": "Anthropic Traveler",
  "companion-gemini": "Gemini Companion",
  "traveler-gemini": "Gemini Traveler",
  "endpoint-upfront": "Endpoint Upfront",
  "endpoint-backward": "Backward Waypoints",
  "endpoint-delayed": "Midpoint Reveal",
  "endpoint-companion-only": "Companion-Only Endpoint",
  "path-companion-anthropic": "Anthropic Companion",
  "path-traveler-gemini": "Gemini Traveler",
};
export const title = (value = "") =>
  value.replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
export const eventName = (value) => eventNames[value] || title(value);
export const conditionName = (value) => conditionNames[value] || title(value);
export const number = (value) =>
  Number.isFinite(value) ? Math.round(value).toLocaleString("en-US") : "—";
export const caseURL = (run, id) =>
  `/api/runs/${encodeURIComponent(run)}/cases/${encodeURIComponent(id)}`;
export async function getJSON(url, signal) {
  const response = await fetch(url, { signal });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.detail || `Request failed (${response.status})`);
  }
  return response.json();
}
export function memoryPairs(cases, event, seed) {
  const selected = cases.filter(
    (c) =>
      c.status === "completed" &&
      (!event || c.event === event) &&
      (!seed || c.seed === seed),
  );
  const rows = [];
  for (const id of [...new Set(selected.map((c) => c.event))]) {
    if (id === "april-1") continue;
    const baseline = selected.filter(
      (c) => c.event === id && c.condition === "baseline",
    );
    const pairs = baseline
      .map((full) => ({
        full,
        compact: selected.find(
          (c) =>
            c.event === id &&
            c.condition === "memory-compact" &&
            c.seed === full.seed &&
            c.repetition === full.repetition,
        ),
      }))
      .filter(
        (p) =>
          p.compact &&
          Number.isFinite(p.full.metrics.mean_dialogue_input_bound) &&
          Number.isFinite(p.compact.metrics.mean_dialogue_input_bound),
      );
    if (pairs.length)
      rows.push({
        event: id,
        count: pairs.length,
        full:
          pairs.reduce(
            (s, p) => s + p.full.metrics.mean_dialogue_input_bound,
            0,
          ) / pairs.length,
        compact:
          pairs.reduce(
            (s, p) => s + p.compact.metrics.mean_dialogue_input_bound,
            0,
          ) / pairs.length,
      });
  }
  return rows;
}

export function comparisonCondition(row, kind) {
  if (kind === "script-path") {
    return row?.settings?.architecture === "two-agent"
      ? "two-dialogue-adaptive"
      : "single-dialogue-adaptive";
  }
  return row?.path ? "endpoint-upfront" : "baseline";
}
