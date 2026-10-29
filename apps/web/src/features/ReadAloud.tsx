import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Headphones,
  ChevronDown,
  ChevronUp,
  Pause,
  Play,
  SkipBack,
  SkipForward,
  Volume2,
} from "lucide-react";
import { api, post } from "../api";
export type SpokenMessage = {
  id: string;
  body: string;
  label: string;
  branch_id?: string;
};
type Clip = {
  id: string;
  status: "generating" | "ready" | "failed";
  error: string | null;
  parts: string[];
};
type Capabilities = {
  available: boolean;
  voices: string[];
  session_characters_per_hour: number;
  retention_seconds: number;
};
const timeLabel = (n: number) =>
  `${Math.floor(n / 60)}:${String(Math.floor(n % 60)).padStart(2, "0")}`;
export function ReadAloud({
  messages,
  scope,
}: {
  messages: SpokenMessage[];
  scope: string;
}) {
  const capabilities = useQuery({
    queryKey: ["narration-capabilities"],
    queryFn: () => api<Capabilities>("/narration/capabilities"),
  });
  const audio = useRef<HTMLAudioElement>(null);
  const [panelSize, setPanelSize] = useState<0 | 1 | 2>(0);
  const panelToggle = useRef<HTMLButtonElement>(null);
  const resizePanel = (size: 0 | 1 | 2) => {
    setPanelSize(size);
    requestAnimationFrame(() =>
      panelToggle.current?.focus({ preventScroll: true }),
    );
  };
  const [voice, setVoice] = useState("cedar");
  const [index, setIndex] = useState(0);
  const [active, setActive] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [clips, setClips] = useState<Record<string, Clip>>({});
  const [part, setPart] = useState(0);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [speed, setSpeed] = useState(1);
  const [volume, setVolume] = useState(1);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [requesting, setRequesting] = useState(false);
  const wanted = useRef(false);
  const previousLast = useRef("");
  const queue = useRef(messages);
  queue.current = messages;
  const message = messages[index];
  const key = message
    ? `${message.branch_id || "history"}:${message.id}:${voice}`
    : "";
  const clip = clips[key];
  const src = clip?.status === "ready" ? clip.parts[part] : undefined;
  const stop = () => {
    wanted.current = false;
    setActive(false);
    audio.current?.pause();
    setPlaying(false);
    setRequesting(false);
  };
  useEffect(() => {
    stop();
    setIndex(0);
    setPart(0);
    setProgress(0);
    setDuration(0);
    setError("");
    setRequesting(false);
    previousLast.current = "";
  }, [scope]);
  useEffect(
    () => () => {
      wanted.current = false;
      audio.current?.pause();
    },
    [],
  );
  useEffect(() => {
    if (index >= messages.length && messages.length) {
      stop();
      setIndex(0);
      setPart(0);
    }
    const last = messages.at(-1);
    if (
      last &&
      previousLast.current &&
      last.id !== previousLast.current &&
      last.branch_id &&
      active
    ) {
      if (requesting || clip?.status === "generating") return;
      setIndex(messages.length - 1);
      setPart(0);
      wanted.current = true;
    }
    previousLast.current = last?.id || "";
  }, [messages, active, requesting, clip?.status]);
  useEffect(() => {
    setPart(0);
    setProgress(0);
    setDuration(0);
    setError("");
    setRequesting(false);
  }, [key]);
  useEffect(() => {
    if (
      !active ||
      !wanted.current ||
      !message ||
      clip?.status === "ready" ||
      clip?.status === "generating"
    )
      return;
    let alive = true;
    setRequesting(true);
    setError("");
    post<Clip>("/narration", {
      message_id: message.id,
      branch_id: message.branch_id,
      voice,
    })
      .then((result) => {
        if (alive) setClips((old) => ({ ...old, [key]: result }));
      })
      .catch((e) => {
        if (alive) {
          setError(e.message);
          stop();
        }
      })
      .finally(() => {
        if (alive) setRequesting(false);
      });
    return () => {
      alive = false;
    };
  }, [active, key]);
  useEffect(() => {
    if (clip?.status !== "generating") return;
    let alive = true;
    let timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      try {
        const result = await api<Clip>("/narration/" + clip.id);
        if (!alive) return;
        setClips((old) => ({ ...old, [key]: result }));
        if (result.status === "generating") timer = setTimeout(poll, 650);
        if (result.status === "failed") {
          setError(result.error || "Narration failed.");
          stop();
        }
      } catch (e) {
        if (alive) {
          setError((e as Error).message);
          setClips((old) => {
            const next = { ...old };
            delete next[key];
            return next;
          });
          stop();
        }
      }
    };
    timer = setTimeout(poll, 500);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [key, clip?.id, clip?.status]);
  useEffect(() => {
    const player = audio.current;
    if (!player) return;
    player.playbackRate = speed;
    player.volume = volume;
  }, [speed, volume, src]);
  useEffect(() => {
    if (!src || !audio.current) return;
    setLoading(true);
    if (wanted.current)
      void audio.current.play().catch(() => {
        setError("Audio is ready. Press Play to start playback.");
        stop();
      });
  }, [src]);
  function choose(next: number) {
    audio.current?.pause();
    setPlaying(false);
    setIndex(next);
    setPart(0);
    setProgress(0);
    wanted.current = active;
  }
  function playPause() {
    if (active) {
      stop();
      return;
    }
    wanted.current = true;
    setActive(true);
    setError("");
    if (src && audio.current)
      void audio.current.play().catch(() => {
        setError("Playback could not start. Please try again.");
        stop();
      });
  }
  async function clearAudio() {
    stop();
    setRequesting(false);
    try {
      await api("/narration", { method: "DELETE" });
      setClips({});
      setProgress(0);
      setDuration(0);
      setError("Saved audio deleted from this session.");
    } catch (e) {
      setError((e as Error).message);
    }
  }
  const status =
    requesting || clip?.status === "generating"
      ? "Generating"
      : clip?.status === "failed"
        ? "Failed"
        : loading && src
          ? "Loading"
          : clip?.status === "ready"
            ? "Ready"
            : "Not Generated";
  return (
    <section
      className="read-aloud"
      data-size={panelSize}
      aria-label="Read Aloud"
    >
      {panelSize < 2 ? (
        <div className="audio-size-controls">
          {panelSize === 1 && (
            <button
              type="button"
              aria-label="Expand Read Aloud"
              title="Expand Read Aloud"
              onClick={() => resizePanel(0)}
            >
              <ChevronUp size={16} />
            </button>
          )}
          <button
            ref={panelToggle}
            type="button"
            aria-label={
              panelSize === 0
                ? "Minimize Read Aloud"
                : "Minimize Read Aloud to Tab"
            }
            title={
              panelSize === 0
                ? "Minimize Read Aloud"
                : "Minimize Read Aloud to Tab"
            }
            onClick={() => resizePanel(panelSize === 0 ? 1 : 2)}
          >
            <ChevronDown size={16} />
          </button>
        </div>
      ) : (
        <button
          ref={panelToggle}
          className="audio-restore-tab"
          aria-label="Restore Read Aloud Controls"
          title={`Read Aloud · ${active ? "Active" : "Paused"} · ${error || status}`}
          onClick={() => resizePanel(1)}
        >
          <Headphones size={15} /> Read Aloud{" "}
          {active && <span className="audio-active-dot" aria-label="Active" />}
          <ChevronUp size={14} />
        </button>
      )}
      {panelSize > 0 && (
        <span className="sr-only" role="status">
          {error || status}
        </span>
      )}
      <div
        className="audio-full-fold"
        aria-hidden={panelSize > 0}
        inert={panelSize > 0}
      >
        <div>
          <div className="audio-heading">
            <h2>
              <Headphones size={18} /> Read Aloud
            </h2>
            <span role="status">
              Message {messages.length ? index + 1 : 0} of {messages.length} ·{" "}
              {status}
            </span>
            <label>
              Voice{" "}
              <select
                aria-label="Narrator Voice"
                value={voice}
                onChange={(e) => {
                  stop();
                  setVoice(e.target.value);
                  setPart(0);
                  setRequesting(false);
                }}
              >
                <option value="cedar">Cedar</option>
                <option value="marin">Marin</option>
              </select>
            </label>
          </div>
          <div className="audio-messages" aria-label="Message Audio States">
            {messages.map((m, i) => {
              const c = clips[`${m.branch_id || "history"}:${m.id}:${voice}`];
              return (
                <button
                  key={m.id}
                  aria-current={i === index ? "step" : undefined}
                  aria-label={`Read message ${i + 1}: ${m.label}`}
                  onClick={() => choose(i)}
                >
                  <span>{String(i + 1).padStart(2, "0")}</span>
                  <small>
                    {c?.status === "ready"
                      ? "Ready"
                      : c?.status === "generating"
                        ? "Generating"
                        : c?.status === "failed"
                          ? "Failed"
                          : "Not Generated"}
                  </small>
                </button>
              );
            })}
          </div>
        </div>
      </div>
      <div
        className="audio-controls-fold"
        aria-hidden={panelSize === 2}
        inert={panelSize === 2}
      >
        <div>
          <div className="audio-controls">
            <button
              aria-label="Previous Message"
              disabled={!index}
              onClick={() => choose(index - 1)}
            >
              <SkipBack size={18} />
            </button>
            <button
              className="audio-play"
              aria-label={active ? "Pause Read Aloud" : "Play Read Aloud"}
              disabled={!message || !capabilities.data?.available}
              onClick={playPause}
            >
              {active ? <Pause size={19} /> : <Play size={19} />}
            </button>
            <button
              aria-label="Next Message"
              disabled={index >= messages.length - 1}
              onClick={() => choose(index + 1)}
            >
              <SkipForward size={18} />
            </button>
            <span>{timeLabel(progress)}</span>
            <input
              aria-label="Within-Message Progress"
              type="range"
              min={0}
              max={duration || 1}
              step={0.1}
              value={Math.min(progress, duration || 1)}
              disabled={!src || !duration}
              onChange={(e) => {
                if (audio.current)
                  audio.current.currentTime = Number(e.target.value);
                setProgress(Number(e.target.value));
              }}
            />
            <span>{timeLabel(duration)}</span>
            <select
              aria-label="Playback Speed"
              value={speed}
              onChange={(e) => setSpeed(Number(e.target.value))}
            >
              {[0.75, 1, 1.25, 1.5, 2].map((v) => (
                <option value={v} key={v}>
                  {v}×
                </option>
              ))}
            </select>
            <Volume2 size={16} />
            <input
              className="audio-volume"
              aria-label="Volume"
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={volume}
              onChange={(e) => setVolume(Number(e.target.value))}
            />
          </div>
        </div>
      </div>
      <audio
        ref={audio}
        src={src}
        preload="metadata"
        onLoadedMetadata={(e) => {
          setDuration(
            Number.isFinite(e.currentTarget.duration)
              ? e.currentTarget.duration
              : 0,
          );
          setLoading(false);
        }}
        onWaiting={() => setLoading(true)}
        onPlaying={() => {
          setPlaying(true);
          setLoading(false);
        }}
        onPause={() => setPlaying(false)}
        onTimeUpdate={(e) => setProgress(e.currentTarget.currentTime)}
        onError={() => {
          setLoading(false);
          setError("Audio could not load. Delete saved audio and retry.");
          stop();
        }}
        onEnded={() => {
          if (!wanted.current) return;
          if (clip && part < clip.parts.length - 1) setPart(part + 1);
          else if (index < queue.current.length - 1) choose(index + 1);
          else {
            setPlaying(
              false,
            ); /* Remain active to narrate a completed new branch reply. */
          }
        }}
      />
      <div
        className="audio-full-fold"
        aria-hidden={panelSize > 0}
        inert={panelSize > 0}
      >
        <div>
          <div className="audio-note">
            <span>
              {playing ? "Playing · " : ""}
              {message?.label}
              {clip && clip.parts.length > 1
                ? ` · Part ${part + 1} of ${clip.parts.length}`
                : ""}
            </span>
            <button onClick={clearAudio}>Delete Session Audio</button>
          </div>
          <details className="audio-disclosure">
            <summary>AI Voice · Privacy & Limits</summary>
            <p>
              Play sends the selected message to OpenAI for AI-generated
              narration. While Read Aloud is active, it continues through the
              displayed messages and newly completed branch replies. Pause stops
              automatic narration. Audio stays in this server session for up to{" "}
              {Math.round(
                (capabilities.data?.retention_seconds || 7200) / 3600,
              )}{" "}
              hours, or until deletion or server restart. Resetting a branch
              also deletes its audio. OpenAI’s data policies apply to
              processing. This session can generate up to{" "}
              {capabilities.data?.session_characters_per_hour?.toLocaleString() ||
                "24,000"}{" "}
              characters per hour. Deleting audio does not reset that allowance.
            </p>
          </details>
          {capabilities.data && !capabilities.data.available && (
            <p role="status">Read Aloud is not configured on this server.</p>
          )}
          {capabilities.isError && (
            <p role="alert">Could not check narration availability.</p>
          )}
          {error && <p role="status">{error}</p>}
        </div>
      </div>
    </section>
  );
}
