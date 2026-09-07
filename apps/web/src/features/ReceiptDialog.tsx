import { useEffect, useRef } from "react";
import { X } from "lucide-react";
import type { Manifest } from "../types";
import { ContextManifest } from "./ContextManifest";
export function ReceiptDialog({
  receipt,
  onClose,
}: {
  receipt: Manifest;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    ref.current?.showModal();
  }, []);
  return (
    <dialog
      ref={ref}
      className="receipt-dialog"
      aria-labelledby="receipt-heading"
      onCancel={onClose}
    >
      <div className="dialog-heading">
        <h2 id="receipt-heading">Generation receipt</h2>
        <button autoFocus aria-label="Close receipt" onClick={onClose}>
          <X size={20} />
        </button>
      </div>
      <ContextManifest manifest={receipt} />
      <button className="secondary" onClick={onClose}>
        Return to conversation
      </button>
    </dialog>
  );
}
