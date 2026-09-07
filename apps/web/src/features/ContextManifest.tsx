import type { Manifest } from "../types";
import { Download, LockKeyhole } from "lucide-react";
import { download } from "../api";
export function ContextManifest({
  manifest,
  preview = false,
}: {
  manifest: Manifest;
  preview?: boolean;
}) {
  return (
    <section className="manifest" aria-label="Context receipt">
      <div className="receipt-title">
        <h3>{preview ? "Context preview" : "Generation receipt"}</h3>
        <button
          className="icon-button"
          aria-label="Download context manifest"
          onClick={() =>
            download(manifest, `context-${manifest.hash.slice(0, 12)}.json`)
          }
        >
          <Download size={16} />
        </button>
      </div>
      <p className="receipt-summary">
        {manifest.items.length} items ·{" "}
        {manifest.token_estimate.toLocaleString()} estimated tokens
      </p>
      <small className="fine">
        Conservative UTF-8 byte bound; provider token counts may be lower.
        Budget: {manifest.max_input_tokens.toLocaleString()}.
      </small>
      <dl className="receipt-facts">
        <dt>Provider / model</dt>
        <dd>
          {manifest.settings.provider} / {manifest.settings.model}
        </dd>
        <dt>Policy / version</dt>
        <dd>
          {manifest.policy_id} · {manifest.policy_version}
        </dd>
        <dt>Content version</dt>
        <dd>{manifest.content_version}</dd>
        <dt>SHA-256</dt>
        <dd data-testid="manifest-hash" className="hash">
          {manifest.hash}
        </dd>
      </dl>
      <details>
        <summary>Exact ordered context ({manifest.items.length})</summary>
        <ol className="manifest-items">
          {manifest.items.map((i) => (
            <li key={i.id}>
              <details>
                <summary>
                  {i.position + 1}. {i.origin} · {i.role}{" "}
                  {i.protected && <LockKeyhole size={12} />}
                  <small>
                    {i.reason} · {i.token_estimate.toLocaleString()} tokens
                  </small>
                </summary>
                <p className="fine">
                  {i.id}
                  <br />
                  {i.disclosed_at || "No historical date"}
                  <br />
                  {i.locator}
                </p>
                <pre>{i.body}</pre>
              </details>
            </li>
          ))}
        </ol>
      </details>
      <details>
        <summary>Excluded items ({manifest.exclusions.length})</summary>
        <ul className="exclusion-list">
          {manifest.exclusions.map((e, i) => (
            <li key={i}>
              <code>{e.id}</code>
              <span>{e.reason}</span>
            </li>
          ))}
        </ul>
      </details>
    </section>
  );
}
