import { create } from "zustand";
import type { ContextOptions, Settings } from "./types";
const initial = new URLSearchParams(location.search);
const writeURL = (patch: Record<string, string>) => {
  const u = new URL(location.href);
  Object.entries(patch).forEach(([k, v]) =>
    v ? u.searchParams.set(k, v) : u.searchParams.delete(k),
  );
  history.replaceState(null, "", u);
};
export const defaultOptions: ContextOptions = {
  breadth: "thread",
  excluded_ids: [],
  excluded_tags: [],
  include_summaries: false,
  include_documents: false,
  replace_cutoff: false,
  context_mode: "inherit_history",
};
interface State {
  entry: string;
  anchor: string;
  granularity: string;
  first: string;
  last: string;
  theme: string;
  tab: string;
  options: ContextOptions;
  settings: Settings;
  text: string;
  branchId: string | null;
  entered: boolean;
  select: (entry: string, anchor?: string) => void;
  setGranularity: (v: string) => void;
  setTheme: (v: string) => void;
  setRange: (first: string, last: string) => void;
  setTab: (v: string) => void;
  setOptions: (v: Partial<ContextOptions>) => void;
  setSettings: (v: Partial<Settings>) => void;
  setText: (v: string) => void;
  setBranch: (v: string | null) => void;
  setEntered: (v: boolean) => void;
}
export const useExperience = create<State>((set) => ({
  entry: initial.get("entry") || "",
  anchor: initial.get("anchor") || "",
  granularity: initial.get("zoom") || "journey",
  first: initial.get("first") || "",
  last: initial.get("last") || "",
  theme: localStorage.getItem("machina-theme") || "archive",
  tab: "transcript",
  options: { ...defaultOptions },
  settings: {
    provider: "demo",
    model: "documentary-demo-v1",
    temperature: null,
    max_output_tokens: 700,
  },
  text: "",
  branchId: null,
  entered: !!initial.get("entry"),
  select: (entry, anchor = "") => {
    writeURL({ entry, anchor });
    set({
      entry,
      anchor,
      tab: "transcript",
      branchId: null,
      text: "",
      options: { ...defaultOptions },
      entered: true,
    });
  },
  setGranularity: (granularity) => {
    writeURL({ zoom: granularity });
    set({ granularity });
  },
  setTheme: (theme) => {
    localStorage.setItem("machina-theme", theme);
    set({ theme });
  },
  setRange: (first, last) => {
    writeURL({ first, last });
    set({ first, last });
  },
  setTab: (tab) => set({ tab }),
  setOptions: (v) => set((s) => ({ options: { ...s.options, ...v } })),
  setSettings: (v) => set((s) => ({ settings: { ...s.settings, ...v } })),
  setText: (text) => set({ text }),
  setBranch: (branchId) => set({ branchId }),
  setEntered: (entered) => set({ entered }),
}));
window.addEventListener("popstate", () => {
  const q = new URLSearchParams(location.search);
  useExperience.setState({
    entry: q.get("entry") || "",
    anchor: q.get("anchor") || "",
    granularity: q.get("zoom") || "journey",
    first: q.get("first") || "",
    last: q.get("last") || "",
    entered: !!q.get("entry"),
  });
});
