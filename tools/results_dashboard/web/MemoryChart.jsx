import React from "react";
import { eventName, number, memoryPairs } from "./data";

// Matched full/compact pairs by event, shown on demand from the filter row.
export default function MemoryChart({ cases, event, seed }) {
  const rows = memoryPairs(cases, event, seed);
  if (!rows.length) return null;
  const maximum = Math.max(1, ...rows.flatMap((r) => [r.full, r.compact]));
  return (
    <details className="memory-chart">
      <summary>Full vs. compact history</summary>
      <div className="chart-rows" aria-label="Mean input per dialogue request, in bytes">
        {rows.map((row) => (
          <div className="chart-row" key={row.event}>
            <strong className="chart-label" title={`${row.count} matched pairs`}>
              {eventName(row.event)}
            </strong>
            <div className="bar-pair">
              {["full", "compact"].map((kind) => (
                <div className="bar-line" key={kind}>
                  <span>{kind === "full" ? "Full" : "Compact"}</span>
                  <div className="bar-track">
                    <div
                      className={`bar ${kind}`}
                      style={{ width: `${(row[kind] / maximum) * 100}%` }}
                    />
                  </div>
                  <span className="bar-value">{number(row[kind])}</span>
                </div>
              ))}
            </div>
            <span className="reduction">
              −{((1 - row.compact / row.full) * 100).toFixed(0)}%
            </span>
          </div>
        ))}
        <p className="caption">Mean bytes per dialogue request, matched completed pairs.</p>
      </div>
    </details>
  );
}
