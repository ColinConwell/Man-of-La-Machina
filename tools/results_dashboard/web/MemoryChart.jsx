import React from "react";
import { eventName, number, memoryPairs } from "./data";
export default function MemoryChart({ cases, event, seed }) {
  const rows = memoryPairs(cases, event, seed);
  const maximum = Math.max(1, ...rows.flatMap((r) => [r.full, r.compact]));
  return (
    <section className="memory-chart" aria-labelledby="memory-heading">
      <div className="section-heading">
        <div>
          <h2 id="memory-heading">Memory Comparison</h2>
          <p>Mean input bound · UTF-8 bytes plus overhead</p>
        </div>
        <span className="caption">Matched seeds · completed cases</span>
      </div>
      {rows.length ? (
        <div className="chart-rows">
          {rows.map((row) => (
            <div className="chart-row" key={row.event}>
              <div className="chart-label">
                <strong>{eventName(row.event)}</strong>
                <small>
                  {row.count} matched {row.count === 1 ? "pair" : "pairs"}
                </small>
              </div>
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
                {((1 - row.compact / row.full) * 100).toFixed(1)}% smaller
              </span>
            </div>
          ))}
        </div>
      ) : (
        <p className="empty-chart">
          {event === "april-1"
            ? "April 1 has no older history to compact at the initial boundary."
            : "No completed baseline–compact pairs are available for these event and seed filters."}
        </p>
      )}
    </section>
  );
}
