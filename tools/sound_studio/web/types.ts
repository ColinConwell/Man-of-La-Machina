export type Source = {
  id: string;
  title: string;
  text: string;
  kind: string;
  source_version?: string;
  options?: Record<string, unknown>;
  version?: number;
};
export type Point = {
  time: number;
  value: number;
  sentence_id?: string | null;
};
export type Lane = {
  parameter: string;
  points: Point[];
  interpolation: "linear" | "step";
  smoothing: number;
  depth: number;
  feature?: string;
  feature_track_id?: string;
};
export type Effect = {
  id: string;
  kind: string;
  enabled: boolean;
  params: Record<string, number | string | boolean>;
  start: number;
  end: number | null;
  automation: Lane[];
};
export type Layer = {
  id: string;
  sample_id: string;
  name: string;
  offset: number;
  gain: number;
  pan: number;
  mute: boolean;
  solo: boolean;
  fade_in: number;
  fade_out: number;
  effects: Effect[];
  automation: Lane[];
};
export type Recipe = {
  layers: Layer[];
  master_gain: number;
  limiter: boolean;
  sample_rate: 44100 | 48000;
  tail: number;
};
export type Project = {
  id: string;
  name: string;
  revision: number;
  recipe: Recipe;
  auto_upload: boolean;
  notes: string;
  updated?: string;
  version?: number;
};
export type Sample = {
  id: string;
  title: string;
  source: Source;
  text_hash: string;
  duration: number;
  sample_rate: number;
  channels: number;
  peaks: number[];
  peak_db: number;
  rms_db: number;
  favorite: boolean;
  tags: string[];
  notes: string;
  local: boolean;
  receipt: Record<string, unknown>;
  created: string;
};
export type Control = {
  label: string;
  default: string | number | boolean;
  min: number | null;
  max: number | null;
  choices: (string | number)[] | null;
  help: string;
};
export type Provider = {
  id: string;
  name: string;
  models: string[];
  voice: string;
  voices: string[];
  available: boolean;
  docs: string;
  model_controls: Record<string, Record<string, Control>>;
};
export type Generation = {
  provider: string;
  model: string;
  voice: string;
  settings: Record<string, unknown>;
};
export type Knob = {
  label: string;
  default: number;
  min: number;
  max: number;
  unit: string;
  step: number;
};
export type EffectDef = {
  name: string;
  explanation: string;
  params: Record<string, Knob>;
  live: boolean;
  preview: string;
};
export type Capabilities = {
  baseline_presets: Generation[];
  providers: Provider[];
  effects: Record<string, EffectDef>;
  remote: boolean;
  alignment: boolean;
  fixture: boolean;
  analysis_providers: {
    id: string;
    name: string;
    available: boolean;
    default_model: string;
  }[];
};
export type Job = {
  id: string;
  operation: string;
  status: string;
  progress: number;
  error: string | null;
  result: { id?: string; kind?: string } | null;
  payload?: Record<string, unknown>;
  batch_id?: string;
};
export type Feature = {
  id: string;
  text_hash: string;
  definitions: Record<string, { min: number; max: number }>;
  segments: {
    id: string;
    text: string;
    start_char: number;
    end_char: number;
    values: Record<string, number>;
  }[];
  method: string;
  [key: string]: unknown;
};
export const uid = () => crypto.randomUUID().replaceAll("-", "");
export const newProject = (): Project => ({
  id: uid(),
  name: "Windmill Voice Study",
  revision: 0,
  recipe: {
    layers: [],
    master_gain: 0,
    limiter: true,
    sample_rate: 48000,
    tail: 2,
  },
  auto_upload: false,
  notes: "",
});
export const newLayer = (s: Sample): Layer => ({
  id: uid(),
  sample_id: s.id,
  name: s.title,
  offset: 0,
  gain: -6,
  pan: 0,
  mute: false,
  solo: false,
  fade_in: 0.02,
  fade_out: 0.05,
  effects: [],
  automation: [],
});
export const newEffect = (kind: string, def: EffectDef): Effect => ({
  id: uid(),
  kind,
  enabled: true,
  params: Object.fromEntries(
    Object.entries(def.params).map(([k, v]) => [k, v.default]),
  ),
  start: 0,
  end: null,
  automation: [],
});
