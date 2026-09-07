export type Origin = "historical" | "visitor" | "generated";
export interface Provenance {
  source_id: string;
  source_path: string;
  source_sha256: string;
  locator: string;
  ingestion_version: string;
  text_kind: string;
}
export interface HistoricalMessage {
  id: string;
  thread_id: string;
  sequence: number;
  ordinal: number;
  speaker: "beaven" | "mirrows" | "unknown" | "system";
  body: string;
  origin: "historical";
  recorded_at: string | null;
  disclosed_at: string | null;
  time_precision: string;
  provenance: Provenance;
  content_hash: string;
  tags: string[];
  review_status: string;
}
export interface Thread {
  id: string;
  title: string;
  chapter_code: string;
  start_at: string | null;
  end_at: string | null;
  place: string | null;
  sequence: number;
  message_count: number;
  entry_message_id: string;
}
export interface Anchor {
  id: string;
  title: string;
  subtitle: string;
  entry_message_id: string;
  start_at: string;
  importance: number;
  curatorial_note: string;
}
export interface Provider {
  id: string;
  name: string;
  adapter: string;
  default_model: string;
  available: boolean;
}
export interface Start {
  id: string;
  title: string;
  description: string;
  anchor_id: string | null;
  entry_message_id: string;
  context_mode: string;
}
export interface Experience {
  profile: {
    id: string;
    name: string;
    default_start: string;
    start_options: Start[];
    branch_turn_limit: number;
    enabled_themes: string[];
    default_theme: string;
    allowed_granularities: string[];
  };
  content_version: string;
  mode: string;
  providers: Provider[];
  counts: {
    threads: number;
    messages: number;
    anchors: number;
    review_items: number;
  };
  tags: { id: string; label: string }[];
  available_summaries: number;
  available_documents: number;
}
export interface Position {
  message_id: string;
  thread_id: string;
  sequence: number;
  ordinal: number;
  date: string | null;
  speaker: string;
}
export interface ThreadPage {
  thread: Thread;
  messages: HistoricalMessage[];
  total: number;
  has_before: boolean;
  has_after: boolean;
}
export interface ContextOptions {
  breadth: "scene" | "thread" | "chapter" | "journey";
  excluded_ids: string[];
  excluded_tags: string[];
  include_summaries: boolean;
  include_documents: boolean;
  replace_cutoff: boolean;
  context_mode: "inherit_history" | "begin_context_here";
}
export interface Settings {
  provider: string;
  model: string;
  temperature: number | null;
  max_output_tokens: number;
}
export interface ManifestItem {
  id: string;
  source_id: string;
  source_version: string;
  role: string;
  origin: string;
  body: string;
  position: number;
  token_estimate: number;
  reason: string;
  protected: boolean;
  disclosed_at: string | null;
  locator: string | null;
  tags: string[];
}
export interface Manifest {
  id: string;
  hash: string;
  content_version: string;
  entry_message_id: string;
  policy_id: string;
  policy_version: number;
  profile_id: string;
  profile_version: number;
  settings: Settings;
  options: ContextOptions;
  items: ManifestItem[];
  exclusions: { id: string; reason: string }[];
  token_estimate: number;
  max_input_tokens: number;
  token_estimator: string;
}
export interface BranchMessage {
  id: string;
  sequence: number;
  speaker: "visitor" | "model";
  origin: "visitor" | "generated";
  body: string;
  generation_id: string;
  created_at: string;
}
export interface Branch {
  id: string;
  entry_message_id: string;
  messages: BranchMessage[];
  generation_ids: string[];
  expires_at: string;
  context_mode: string;
}
export interface Artifact {
  id: string;
  kind: string;
  title: string;
  body: string;
  uri: string | null;
  alt_text: string;
  credits: string;
  rights_status: string;
  transcript: string | null;
  poster_uri: string | null;
  duration: number | null;
  curatorial_note: string;
  provenance: Provenance;
}
export interface Cluster {
  id: string;
  label: string;
  entry_message_id: string;
  thread_id: string;
  start_at: string | null;
  ordinal: number;
  last_ordinal: number;
  count: number;
  artifact_count: number;
}
export interface Timeline {
  granularity: string;
  axis: string;
  clusters: Cluster[];
  anchors: Anchor[];
  total_messages: number;
  bounds: { start: string; end: string };
}
