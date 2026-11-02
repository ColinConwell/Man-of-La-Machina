import * as Tone from "tone";
import type { Effect, Layer, Lane, Recipe, Sample } from "./types";
import { audioUrl } from "./api";

export function valueAt(lane: Lane | undefined, t: number, base: number) {
  if (!lane?.points.length) return base;
  const points = lane.points;
  let v = points[0].value;
  for (let i = 0; i < points.length; i++) {
    if (points[i].time > t) break;
    v = points[i].value;
    if (
      lane.interpolation === "linear" &&
      points[i + 1] &&
      t < points[i + 1].time
    ) {
      const b = points[i + 1];
      v += ((b.value - v) * (t - points[i].time)) / (b.time - points[i].time);
      break;
    }
  }
  return base + lane.depth * (v - base);
}
function makeEffect(e: Effect): any {
  const p = e.params as Record<string, number>;
  switch (e.kind) {
    case "chorus":
      return new Tone.Chorus({
        frequency: p.rate,
        depth: p.depth,
        wet: p.mix,
      }).start();
    case "vibrato":
      return new Tone.Vibrato({
        frequency: p.rate,
        depth: Math.min(1, p.depth / 0.008),
      });
    case "tremolo":
      return new Tone.Tremolo({ frequency: p.rate, depth: p.depth }).start();
    case "phaser":
      return new Tone.Phaser({
        frequency: p.rate,
        octaves: p.depth * 5,
        wet: p.mix,
      });
    case "delay":
      return new Tone.FeedbackDelay({
        delayTime: p.seconds,
        feedback: p.feedback,
        wet: p.mix,
        maxDelay: 2,
      });
    case "reverb":
      return new Tone.Freeverb({
        roomSize: p.size,
        dampening: 500 + 10000 * (1 - p.damping),
        wet: p.mix,
      });
    case "lowpass":
      return new Tone.Filter({
        frequency: p.frequency,
        type: "lowpass",
        rolloff: -12,
      });
    case "highpass":
      return new Tone.Filter({
        frequency: p.frequency,
        type: "highpass",
        rolloff: -12,
      });
    case "eq":
      return new Tone.Filter({
        frequency: p.frequency,
        type: "peaking",
        gain: p.gain,
        Q: p.q,
      });
    case "distortion":
      return new Tone.Distortion({
        distortion: Math.min(1, p.drive / 36),
        wet: p.mix,
      });
    case "bitcrush":
      return new Tone.BitCrusher(p.bits);
    case "compressor":
      return new Tone.Compressor({
        threshold: p.threshold,
        ratio: p.ratio,
        attack: p.attack / 1000,
        release: p.release / 1000,
      });
    case "limiter":
      return new Tone.Limiter(p.threshold);
    default:
      throw new Error("Render required for " + e.kind);
  }
}
function setParam(node: any, key: string, value: number) {
  const target = node[key];
  if (target && typeof target === "object" && "value" in target) {
    if (typeof target.rampTo === "function") target.rampTo(value, 0.03);
    else target.value = value;
  } else node[key] = value;
}
function updateEffect(
  node: any,
  e: Effect,
  time: number,
  evaluate: typeof valueAt = valueAt,
) {
  const values = { ...e.params } as Record<string, number>;
  for (const lane of e.automation)
    values[lane.parameter] = evaluate(lane, time, values[lane.parameter]);
  const mapping: Record<string, string> = {
    rate: "frequency",
    depth: "depth",
    mix: "wet",
    seconds: "delayTime",
    feedback: "feedback",
    size: "roomSize",
    frequency: "frequency",
    gain: "gain",
    q: "Q",
    bits: "bits",
    threshold: "threshold",
    ratio: "ratio",
  };
  for (const [key, val] of Object.entries(values)) {
    if (key === "mix" && e.kind === "bitcrush") continue;
    if (key === "drive") setParam(node, "distortion", val / 36);
    else if (key === "damping")
      setParam(node, "dampening", 500 + 10000 * (1 - val));
    else if (key === "attack" || key === "release")
      setParam(node, key, val / 1000);
    else if (key === "depth" && e.kind === "vibrato")
      setParam(node, "depth", val / 0.008);
    else if (key === "depth" && e.kind === "phaser")
      setParam(node, "octaves", val * 5);
    else if (mapping[key]) setParam(node, mapping[key], val);
  }
}
export class AudioEngine {
  nodes: any[] = [];
  players: Tone.Player[] = [];
  racks = new Map<string, { node: any; gate: Tone.CrossFade }>();
  tracks = new Map<string, { gain: Tone.Gain; pan: Tone.Panner }>();
  meter: Tone.Meter | null = null;
  inputMeter: Tone.Meter | null = null;
  master: Tone.Gain | null = null;
  generation = 0;
  smoothing = new Map<string, { time: number; value: number }>();
  smooth(id: string, lane: Lane | undefined, time: number, base: number) {
    const target = valueAt(lane, time, base),
      key = id + ":" + (lane?.parameter || "base"),
      previous = this.smoothing.get(key);
    const coefficient =
      previous && lane?.smoothing && time >= previous.time
        ? 1 - Math.exp(-(time - previous.time) / lane.smoothing)
        : 1;
    const value = previous
      ? previous.value + coefficient * (target - previous.value)
      : target;
    this.smoothing.set(key, { time, value });
    return value;
  }
  recipe: Recipe | null = null;
  dry = false;
  running = false;
  interval: number | undefined;
  clock = 0;
  startAt = 0;
  offset = 0;
  async play(recipe: Recipe, samples: Sample[], position = 0, dry = false) {
    this.stop();
    const generation = this.generation;
    await Tone.start();
    if (generation !== this.generation) return;
    this.recipe = recipe;
    this.dry = dry;
    const layers = recipe.layers.filter(
      (l) => !l.mute && (!recipe.layers.some((x) => x.solo) || l.solo),
    );
    if (!layers.length) throw new Error("Add an audible voice layer first.");
    if (
      !dry &&
      layers.some((l) =>
        l.effects.some(
          (e) =>
            e.enabled && ["pitch", "stretch", "convolution"].includes(e.kind),
        ),
      )
    )
      throw new Error(
        "This recipe includes render-only effects. Render Mix to hear the complete result, or choose Dry to hear the originals.",
      );
    this.master = new Tone.Gain(Tone.dbToGain(recipe.master_gain));
    this.nodes.push(this.master);
    const limiter = new Tone.Limiter(-1);
    this.nodes.push(limiter);
    this.meter = new Tone.Meter();
    this.inputMeter = new Tone.Meter();
    this.nodes.push(this.meter, this.inputMeter);
    this.master.connect(this.inputMeter);
    const output = recipe.limiter ? this.master.connect(limiter) : this.master;
    (recipe.limiter ? limiter : this.master).connect(this.meter);
    (recipe.limiter ? limiter : this.master).toDestination();
    const loaded = await Promise.all(
      layers.map(async (l) => {
        if (!samples.find((s) => s.id === l.sample_id)?.local)
          throw new Error("Download the layer audio before playback.");
        const player = new Tone.Player({
          fadeIn: l.fade_in,
          fadeOut: l.fade_out,
        });
        this.nodes.push(player);
        this.players.push(player);
        await player.load(audioUrl(l.sample_id));
        return { layer: l, player };
      }),
    );
    if (generation !== this.generation) return;
    const start = Tone.now() + 0.08;
    this.startAt = start;
    this.offset = position;
    this.running = true;
    for (const { layer, player } of loaded) {
      let last: any = player;
      if (!dry)
        for (const e of layer.effects) {
          if (!e.enabled) continue;
          const fx = makeEffect(e);
          const gate = new Tone.CrossFade(1);
          this.nodes.push(fx, gate);
          last.connect(gate.a);
          last.connect(fx);
          fx.connect(gate.b);
          last = gate;
          this.racks.set(e.id, { node: fx, gate });
        }
      const gain = new Tone.Gain(Tone.dbToGain(layer.gain));
      const pan = new Tone.Panner(layer.pan);
      this.nodes.push(gain, pan);
      this.tracks.set(layer.id, { gain, pan });
      last.connect(gain);
      gain.connect(pan);
      pan.connect(this.master!);
      const seek = Math.max(0, position - layer.offset);
      if (seek < player.buffer.duration)
        player.start(start + Math.max(0, layer.offset - position), seek);
    }
    this.update(recipe);
    this.interval = window.setInterval(() => this.update(this.recipe!), 30);
  }
  get time() {
    return this.running
      ? Math.max(0, Tone.now() - this.startAt) + this.offset
      : this.clock;
  }
  get levels() {
    const v = this.meter?.getValue(),
      i = this.inputMeter?.getValue();
    return {
      output: typeof v === "number" ? v : -60,
      input: typeof i === "number" ? i : -60,
    };
  }
  update(recipe: Recipe) {
    this.recipe = recipe;
    const t = this.time;
    if (this.master)
      this.master.gain.rampTo(Tone.dbToGain(recipe.master_gain), 0.03);
    for (const l of recipe.layers) {
      const track = this.tracks.get(l.id);
      if (!track) continue;
      const audible = !l.mute && (!recipe.layers.some((x) => x.solo) || l.solo);
      const local = t - l.offset;
      track.gain.gain.rampTo(
        audible
          ? Tone.dbToGain(
              this.smooth(
                l.id,
                l.automation.find((a) => a.parameter === "gain"),
                local,
                l.gain,
              ),
            )
          : 0,
        0.03,
      );
      track.pan.pan.rampTo(
        this.smooth(
          l.id,
          l.automation.find((a) => a.parameter === "pan"),
          local,
          l.pan,
        ),
        0.03,
      );
      for (const e of l.effects) {
        const rack = this.racks.get(e.id);
        if (!rack) continue;
        updateEffect(rack.node, e, local, (lane, time, base) =>
          this.smooth(e.id, lane, time, base),
        );
        rack.gate.fade.rampTo(
          e.enabled && local >= e.start && (e.end === null || local < e.end)
            ? e.kind === "bitcrush"
              ? valueAt(
                  e.automation.find((a) => a.parameter === "mix"),
                  local,
                  Number(e.params.mix),
                )
              : 1
            : 0,
          0.02,
        );
      }
    }
  }
  stop() {
    this.generation++;
    this.clock = this.time;
    this.running = false;
    window.clearInterval(this.interval);
    for (const n of this.nodes) n.dispose();
    this.nodes = [];
    this.players = [];
    this.racks.clear();
    this.smoothing.clear();
    this.tracks.clear();
    this.meter = null;
    this.inputMeter = null;
    this.master = null;
  }
}
