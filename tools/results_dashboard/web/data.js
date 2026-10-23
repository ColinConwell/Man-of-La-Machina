export const eventNames = {
  "april-1": "April 1",
  "may-8": "May 8",
  "may-10": "May 10",
  "april-1-to-may-8": "April 1 → May 8",
  "may-8-to-may-10": "May 8 → May 10",
  "april-1-to-may-10": "April 1 → May 10",
};
export const conditionNames = {
  "single-dialogue-fixed": "One author · fixed length",
  "single-dialogue-adaptive": "One author · adaptive",
  "two-dialogue-fixed": "Two agents · fixed length",
  "two-dialogue-adaptive": "Two agents · adaptive",
  "single-annotated-adaptive": "One author · annotations",
  "two-annotated-adaptive": "Two agents · annotations",
  "single-timeline-adaptive": "One author · timeline",
  "two-timeline-adaptive": "Two agents · timeline",
  "single-dialogue-state-first": "One author · state first",
  "two-dialogue-state-first": "Two agents · state first",
  "single-dialogue-compact": "One author · compact",
  "two-dialogue-anthropic": "Two agents · Claude companion",
  baseline: "Baseline",
  "memory-compact": "Compact history",
  "memory-rolling": "Rolling memory",
  "persona-minimal": "Minimal persona",
  "persona-retrospective": "Retrospective persona",
  "forward-static": "Static future",
  "forward-dynamic": "Dynamic future",
  "forward-adapted": "Adapted future",
  "companion-anthropic": "Claude companion",
  "traveler-anthropic": "Claude Traveler",
  "companion-gemini": "Gemini companion",
  "traveler-gemini": "Gemini Traveler",
  "endpoint-upfront": "Endpoint upfront",
  "endpoint-backward": "Backward plan",
  "endpoint-delayed": "Endpoint at midpoint",
  "endpoint-companion-only": "Endpoint to companion only",
  "path-companion-anthropic": "Claude companion",
  "path-traveler-gemini": "Gemini Traveler",
};
// Sentence case: "model-handoff" -> "Model handoff".
export const title = (value = "") => {
  const text = String(value).replace(/[-_]/g, " ");
  return text.charAt(0).toUpperCase() + text.slice(1);
};
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
