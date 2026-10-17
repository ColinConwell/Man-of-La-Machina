import { useEffect, useRef, useState } from "react";
import { api, post, download, ApiError } from "./api";
import { useExperience } from "./store";
import type {
  Branch,
  ContextComposition,
  ContextPair,
  Manifest,
  PairWithholding,
} from "./types";
export interface PendingCondition {
  text: string;
  status: "streaming" | "completed" | "failed";
}
export interface PairStart {
  pair_id: string;
  visitor_text: string;
  conditions: {
    label: "A" | "B";
    generation_id: string;
    manifest_id: string;
    stream_url: string;
    composition: ContextComposition;
  }[];
  difference: ContextPair["difference"];
  withheld: PairWithholding;
}
export interface PendingPair {
  visitor: string;
  start: PairStart | null;
  conditions: Record<"A" | "B", PendingCondition>;
}
export function useBranch() {
  const state = useExperience();
  const [branch, setBranch] = useState<Branch | null>(null);
  const [preview, setPreview] = useState<Manifest | null>(null);
  const [previewError, setPreviewError] = useState("");
  const [previewRevision, setPreviewRevision] = useState(0);
  const [receipt, setReceipt] = useState<Manifest | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [streamText, setStreamText] = useState("");
  const [pendingText, setPendingText] = useState("");
  const [pendingPair, setPendingPair] = useState<PendingPair | null>(null);
  const eventSource = useRef<EventSource | null>(null);
  const pairSources = useRef<EventSource[]>([]);
  const epoch = useRef(0);
  const pendingBranch = useRef<Promise<Branch> | null>(null);
  useEffect(() => {
    setPreview(null);
    setPreviewError("");
    if (!state.entered || !state.entry || busy) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const activeBranch = branch?.id === state.branchId ? branch : null;
        const result = await api<Manifest>(
          activeBranch
            ? `/branches/${activeBranch.id}/context/preview`
            : "/context/preview",
          {
            method: "POST",
            signal: controller.signal,
            body: JSON.stringify({
              ...(!activeBranch ? { entry_message_id: state.entry } : {}),
              options: state.options,
              settings: state.settings,
              text: state.text,
            }),
          },
        );
        if (!controller.signal.aborted) setPreview(result);
      } catch (e) {
        if (!controller.signal.aborted) setPreviewError((e as Error).message);
      }
    }, 250);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [
    state.entered,
    state.entry,
    state.options,
    state.settings,
    state.text,
    state.branchId,
    branch,
    busy,
    previewRevision,
  ]);
  useEffect(
    () => () => {
      eventSource.current?.close();
      pairSources.current.forEach((e) => e.close());
    },
    [],
  );
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
  function previewContext() {
    if (!preview) setPreviewRevision((n) => n + 1);
  }
  async function submit() {
    const s = useExperience.getState();
    if (!s.text.trim() || busy) return;
    const current = epoch.current;
    setBusy(true);
    setError("");
    setStreamText("");
    setPendingText("Preparing your intervention…");
    s.setTab("branch");
    try {
      const b = await ensure();
      const run = await post<{
        generation_id: string;
        manifest_id: string;
        stream_url: string;
        visitor_text: string;
      }>(`/branches/${b.id}/messages`, {
        text: s.text,
        options: s.options,
        settings: s.settings,
        request_id: crypto.randomUUID(),
      });
      if (current !== epoch.current) return;
      setPendingText(run.visitor_text);
      s.setText(run.visitor_text);
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
  async function submitPair() {
    const s = useExperience.getState();
    if (!s.text.trim() || busy) return;
    const current = epoch.current;
    const blank = (): PendingCondition => ({ text: "", status: "streaming" });
    setBusy(true);
    setError("");
    setPendingPair({
      visitor: "Preparing your intervention…",
      start: null,
      conditions: { A: blank(), B: blank() },
    });
    s.setTab("branch");
    const update = (
      label: "A" | "B",
      patch: (c: PendingCondition) => PendingCondition,
    ) =>
      setPendingPair((p) =>
        p
          ? {
              ...p,
              conditions: {
                ...p.conditions,
                [label]: patch(p.conditions[label]),
              },
            }
          : p,
      );
    try {
      const b = await ensure();
      const run = await post<PairStart>(`/branches/${b.id}/pairs`, {
        text: s.text,
        options: s.options,
        settings: s.settings,
        withheld: s.pairWithheld,
        request_id: crypto.randomUUID(),
      });
      if (current !== epoch.current) return;
      setPendingPair((p) =>
        p ? { ...p, visitor: run.visitor_text, start: run } : p,
      );
      s.setText(run.visitor_text);
      let open = run.conditions.length;
      const failures: string[] = [];
      // Both conditions settle independently; the branch is reread once neither is streaming.
      const settle = async () => {
        if (--open > 0 || current !== epoch.current) return;
        try {
          const updated = await api<Branch>("/branches/" + b.id);
          if (current !== epoch.current) return;
          setBranch(updated);
          if (failures.length < run.conditions.length) s.setText("");
          setPendingPair(null);
          if (failures.length) setError(failures.join(" "));
        } catch (e) {
          setError((e as Error).message);
        } finally {
          setBusy(false);
        }
      };
      for (const c of run.conditions) {
        const events = new EventSource(c.stream_url);
        pairSources.current.push(events);
        let finished = false;
        const end = (failure?: string) => {
          events.close();
          if (finished) return;
          finished = true;
          if (failure) failures.push(`Condition ${c.label}: ${failure}`);
          if (current === epoch.current)
            update(c.label, (x) => ({
              ...x,
              status: failure ? "failed" : "completed",
            }));
          void settle();
        };
        events.addEventListener("delta", (e) => {
          if (current !== epoch.current) return;
          const text = JSON.parse((e as MessageEvent).data).text;
          update(c.label, (x) => ({ ...x, text: x.text + text }));
        });
        events.addEventListener("done", () => end());
        events.addEventListener("failure", (e) =>
          end(JSON.parse((e as MessageEvent).data).message),
        );
        events.onerror = () =>
          end(
            "The stream connection was interrupted. Refresh the branch to check its result.",
          );
      }
    } catch (e) {
      if (current === epoch.current) {
        setError((e as Error).message);
        setPendingPair(null);
        setBusy(false);
      }
    }
  }
  async function reset() {
    epoch.current++;
    eventSource.current?.close();
    pairSources.current.forEach((e) => e.close());
    pairSources.current = [];
    setPendingPair(null);
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
  async function inspect(message: { generation_id: string }) {
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
      setPendingPair(null);
      setError("");
    } catch (e) {
      setError((e as Error).message);
    }
  }
  return {
    branch,
    preview,
    previewError,
    receipt,
    setReceipt,
    busy,
    error,
    setError,
    streamText,
    pendingText,
    pendingPair,
    previewContext,
    submit,
    submitPair,
    reset,
    exportBranch,
    inspect,
    refresh,
  };
}
