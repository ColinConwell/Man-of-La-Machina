import { useEffect, useRef, useState } from "react";
import { api, post, download, ApiError } from "./api";
import { useExperience } from "./store";
import type { Branch, BranchMessage, Manifest } from "./types";
export function useBranch() {
  const state = useExperience();
  const [branch, setBranch] = useState<Branch | null>(null);
  const [preview, setPreview] = useState<Manifest | null>(null);
  const [receipt, setReceipt] = useState<Manifest | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [streamText, setStreamText] = useState("");
  const [pendingText, setPendingText] = useState("");
  const eventSource = useRef<EventSource | null>(null);
  const epoch = useRef(0);
  const pendingBranch = useRef<Promise<Branch> | null>(null);
  useEffect(() => {
    setPreview(null);
  }, [state.options, state.settings, state.text]);
  useEffect(() => () => eventSource.current?.close(), []);
  async function ensure() {
    const s = useExperience.getState();
    if (branch && branch.id === s.branchId) return branch;
    if (pendingBranch.current) return pendingBranch.current;
    const current = epoch.current;
    const promise = post<Branch>("/branches", {
      entry_message_id: s.entry,
      context_mode: s.options.context_mode,
    })
      .then((b) => {
        if (current !== epoch.current) {
          void api("/branches/" + b.id, { method: "DELETE" });
          throw new Error(
            "Selection changed. Try again at the current cutoff.",
          );
        }
        setBranch(b);
        s.setBranch(b.id);
        return b;
      })
      .finally(() => {
        pendingBranch.current = null;
      });
    pendingBranch.current = promise;
    return promise;
  }
  async function previewContext() {
    setError("");
    setBusy(true);
    const current = epoch.current;
    try {
      const b = await ensure();
      const s = useExperience.getState();
      const m = await post<Manifest>(`/branches/${b.id}/context/preview`, {
        text: s.text,
        options: s.options,
        settings: s.settings,
      });
      if (current === epoch.current) setPreview(m);
    } catch (e) {
      if (current === epoch.current) setError((e as Error).message);
    } finally {
      if (current === epoch.current) setBusy(false);
    }
  }
  async function submit() {
    const s = useExperience.getState();
    if (!s.text.trim() || busy) return;
    const current = epoch.current;
    setBusy(true);
    setError("");
    setStreamText("");
    setPendingText(s.text);
    s.setTab("branch");
    try {
      const b = await ensure();
      const run = await post<{
        generation_id: string;
        manifest_id: string;
        stream_url: string;
      }>(`/branches/${b.id}/messages`, {
        text: s.text,
        options: s.options,
        settings: s.settings,
        request_id: crypto.randomUUID(),
      });
      if (current !== epoch.current) return;
      const events = new EventSource(run.stream_url);
      eventSource.current = events;
      events.addEventListener("delta", (e) => {
        if (current === epoch.current)
          setStreamText((t) => t + JSON.parse((e as MessageEvent).data).text);
      });
      events.addEventListener("done", async () => {
        events.close();
        if (current !== epoch.current) return;
        try {
          const updated = await api<Branch>("/branches/" + b.id);
          if (current !== epoch.current) return;
          setBranch(updated);
          s.setText("");
          setPendingText("");
          setStreamText("");
        } catch (e) {
          setError((e as Error).message);
        } finally {
          setBusy(false);
        }
      });
      events.addEventListener("failure", (e) => {
        events.close();
        if (current !== epoch.current) return;
        setError(JSON.parse((e as MessageEvent).data).message);
        setBusy(false);
      });
      events.onerror = () => {
        events.close();
        if (current !== epoch.current) return;
        setError(
          "The stream connection was interrupted. Reopen the branch to check its result, or restart.",
        );
        setBusy(false);
      };
    } catch (e) {
      if (current === epoch.current) {
        setError((e as Error).message);
        setBusy(false);
      }
    }
  }
  async function reset() {
    epoch.current++;
    eventSource.current?.close();
    const id = useExperience.getState().branchId;
    setBusy(false);
    setPreview(null);
    setReceipt(null);
    setStreamText("");
    setPendingText("");
    setBranch(null);
    useExperience.getState().setBranch(null);
    setError("");
    if (id)
      try {
        await api("/branches/" + id, { method: "DELETE" });
      } catch (e) {
        if (e instanceof ApiError && e.status === 404) return;
        setError("Could not confirm deletion: " + (e as Error).message);
        throw e;
      }
  }
  async function exportBranch() {
    if (!branch) return;
    try {
      download(
        await api("/branches/" + branch.id + "/export"),
        "la-machina-branch.json",
      );
    } catch (e) {
      setError((e as Error).message);
    }
  }
  async function inspect(message: BranchMessage) {
    if (!branch) return;
    try {
      const data = await api<{
        generations: { id: string; manifest: Manifest }[];
      }>(`/branches/${branch.id}/export`);
      const m = data.generations.find(
        (g) => g.id === message.generation_id,
      )?.manifest;
      if (m) setReceipt(m);
    } catch (e) {
      setError((e as Error).message);
    }
  }
  async function refresh() {
    if (!branch) return;
    try {
      setBranch(await api<Branch>("/branches/" + branch.id));
      setStreamText("");
      setPendingText("");
      setError("");
    } catch (e) {
      setError((e as Error).message);
    }
  }
  return {
    branch,
    preview,
    receipt,
    setReceipt,
    busy,
    error,
    setError,
    streamText,
    pendingText,
    previewContext,
    submit,
    reset,
    exportBranch,
    inspect,
    refresh,
  };
}
