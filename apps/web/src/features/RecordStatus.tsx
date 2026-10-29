import { useId } from "react";
import { CircleCheck, CircleHelp } from "lucide-react";

export function RecordStatus({
  sequence,
  reviewed,
}: {
  sequence: number;
  reviewed: boolean;
}) {
  const id = useId();
  const label = `Recorded · Turn ${sequence + 1} · ${reviewed ? "Reviewed Source" : "Unreviewed Source"}`;
  return (
    <>
      <button
        className="record-status"
        type="button"
        aria-label={`Record Status: ${label}`}
        title={label}
        popoverTarget={id}
      >
        {reviewed ? <CircleCheck size={14} /> : <CircleHelp size={14} />}
      </button>
      <div
        id={id}
        popover="auto"
        className="record-status-popover"
        role="dialog"
        aria-label="Record Status"
      >
        <strong>Recorded · Turn {sequence + 1}</strong>
        <p>{reviewed ? "Reviewed Source" : "Unreviewed Source"}</p>
        {!reviewed && <p>This source has not yet been marked as reviewed.</p>}
      </div>
    </>
  );
}
