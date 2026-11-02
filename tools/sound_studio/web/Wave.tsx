import { useEffect, useRef, useState } from "react";
import WaveSurfer from "wavesurfer.js";
import type { Sample } from "./types";
export function Wave({
  sample,
  time,
  color = "var(--accent)",
  onSeek,
}: {
  sample: Sample;
  time: number;
  color?: string;
  onSeek: (time: number) => void;
}) {
  const ref = useRef<HTMLDivElement>(null),
    wave = useRef<WaveSurfer | null>(null);
  const seek = useRef(onSeek);
  seek.current = onSeek;
  useEffect(() => {
    if (!ref.current) return;
    const w = WaveSurfer.create({
      container: ref.current,
      height: 76,
      waveColor: color,
      progressColor: "#934d53",
      cursorColor: "#934d53",
      cursorWidth: 1,
      peaks: [sample.peaks],
      duration: sample.duration,
      interact: true,
      normalize: false,
    });
    wave.current = w;
    w.on("interaction", (t) => seek.current(t));
    return () => {
      w.destroy();
      wave.current = null;
    };
  }, [sample.id, sample.duration, color]);
  useEffect(() => {
    if (wave.current && sample.duration)
      wave.current.seekTo(Math.min(1, Math.max(0, time / sample.duration)));
  }, [time, sample.duration]);
  return (
    <div
      ref={ref}
      className="wave"
      aria-label={`Waveform of ${sample.title}`}
    />
  );
}
export function Spectrogram({ sample }: { sample: Sample }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    let alive = true;
    async function draw() {
      try {
        const response = await fetch(
          `/api/sound/v1/samples/${sample.id}/spectrogram`,
        );
        if (!response.ok) throw new Error("Could not compute spectrogram");
        const data = await response.json();
        if (!alive || !ref.current) return;
        const c = ref.current,
          ctx = c.getContext("2d")!;
        c.width = data.width;
        c.height = data.height;
        const pixels = ctx.createImageData(c.width, c.height);
        data.values.forEach((v: number, i: number) => {
          pixels.data[i * 4] = 80 + v * 170;
          pixels.data[i * 4 + 1] = 40 + v * 170;
          pixels.data[i * 4 + 2] = 60 + v * 130;
          pixels.data[i * 4 + 3] = 255;
        });
        ctx.putImageData(pixels, 0, 0);
      } catch (e) {
        if (alive) setError(String(e));
      }
    }
    draw();
    return () => {
      alive = false;
    };
  }, [sample.id]);
  return (
    <figure>
      <canvas ref={ref} aria-label="Measured audio spectrogram" />
      <figcaption>
        {error ||
          "Measured spectrum · time → · frequency increases upward (0–12 kHz)"}
      </figcaption>
    </figure>
  );
}
