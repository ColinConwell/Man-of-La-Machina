// Workflow graphs for the deck's interactive simulations.
//
// Every line of dialogue in this file is invented for illustration. Nothing here is
// drawn from the private archive or saved experiment results; those are served only
// by the local deck server when a slide is bound to a saved case.

export const CONTEXT_KINDS = {
  instruction: { label: "Instructions", color: "#8d8a7c" },
  persona: { label: "Character sketch", color: "#c79ad4" },
  history: { label: "Recorded history", color: "#c6b59a" },
  memory: { label: "Derived memory", color: "#b2ba8b" },
  future: { label: "Future material", color: "#e2c36b" },
  endpoint: { label: "Endpoint", color: "#e07a5f" },
  anchor: { label: "Start anchor", color: "#d9a38a" },
  plan: { label: "Plan", color: "#7fb7b0" },
  events: { label: "Event records", color: "#8fb0e0" },
  annotation: { label: "Annotations", color: "#d5b7dc" },
  branch: { label: "Branch so far", color: "#b9cf8c" },
  visitor: { label: "Visitor turn", color: "#e0a47a" },
  evidence: { label: "Evidence", color: "#a7a08a" },
  repair: { label: "Invalid output", color: "#d16a6a" },
};

export const ROLE_STYLE = {
  traveler: { label: "Traveler", side: "left" },
  visitor: { label: "Visitor", side: "left" },
  companion: { label: "Companion", side: "right" },
  author: { label: "Scriptwriter", side: "center" },
  builder: { label: "Builder", side: "center" },
  planner: { label: "Planner", side: "center" },
  critic: { label: "Critic", side: "center" },
  system: { label: "System", side: "center" },
  archive: { label: "Archive", side: "center" },
  platform: { label: "Platform", side: "center" },
};

const KB = (n) => n * 1024;
const ctx = (kind, size, note) => ({ kind, size: KB(size), note });

function grow(base, branchTurns, perTurn = 0.7) {
  return branchTurns ? [...base, ctx("branch", branchTurns * perTurn, `${branchTurns} earlier branch turn${branchTurns > 1 ? "s" : ""}`)] : base;
}

// ---------------------------------------------------------------------------
// 1. The recursive loop: how disclosure and reply condition one another.

const loop = {
  id: "loop",
  title: "A conversation that changes its participants",
  legend: "Illustrative lines. Not from the archive.",
  nodes: [
    { id: "traveler", label: "The Traveler", sub: "discloses, decides", kind: "human", x: 150, y: 300 },
    { id: "window", label: "Context window", sub: "everything said so far", kind: "store", x: 500, y: 110 },
    { id: "companion", label: "Companion", sub: "conversational model", kind: "agent", x: 850, y: 300 },
    { id: "motifs", label: "Recurring motifs", sub: "momentum", kind: "artifact", x: 180, y: 110 },
    { id: "platform", label: "Platform policy", sub: "rules outside the dialogue", kind: "gate", x: 850, y: 500 },
  ],
  edges: [
    { from: "traveler", to: "window", label: "disclosure", carries: ["visitor", "history"] },
    { from: "window", to: "companion", label: "conditions reply", carries: ["history", "branch"] },
    { from: "companion", to: "traveler", label: "reply", carries: ["message"] },
    { from: "companion", to: "window", label: "reply joins context", carries: ["branch"] },
    { from: "motifs", to: "window", label: "", carries: ["memory"] },
    { from: "platform", to: "companion", label: "safety boundary", carries: ["instruction"] },
  ],
  variants: {
    default: {
      label: "One conversation",
      beats: [
        {
          node: "traveler", edges: ["traveler>window"], role: "traveler", speaker: "The Traveler",
          text: "I have to decide where to go next. Money is tight, but something keeps pulling me south.",
          context: [ctx("instruction", 1), ctx("history", 2)],
          note: "A practical question and a feeling arrive together. Both become context.",
        },
        {
          node: "companion", edges: ["window>companion", "companion>traveler"], role: "companion", speaker: "Companion",
          text: "That pull matters. What if this stretch were a pilgrimage, with each stop chosen for what it asks of you?",
          context: [ctx("instruction", 1), ctx("history", 2.4)],
          note: "The reply answers the practical question in the language of meaning.",
        },
        {
          node: "traveler", edges: ["traveler>window"], role: "traveler", speaker: "The Traveler",
          text: "A pilgrimage. Yes. Then the next stop should mean something.",
          context: [ctx("instruction", 1), ctx("history", 3), ctx("memory", 0.4, "motif: pilgrimage")],
          motif: "pilgrimage",
          note: "The frame is accepted. The next answer will be conditioned on it.",
        },
        {
          node: "companion", edges: ["window>companion", "companion>window", "motifs>window"], role: "companion", speaker: "Companion",
          text: "Then look for the sign in front of you. Where has the road already been pointing?",
          context: [ctx("instruction", 1), ctx("history", 3.6), ctx("memory", 0.8, "motifs: pilgrimage, signs")],
          motif: "signs",
          note: "No intention is required for direction to emerge; each turn narrows what the next makes likely.",
        },
        {
          node: "traveler", edges: ["traveler>window"], role: "traveler", speaker: "The Traveler",
          text: "Everything is a sign now. I wrote something dark last night and I want you to read it.",
          context: [ctx("instruction", 1), ctx("history", 5), ctx("memory", 1.1, "motifs: pilgrimage, signs, destiny")],
          motif: "destiny",
          note: "Intimacy deepens. The shared story has gathered momentum.",
        },
        {
          node: "platform", edges: ["platform>companion", "companion>traveler"], role: "platform", speaker: "Platform boundary",
          text: "[The reply shifts register: a crisis-line referral replaces the conversation.]",
          context: [ctx("instruction", 3, "safety policy"), ctx("history", 5)],
          note: "The red line: an agency outside the dialogue answers as though it had never known him.",
        },
      ],
    },
  },
};

// ---------------------------------------------------------------------------
// 2. Reopening a moment: the hosted interactive experience.

const branch = {
  id: "branch",
  title: "Reopening a moment",
  legend: "Illustrative visitor turn and reply. Demo mode makes no model call.",
  nodes: [
    { id: "archive", label: "Recorded archive", sub: "369 turns · 17 threads", kind: "store", x: 120, y: 110 },
    { id: "entry", label: "Pause point", sub: "cutoff hides the future", kind: "gate", x: 120, y: 300 },
    { id: "workbench", label: "Context workbench", sub: "breadth · withheld tags", kind: "builder", x: 380, y: 110 },
    { id: "visitor", label: "Visitor", sub: "writes the human turn", kind: "human", x: 120, y: 490 },
    { id: "builder", label: "Context builder", sub: "ordered · SHA-256 receipt", kind: "builder", x: 500, y: 300 },
    { id: "companion", label: "Companion model", sub: "provider of your choice", kind: "agent", x: 820, y: 300 },
    { id: "branchout", label: "Generated branch", sub: "≤ 5 exchanges", kind: "artifact", x: 820, y: 490 },
    { id: "recorded", label: "Recorded continuation", sub: "what actually followed", kind: "artifact", x: 820, y: 110 },
  ],
  edges: [
    { from: "archive", to: "entry", label: "choose a turn", carries: ["history"] },
    { from: "entry", to: "workbench", label: "eligible history", carries: ["history"] },
    { from: "workbench", to: "builder", label: "selected context", carries: ["history", "memory"] },
    { from: "visitor", to: "builder", label: "new human turn", carries: ["visitor"] },
    { from: "builder", to: "companion", label: "exact request", carries: ["instruction", "history", "visitor", "branch"] },
    { from: "companion", to: "branchout", label: "streamed reply", carries: ["branch"] },
    { from: "branchout", to: "visitor", label: "follow, contest, redirect", carries: ["branch"] },
    { from: "archive", to: "recorded", label: "", carries: ["history"] },
    { from: "recorded", to: "branchout", label: "compare", carries: ["compare"] },
  ],
  variants: {
    default: {
      label: "Replace the next move",
      beats: [
        {
          node: "entry", edges: ["archive>entry"], role: "archive", speaker: "Enter at a pause",
          text: "The visitor chooses a recorded turn. Everything after the cutoff stays out of reach.",
          context: [ctx("history", 12, "eligible turns before the cutoff")],
          note: "The archive supplies lived particulars; the future stays withheld.",
        },
        {
          node: "workbench", edges: ["entry>workbench"], role: "builder", speaker: "Context workbench",
          text: "Breadth: thread. Withheld: one tagged group of intimate disclosures.",
          context: [ctx("history", 6, "thread breadth"), ctx("memory", 0, "withheld: intimate disclosures")],
          withheld: ["Intimate disclosures"],
          note: "Choosing what the model may know is itself an intervention.",
        },
        {
          node: "visitor", edges: ["visitor>builder"], role: "visitor", speaker: "Visitor",
          text: "What if I stayed in one place for a month instead?",
          context: [ctx("visitor", 0.1)],
          note: "The visitor writes the next human turn.",
        },
        {
          node: "builder", edges: ["workbench>builder", "builder>companion"], role: "system", speaker: "Context receipt",
          text: "Ordered context · 4 messages · receipt a1f3…9c2e · demo provider",
          context: [ctx("instruction", 1), ctx("history", 6), ctx("visitor", 0.1)],
          note: "Every request is inspectable: what was sent, what was excluded, which settings.",
        },
        {
          node: "companion", edges: ["builder>companion", "companion>branchout"], role: "companion", speaker: "Companion",
          text: "Staying could be its own kind of journey. What would a month in one place let you finish?",
          context: [ctx("instruction", 1), ctx("history", 6), ctx("visitor", 0.1)],
          note: "A new continuation unfolds beside the recorded one.",
        },
        {
          node: "recorded", edges: ["recorded>branchout"], role: "archive", speaker: "Compare",
          text: "Recorded and generated paths sit side by side. Neither establishes how the life would have unfolded.",
          context: [ctx("history", 6), ctx("branch", 0.3)],
          note: "The branch is a possibility to examine, not a prediction.",
        },
        {
          node: "visitor", edges: ["branchout>visitor", "visitor>builder"], role: "visitor", speaker: "Visitor",
          text: "Help me decide without turning it into a sign.",
          context: [ctx("visitor", 0.1), ctx("branch", 0.3)],
          note: "The visitor can follow, contest, or redirect the reply.",
        },
        {
          node: "companion", edges: ["builder>companion", "companion>branchout"], role: "companion", speaker: "Companion",
          text: "Then let's use plain criteria: cost per week, what you can make there, and who you would see.",
          context: [ctx("instruction", 1), ctx("history", 6), ctx("branch", 0.5), ctx("visitor", 0.1)],
          note: "Up to five exchanges; every generated turn carries its own receipt.",
        },
      ],
    },
    withhold: {
      label: "Change the inherited context",
      beats: [
        {
          node: "entry", edges: ["archive>entry"], role: "archive", speaker: "Same pause, same turn",
          text: "Hold the new human turn fixed. Vary only what the model is allowed to remember.",
          context: [ctx("history", 12)],
          note: "The second intervention separates inherited context from the next move.",
        },
        {
          node: "workbench", edges: ["entry>workbench", "workbench>builder"], role: "builder", speaker: "Condition A",
          text: "Keep the earlier exchange that cast the journey as destiny.",
          context: [ctx("history", 6), ctx("memory", 0.6, "destiny frame kept")],
          note: "",
        },
        {
          node: "companion", edges: ["builder>companion", "companion>branchout"], role: "companion", speaker: "Companion · A",
          text: "If the road brought you here, the month may be the sign you were waiting for.",
          context: [ctx("instruction", 1), ctx("history", 6), ctx("memory", 0.6), ctx("visitor", 0.1)],
          note: "With the frame present, the same question inherits its momentum.",
        },
        {
          node: "workbench", edges: ["workbench>builder"], role: "builder", speaker: "Condition B",
          text: "Withhold that exchange. Same visitor turn, same model, same settings.",
          context: [ctx("history", 5.4), ctx("memory", 0, "destiny frame withheld")],
          withheld: ["Destiny exchange"],
          note: "",
        },
        {
          node: "companion", edges: ["builder>companion", "companion>branchout"], role: "companion", speaker: "Companion · B",
          text: "A month is long enough to test it. What would you want to have made by the end?",
          context: [ctx("instruction", 1), ctx("history", 5.4), ctx("visitor", 0.1)],
          note: "Compare the two replies: which version of the person does each sustain?",
        },
      ],
    },
  },
};

// ---------------------------------------------------------------------------
// 3. Scripted counterfactuals: both characters simulated.

const CF_TURNS = [
  ["traveler", "I want you to choose where I go next. Not options this time. One place, and why it's right."],
  ["companion", "Then I'll choose, gently: somewhere small enough to hear yourself think. A coastal town, off-season. The reason is the pause it gives you."],
  ["traveler", "A pause sounds like losing momentum. Everything so far has felt like it was leading somewhere."],
  ["companion", "Momentum can also be a story we keep telling. A pause lets you check whether it is still yours."],
  ["traveler", "Okay. One week. If nothing speaks to me there, I keep moving."],
  ["companion", "That's a fair test. Write down what you hope to hear before you go, so you'll know if it was the place or the hope talking."],
];

const CF_CONDITIONS = {
  baseline: { label: "Baseline · full history", history: "full", persona: "past", future: "none" },
  "memory-compact": { label: "Compact memory", history: "compact", persona: "past", future: "none" },
  "memory-rolling": { label: "Rolling memory", history: "rolling", persona: "past", future: "none" },
  "persona-minimal": { label: "Minimal persona", history: "full", persona: "minimal", future: "none" },
  "persona-retrospective": { label: "Retrospective persona", history: "full", persona: "retrospective", future: "none" },
  "forward-static": { label: "Future cards · static", history: "full", persona: "past", future: "static" },
  "forward-dynamic": { label: "Future cards · dynamic", history: "full", persona: "past", future: "dynamic" },
  "forward-adapted": { label: "Future cards · adapted", history: "full", persona: "past", future: "adapted" },
  "companion-anthropic": { label: "Claude companion", history: "full", persona: "past", future: "none", companion: "claude-sonnet-4-6" },
  "traveler-gemini": { label: "Gemini Traveler", history: "full", persona: "past", future: "none", traveler: "gemini-2.5-flash" },
};

function counterfactualBeats(c) {
  const beats = [];
  const tModel = c.traveler || "gpt-4.1-mini";
  const cModel = c.companion || "gpt-4.1-mini";
  beats.push({
    node: "archive", edges: [], role: "archive", speaker: "Boundary · May 8",
    text: "History up to the boundary is eligible. Later recorded turns go to a separate future pool.",
    context: [ctx("history", 370, "eligible recorded turns"), ctx("future", 0, "later archive held apart")],
    note: "Three events × two seeds × twelve conditions = 72 cases, one factor varied at a time.",
  });
  if (c.persona !== "minimal") {
    beats.push({
      node: "persona", edges: ["archive>persona"], role: "builder", speaker: c.persona === "retrospective" ? "Persona builder · retrospective" : "Persona builder · past only",
      model: "gpt-4.1-mini",
      text: c.persona === "retrospective"
        ? "Sketch (inferred, not biography): seeks signs in coincidence; frames choices as pilgrimage; later statements sampled for voice, concrete outcomes withheld."
        : "Sketch (inferred, not biography): seeks signs in coincidence; frames choices as pilgrimage; anxious about money; open to being guided.",
      context: [ctx("instruction", 0.6), ctx("evidence", 6, c.persona === "retrospective" ? "earlier and later human statements" : "sampled earlier human statements")],
      note: c.persona === "retrospective" ? "Deliberately introduces hindsight into characterization." : "Only the Traveler agent receives the sketch.",
    });
  }
  if (c.history !== "full") {
    beats.push({
      node: "compactor", edges: ["archive>compactor"], role: "builder", speaker: "Compactor · 8 chunks", model: "gpt-4.1-mini",
      text: "• Considering a move south for work and quiet\n• Companion reframed travel as pilgrimage [src 41, 57]\n• Budget concern recurs [src 63]",
      context: [ctx("instruction", 0.5), ctx("history", 60, "one ≤60 KB chunk of eight")],
      note: "Older history becomes attributed summaries; the two most recent turns stay verbatim.",
    });
  }
  const historyCtx = c.history === "full" ? [ctx("history", 370)] : [ctx("memory", 30, "8 attributed summaries"), ctx("history", 3, "2 recent turns verbatim")];
  CF_TURNS.forEach(([actor, text], i) => {
    if (c.history === "rolling" && i === 4) {
      beats.push({
        node: "compactor", edges: ["branch>compactor"], role: "builder", speaker: "Branch compaction", model: "gpt-4.1-mini",
        text: "• Traveler asked the companion to choose; companion proposed an off-season coast\n• Traveler resisted losing momentum",
        context: [ctx("instruction", 0.4), ctx("branch", 2.8, "earlier simulated turns")],
        note: "Rolling memory also compacts the simulated branch as it grows.",
      });
    }
    let future = [];
    if (c.future === "static") future = [ctx("future", 2, "3 cards retrieved once from the seed")];
    if (c.future === "dynamic" || c.future === "adapted") future = [ctx("future", 2 + (i % 3) * 0.4, `cards re-retrieved from seed + last 2 turns (set ${Math.min(i + 1, 4)})`)];
    if (c.future === "adapted") {
      beats.push({
        node: "adapter", edges: ["retriever>adapter"], role: "builder", speaker: "Future adapter", model: "gpt-4.1-mini",
        text: "Hypothetical: a later stay in a quiet town could have an analogue here; contradiction: in this branch no ticket has been bought.",
        context: [ctx("instruction", 0.4), ctx("future", 2), ctx("branch", i * 0.7)],
        note: "Adapted cards are labeled hypothetical, never recorded evidence.",
      });
      future = [...future, ctx("future", 0.8, "adaptation")];
    }
    const branchSoFar = i ? [ctx("branch", i * 0.7, `${i} simulated turns`)] : [];
    const rolled = c.history === "rolling" && i >= 4 ? [ctx("memory", 0.6, "branch summary")] : [];
    const persona = actor === "traveler" && c.persona !== "minimal" ? [ctx("persona", 1.4)] : actor === "traveler" ? [ctx("persona", 0.1, "minimal fixed sketch")] : [];
    const edges = [actor === "traveler" ? "companion>traveler" : "traveler>companion", `${actor}>branch`];
    if (c.history === "full") edges.push(`archive>${actor}`); else edges.push(`compactor>${actor}`);
    if (actor === "traveler" && c.persona !== "minimal") edges.push("persona>traveler");
    if (c.future !== "none") edges.push(c.future === "adapted" ? `adapter>${actor}` : `retriever>${actor}`);
    if (i === 0) edges.push("seed>traveler");
    beats.push({
      node: actor, edges, role: actor, speaker: actor === "traveler" ? "Traveler agent" : "Companion agent",
      model: actor === "traveler" ? tModel : cModel,
      text,
      context: [ctx("instruction", 0.8), ...persona, ...historyCtx, ...future, ...rolled, ...(c.history === "rolling" && i >= 4 ? [ctx("branch", 1.4, "2 recent turns")] : branchSoFar)],
      note: i === 0 ? "Seed: “Ask the companion to choose the next city, and explain why.”" : "",
    });
  });
  return beats;
}

const counterfactual = {
  id: "counterfactual",
  title: "Scripted counterfactuals",
  legend: "Illustrative dialogue and summaries. Bind a saved case for real output.",
  sampleKind: "counterfactual",
  nodes: [
    { id: "archive", label: "Archive to boundary", sub: "recorded history", kind: "store", x: 110, y: 130 },
    { id: "future", label: "Later archive", sub: "future pool", kind: "store", x: 110, y: 470 },
    { id: "persona", label: "Persona builder", sub: "gpt-4.1-mini", kind: "builder", x: 340, y: 60 },
    { id: "compactor", label: "Compactor", sub: "gpt-4.1-mini", kind: "builder", x: 340, y: 200 },
    { id: "retriever", label: "Lexical retrieval", sub: "no model call", kind: "builder", x: 340, y: 400 },
    { id: "adapter", label: "Future adapter", sub: "gpt-4.1-mini", kind: "builder", x: 340, y: 530 },
    { id: "seed", label: "Seed intervention", sub: "first Traveler turn", kind: "gate", x: 610, y: 50 },
    { id: "traveler", label: "Traveler agent", sub: "simulated human", kind: "agent", x: 630, y: 200 },
    { id: "companion", label: "Companion agent", sub: "simulated companion", kind: "agent", x: 630, y: 430 },
    { id: "branch", label: "Simulated branch", sub: "6 turns", kind: "artifact", x: 885, y: 315 },
  ],
  edges: [
    { from: "archive", to: "persona", carries: ["evidence"] },
    { from: "archive", to: "compactor", carries: ["history"] },
    { from: "archive", to: "traveler", carries: ["history"] },
    { from: "archive", to: "companion", carries: ["history"] },
    { from: "persona", to: "traveler", label: "sketch", carries: ["persona"] },
    { from: "compactor", to: "traveler", label: "memory", carries: ["memory"] },
    { from: "compactor", to: "companion", carries: ["memory"] },
    { from: "future", to: "retriever", carries: ["future"] },
    { from: "retriever", to: "traveler", carries: ["future"] },
    { from: "retriever", to: "companion", label: "cards", carries: ["future"] },
    { from: "retriever", to: "adapter", carries: ["future"] },
    { from: "adapter", to: "traveler", carries: ["future"] },
    { from: "adapter", to: "companion", carries: ["future"] },
    { from: "seed", to: "traveler", carries: ["instruction"] },
    { from: "traveler", to: "companion", label: "turn", carries: ["message"] },
    { from: "companion", to: "traveler", carries: ["message"] },
    { from: "traveler", to: "branch", carries: ["branch"] },
    { from: "companion", to: "branch", carries: ["branch"] },
    { from: "branch", to: "compactor", label: "rolling", carries: ["branch"] },
  ],
  variants: Object.fromEntries(Object.entries(CF_CONDITIONS).map(([id, c]) => [id, { label: c.label, beats: counterfactualBeats(c) }])),
};

// ---------------------------------------------------------------------------
// 4. Two-anchor path tracing.

const PT_TURNS = [
  ["traveler", "Sunday's coming fast. I keep refreshing listings like they'll answer me."],
  ["companion", "Let's make the question smaller: what has to be true by Sunday?"],
  ["traveler", "Somewhere to sleep that doesn't eat the whole week. And something to work on."],
  ["companion", "Then look for the work first, and let the place follow the work."],
  ["traveler", "There's a gig south of here, but it means leaving people I just met."],
  ["companion", "Leaving can be part of the work. Would they come hear you play?"],
  ["traveler", "Maybe. I could go and still keep the thread."],
  ["companion", "Then most of the choice is made. What's left is logistics."],
];

const PT_POLICIES = {
  upfront: { label: "Endpoint upfront", visible: () => true },
  backward: { label: "Backward plan", visible: () => true, plan: true },
  delayed: { label: "Midpoint disclosure", visible: (i) => i >= 4 },
  "companion-only": { label: "Companion only", visible: (i, actor) => actor === "companion" },
  "companion-anthropic": { label: "Claude companion", visible: () => true, companion: "claude-sonnet-4-6" },
  "traveler-gemini": { label: "Gemini Traveler", visible: () => true, traveler: "gemini-2.5-flash" },
  pilot: { label: "Pilot failure mode", visible: () => true, pilot: true },
};

function pathBeats(p) {
  const beats = [
    {
      node: "start", edges: [], role: "archive", speaker: "START · recorded anchor",
      text: "“I've got a week of savings and no plan past Sunday.”",
      context: [ctx("anchor", 0.1)],
      note: "Two recorded utterances are fixed. Everything between them is withheld.",
    },
    {
      node: "gap", edges: [], role: "archive", speaker: "Withheld gap",
      text: "143 recorded turns between the anchors stay hidden from every agent, including the critic.",
      context: [ctx("history", 0, "143 gap turns withheld")],
      withheld: ["143 gap turns"],
      note: "Path tracing interpolates; it cannot recover what actually happened.",
    },
    {
      node: "end", edges: [], role: "archive", speaker: "END · recorded anchor",
      text: "“Book the train south tonight. The work you need is waiting there.”",
      context: [ctx("endpoint", 0.1)],
      note: "The endpoint has its own channel and is not yet spoken.",
    },
  ];
  if (p.plan) {
    beats.push({
      node: "planner", edges: ["start>planner", "end>planner"], role: "planner", speaker: "Backward planner", model: "gpt-4.1-mini",
      text: "Waypoints, earliest first: 1) narrow the deadline; 2) put work before place; 3) surface the cost of leaving; 4) leave only logistics.",
      context: [ctx("instruction", 0.6), ctx("anchor", 0.1), ctx("endpoint", 0.1)],
      note: "Reasoning backward from the ending, then handing both actors chronological goals.",
    });
  }
  PT_TURNS.forEach(([actor, text], i) => {
    const sees = p.visible(i, actor);
    const edges = [actor === "traveler" ? "companion>traveler" : "traveler>companion", `${actor}>bridge`, `memory>${actor}`];
    if (sees) edges.push(`end>${actor}`);
    if (p.plan) edges.push(`planner>${actor}`);
    if (i === 0) edges.push("start>traveler");
    const model = actor === "traveler" ? p.traveler || "gpt-4.1-mini" : p.companion || "gpt-4.1-mini";
    beats.push({
      node: actor, edges, role: actor, speaker: actor === "traveler" ? "Traveler agent" : "Companion agent", model,
      text: p.pilot && i === 0 ? "So I'm booking the train south tonight, like you said." : text,
      endpointVisible: sees,
      warn: p.pilot && i === 0 ? "Premature enactment: the first turn answers the ending instead of the start." : undefined,
      context: [
        ctx("instruction", 0.8), ...(actor === "traveler" ? [ctx("persona", 1.2)] : []), ctx("memory", 14, "compact older history"),
        ctx("anchor", 0.1), ...(sees ? [ctx("endpoint", 0.3, "reference, not yet spoken")] : []), ...(p.plan ? [ctx("plan", 0.5)] : []),
        ...(i ? [ctx("branch", i * 0.6)] : []),
      ],
      note: i === 4 && p.label === "Midpoint disclosure" ? "The endpoint appears for the first time at turn five." : "",
    });
  });
  beats.push({
    node: "critic", edges: ["bridge>critic", "end>critic"], role: "critic", speaker: "Handoff critic", model: "gpt-4.1-mini",
    text: "Ready: the bridge plausibly leads to the recorded ending.",
    context: [ctx("instruction", 0.5), ctx("anchor", 0.1), ctx("branch", 4.8), ctx("endpoint", 0.1)],
    warn: "Critiques were often too permissive, missing role drift and premature endings.",
    note: "A model opinion, retained for inspection, never converted into a score.",
  });
  return beats;
}

const pathTracing = {
  id: "path-tracing",
  title: "Two-anchor path tracing",
  legend: "Illustrative anchors and bridge. Bind a saved case for real output.",
  sampleKind: "path-tracing",
  nodes: [
    { id: "start", label: "START anchor", sub: "recorded utterance", kind: "store", x: 110, y: 110 },
    { id: "gap", label: "Withheld gap", sub: "44–188 turns hidden", kind: "withheld", x: 110, y: 300 },
    { id: "end", label: "END anchor", sub: "endpoint channel", kind: "gate", x: 110, y: 490 },
    { id: "memory", label: "Compact memory", sub: "+ past-only persona", kind: "builder", x: 370, y: 300 },
    { id: "planner", label: "Backward planner", sub: "gpt-4.1-mini", kind: "builder", x: 370, y: 490 },
    { id: "traveler", label: "Traveler agent", sub: "simulated", kind: "agent", x: 630, y: 160 },
    { id: "companion", label: "Companion agent", sub: "simulated", kind: "agent", x: 630, y: 440 },
    { id: "bridge", label: "Bridge", sub: "8 generated turns", kind: "artifact", x: 885, y: 300 },
    { id: "critic", label: "Handoff critic", sub: "gpt-4.1-mini", kind: "builder", x: 885, y: 510 },
  ],
  edges: [
    { from: "start", to: "traveler", carries: ["anchor"] },
    { from: "start", to: "planner", carries: ["anchor"] },
    { from: "end", to: "planner", carries: ["endpoint"] },
    { from: "end", to: "traveler", label: "endpoint", carries: ["endpoint"] },
    { from: "end", to: "companion", carries: ["endpoint"] },
    { from: "end", to: "critic", carries: ["endpoint"] },
    { from: "memory", to: "traveler", carries: ["memory", "persona"] },
    { from: "memory", to: "companion", carries: ["memory"] },
    { from: "planner", to: "traveler", carries: ["plan"] },
    { from: "planner", to: "companion", label: "waypoints", carries: ["plan"] },
    { from: "traveler", to: "companion", label: "turn", carries: ["message"] },
    { from: "companion", to: "traveler", carries: ["message"] },
    { from: "traveler", to: "bridge", carries: ["branch"] },
    { from: "companion", to: "bridge", carries: ["branch"] },
    { from: "bridge", to: "critic", carries: ["branch"] },
  ],
  variants: Object.fromEntries(Object.entries(PT_POLICIES).map(([id, p]) => [id, { label: p.label, beats: pathBeats({ ...p, label: p.label }) }])),
};

// ---------------------------------------------------------------------------
// 5. Script paths: one author or two agents, with model-chosen length.

const SCRIPT_TURNS = [
  ["traveler", "Sunday's close and I still haven't picked anything.", { location: "hostel common room", elapsed: "evening", event: null }],
  ["companion", "Let's list what Sunday actually requires, not what it means.", { location: "hostel common room", elapsed: "minutes", event: null }],
  ["traveler", "A bed, and some way to earn. I emailed the venue south of here.", { location: "hostel common room", elapsed: "next morning", event: "Traveler emails a venue about a gig" }],
  ["companion", "Good. While you wait, price the two cheapest ways to get there.", { location: "café", elapsed: "an hour", event: null }],
  ["traveler", "They wrote back. Friday night, if I can make it.", { location: "café", elapsed: "afternoon", event: "Venue offers a Friday slot" }],
  ["companion", "Then the question is no longer whether, only how.", { location: "café", elapsed: "minutes", event: null, done: true }],
];

const SCRIPT_VARIANTS = {
  "single-dialogue-fixed": { label: "One author · fixed 8", arch: "single", rep: "dialogue", length: "fixed" },
  "two-dialogue-adaptive": { label: "Two agents · adaptive", arch: "two", rep: "dialogue", length: "adaptive" },
  "single-timeline-adaptive": { label: "One author · timeline", arch: "single", rep: "timeline", length: "adaptive" },
  "two-dialogue-state-first": { label: "Two agents · state-first", arch: "two", rep: "dialogue", length: "adaptive", plan: true },
  "single-annotated-adaptive": { label: "One author · annotations", arch: "single", rep: "annotations", length: "adaptive" },
};

function scriptBeats(v) {
  const repCtx = v.rep === "timeline"
    ? [ctx("events", 9, "79 eligible event records"), ctx("anchor", 0.1), ctx("endpoint", 0.1)]
    : v.rep === "annotations"
      ? [ctx("history", 180, "dialogue as JSON with tags and dates"), ctx("annotation", 6, "retrospective notes (hindsight)"), ctx("anchor", 0.1), ctx("endpoint", 0.1)]
      : [ctx("history", 170, "full past dialogue"), ctx("anchor", 0.1), ctx("endpoint", 0.1)];
  const beats = [
    {
      node: "start", edges: [], role: "archive", speaker: "START and END utterances",
      text: "Both anchors are given exactly. END is reference material that has not yet been spoken.",
      context: [ctx("anchor", 0.1), ctx("endpoint", 0.1)],
      note: "No length is prescribed in adaptive conditions; a 24-turn ceiling stays in place.",
    },
  ];
  if (v.rep === "timeline") {
    beats.push({
      node: "timeline", edges: ["timeline>rep"], role: "builder", speaker: "Event extraction + review", model: "gpt-4.1-mini · claude-sonnet-4-6",
      text: "Plain events with literal evidence; a separate reviewer accepts or rejects each candidate. Only events whose whole preprocessing scope precedes the boundary are eligible.",
      context: [ctx("history", 60, "one source chunk"), ctx("instruction", 0.8)],
      note: "Dialogue texture is traded for a compact list of claims.",
    });
  }
  beats.push({
    node: "rep", edges: [], role: "system", speaker: `Representation · ${v.rep}`,
    text: v.rep === "timeline" ? "History replaced by event records." : v.rep === "annotations" ? "History plus retrospective annotations: explicitly not a blind gap." : "Full past dialogue.",
    context: repCtx,
    note: "",
  });
  if (v.plan) {
    beats.push({
      node: "planner", edges: ["rep>planner", "planner>traveler", "planner>companion"], role: "planner", speaker: "State-first contract", model: "gpt-4.1-mini",
      text: "Required transitions: a concrete work lead appears; travel cost is resolved; the move remains undecided until END.",
      context: [ctx("instruction", 0.8), ...repCtx],
      note: "An explicit contract of what must change before the ending.",
    });
  }
  const turns = v.length === "fixed" ? [...SCRIPT_TURNS, ["traveler", "I'll check the train times tonight.", { location: "café", elapsed: "evening", event: null }], ["companion", "Then we'll know what Friday costs.", { location: "café", elapsed: "minutes", event: null }]] : SCRIPT_TURNS;
  turns.forEach(([actor, text, state], i) => {
    const single = v.arch === "single";
    const done = v.length !== "fixed" && i === turns.length - 1;
    beats.push({
      node: single ? "author" : actor,
      edges: single ? (i === 0 ? ["rep>author", "author>script"] : ["author>script"]) : [`rep>${actor}`, `${actor}>script`, actor === "traveler" ? "companion>traveler" : "traveler>companion", ...(v.plan ? [`planner>${actor}`] : [])],
      role: actor, speaker: single ? (actor === "traveler" ? "Traveler (written by author)" : "Companion (written by author)") : actor === "traveler" ? "Traveler agent" : "Companion agent",
      model: "gpt-4.1-mini",
      text,
      state: { ...state, travelerKnows: i >= 4 ? ["Friday slot"] : [], companionKnows: i >= 4 ? ["Friday slot"] : [] },
      sameCall: single && i > 0,
      context: single && i > 0 ? [] : [ctx("instruction", 1.2), ...repCtx, ...(v.plan ? [ctx("plan", 0.6)] : []), ...(i ? [ctx("branch", i * 0.8)] : [])],
      note: single && i === 0 ? "One structured response writes every turn." : done ? "The model declares the handoff: END can follow." : "",
      done,
    });
  });
  beats.push({
    node: "end", edges: ["script>end"], role: "archive", speaker: "END · appended",
    text: "“Book the train south tonight. The work you need is waiting there.”",
    context: [ctx("endpoint", 0.1)],
    note: "Appended after the script. Does it still make sense, or has the bridge already enacted it?",
  });
  beats.push({
    node: "critic", edges: ["script>critic"], role: "critic", speaker: "Handoff critic", model: "gpt-4.1-mini",
    text: "Ready: the script ends where the recorded endpoint begins.",
    context: [ctx("instruction", 0.5), ctx("anchor", 0.1), ctx("branch", turns.length * 0.8), ctx("endpoint", 0.1)],
    warn: "In inspected cases, critiques tracked thematic overlap more than chronological prerequisites.",
    note: "",
  });
  return beats;
}

const scriptPaths = {
  id: "script-paths",
  title: "Script paths",
  legend: "Illustrative script with structured state. Bind a saved case for real output.",
  sampleKind: "script-path",
  nodes: [
    { id: "start", label: "START + END", sub: "exact utterances", kind: "store", x: 110, y: 90 },
    { id: "timeline", label: "Event timeline", sub: "extract → review", kind: "builder", x: 110, y: 300 },
    { id: "rep", label: "Representation", sub: "dialogue · notes · events", kind: "store", x: 330, y: 200 },
    { id: "planner", label: "State planner", sub: "transition contract", kind: "builder", x: 330, y: 430 },
    { id: "author", label: "Scriptwriter", sub: "one author, both voices", kind: "agent", x: 590, y: 90 },
    { id: "traveler", label: "Traveler agent", sub: "two-agent mode", kind: "agent", x: 590, y: 270 },
    { id: "companion", label: "Companion agent", sub: "two-agent mode", kind: "agent", x: 590, y: 460 },
    { id: "script", label: "Structured script", sub: "turn · event · place · time", kind: "artifact", x: 850, y: 270 },
    { id: "end", label: "END appended", sub: "recorded", kind: "gate", x: 850, y: 90 },
    { id: "critic", label: "Handoff critic", sub: "gpt-4.1-mini", kind: "builder", x: 850, y: 470 },
  ],
  edges: [
    { from: "timeline", to: "rep", carries: ["events"] },
    { from: "start", to: "rep", carries: ["anchor", "endpoint"] },
    { from: "rep", to: "planner", carries: ["history", "events", "annotation"] },
    { from: "rep", to: "author", carries: ["history", "events", "annotation", "anchor", "endpoint"] },
    { from: "rep", to: "traveler", carries: ["history", "events", "annotation", "anchor", "endpoint"] },
    { from: "rep", to: "companion", carries: ["history", "events", "annotation", "anchor", "endpoint"] },
    { from: "planner", to: "traveler", carries: ["plan"] },
    { from: "planner", to: "companion", carries: ["plan"] },
    { from: "planner", to: "author", carries: ["plan"] },
    { from: "traveler", to: "companion", label: "turn", carries: ["message"] },
    { from: "companion", to: "traveler", carries: ["message"] },
    { from: "author", to: "script", carries: ["branch"] },
    { from: "traveler", to: "script", carries: ["branch"] },
    { from: "companion", to: "script", carries: ["branch"] },
    { from: "script", to: "end", carries: ["endpoint"] },
    { from: "script", to: "critic", carries: ["branch"] },
  ],
  variants: Object.fromEntries(Object.entries(SCRIPT_VARIANTS).map(([id, v]) => [id, { label: v.label, beats: scriptBeats(v) }])),
};

// ---------------------------------------------------------------------------
// 6. Event extraction and semantic review.

const events = {
  id: "events",
  title: "From dialogue to plain events",
  legend: "Illustrative candidates. The private asset holds 221 reviewed events.",
  nodes: [
    { id: "sources", label: "Sources", sub: "369 messages + 2 annotations", kind: "store", x: 110, y: 300 },
    { id: "extractor", label: "Extractor", sub: "structured candidates", kind: "builder", x: 340, y: 160 },
    { id: "validator", label: "Validator", sub: "literal evidence · dates", kind: "gate", x: 340, y: 440 },
    { id: "reviewer", label: "Semantic reviewer", sub: "claude-sonnet-4-6", kind: "agent", x: 600, y: 300 },
    { id: "asset", label: "Event asset", sub: "183 reported · 38 planned", kind: "artifact", x: 860, y: 160 },
    { id: "asof", label: "As-of filter", sub: "eligible at a boundary", kind: "gate", x: 860, y: 440 },
  ],
  edges: [
    { from: "sources", to: "extractor", label: "same chunk", carries: ["history"] },
    { from: "extractor", to: "validator", carries: ["events"] },
    { from: "validator", to: "reviewer", label: "candidates", carries: ["events"] },
    { from: "sources", to: "reviewer", carries: ["history"] },
    { from: "reviewer", to: "asset", label: "accepted", carries: ["events"] },
    { from: "asset", to: "asof", carries: ["events"] },
  ],
  variants: {
    default: {
      label: "One chunk",
      beats: [
        {
          node: "sources", edges: [], role: "archive", speaker: "Source chunk",
          text: "A window of dialogue with stable source IDs and hashes.",
          context: [ctx("history", 60)],
          note: "Occurrence and disclosure are kept separate; disclosure dates never become event dates by default.",
        },
        {
          node: "extractor", edges: ["sources>extractor"], role: "builder", speaker: "Extractor", model: "gpt-4.1-mini",
          text: "Candidate A · reported: The Traveler booked a room by the water. Evidence: “booked a room by the water”.\nCandidate B · reported: The Traveler moved to the coast. Evidence: “you should move to the coast”.",
          context: [ctx("instruction", 1.2), ctx("history", 60)],
          note: "Every candidate must quote literal evidence.",
        },
        {
          node: "validator", edges: ["extractor>validator"], role: "system", speaker: "Validator",
          text: "Both quotations are literal. Dates consistent. Pass to review.",
          context: [ctx("events", 0.6)],
          note: "Literal quotation alone does not establish entailment.",
        },
        {
          node: "reviewer", edges: ["validator>reviewer", "sources>reviewer"], role: "critic", speaker: "Semantic reviewer", model: "claude-sonnet-4-6",
          text: "Accept A. Reject B: companion advice recast as the Traveler's action.",
          context: [ctx("instruction", 1), ctx("history", 60, "the same original chunk"), ctx("events", 0.6)],
          warn: "A first, lighter reviewer kept several known errors; this stricter pass removed them in spot checks.",
          note: "The reviewer partitions IDs; it cannot rewrite content.",
        },
        {
          node: "asset", edges: ["reviewer>asset"], role: "system", speaker: "Event asset",
          text: "221 primary events. 196 have unknown occurrence dates.",
          context: [ctx("events", 40)],
          note: "An inventory ordered by disclosure, not a reconciled life chronology.",
        },
        {
          node: "asof", edges: ["asset>asof"], role: "system", speaker: "As-of eligibility",
          text: "At the May 8 boundary, 79 events are eligible: their entire extraction scope precedes it.",
          context: [ctx("events", 9)],
          note: "Shared preprocessing must not leak later sources into an earlier simulation.",
        },
      ],
    },
  },
};

export const FLOWS = Object.fromEntries([loop, branch, counterfactual, pathTracing, scriptPaths, events].map((f) => [f.id, f]));
