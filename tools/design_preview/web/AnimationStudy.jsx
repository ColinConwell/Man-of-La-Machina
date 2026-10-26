import React, { useEffect, useRef, useState } from "react";
import { Rive, RuntimeLoader, Layout, Fit, Alignment } from "@rive-app/canvas";
import wasmUrl from "@rive-app/canvas/rive.wasm?url";
import riveUrl from "./assets/trials/traveler-rive.riv?url";
import posterUrl from "./assets/trials/traveler-rive-poster.png";
import lottie from "lottie-web/build/player/lottie_light.js";
import lottieData from "./assets/trials/traveler-lottie.json";
import { Pause, Play, X } from "lucide-react";
import { Traveler } from "./Landscape.jsx";
RuntimeLoader.setWasmUrl(wasmUrl);

function RiveTraveler({ stopped }) {
  const canvas = useRef(null);
  const instance = useRef(null);
  const [state, setState] = useState("loading");
  const stoppedRef = useRef(stopped);
  stoppedRef.current = stopped;
  useEffect(() => {
    let alive = true;
    const rive = new Rive({
      src: riveUrl,
      canvas: canvas.current,
      artboard: "Man of La Machina - Traveler Study",
      animations: "Traveler Walk",
      autoplay: !stoppedRef.current,
      layout: new Layout({ fit: Fit.Contain, alignment: Alignment.Center }),
      onLoad: () => {
        if (!alive) return;
        rive.resizeDrawingSurfaceToCanvas();
        if (stoppedRef.current) rive.pause();
        setState("ready");
      },
      onLoadError: () => {
        if (alive) setState("failed");
      },
    });
    instance.current = rive;
    const resize = new ResizeObserver(() =>
      rive.resizeDrawingSurfaceToCanvas(),
    );
    resize.observe(canvas.current);
    return () => {
      alive = false;
      resize.disconnect();
      rive.cleanup();
      instance.current = null;
    };
  }, []);
  useEffect(() => {
    if (state === "ready") {
      if (stopped) instance.current?.pause();
      else instance.current?.play("Traveler Walk");
    }
  }, [stopped, state]);
  return (
    <div className="rive-trial-frame">
      <canvas
        ref={canvas}
        aria-label="Original Rive Traveler Walking Animation"
        style={{ opacity: state === "ready" ? 1 : 0 }}
      />
      {state !== "ready" && (
        <img src={posterUrl} alt="Static Rive Traveler Fallback" />
      )}
      <span className="trial-runtime-status" role="status">
        {state === "ready"
          ? stopped
            ? "Rive · Paused"
            : "Rive · Playing"
          : state === "failed"
            ? "Rive could not load · Static fallback"
            : "Loading local Rive runtime…"}
      </span>
    </div>
  );
}
function LottieTraveler({ stopped }) {
  const container = useRef(null);
  const instance = useRef(null);
  const stoppedRef = useRef(stopped);
  stoppedRef.current = stopped;
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let alive = true;
    const animation = lottie.loadAnimation({
      container: container.current,
      renderer: "svg",
      loop: true,
      autoplay: !stoppedRef.current,
      animationData: structuredClone(lottieData),
      rendererSettings: { preserveAspectRatio: "xMidYMid meet" },
    });
    instance.current = animation;
    const loaded = () => {
      if (!alive) return;
      if (stoppedRef.current) animation.pause();
      setReady(true);
    };
    animation.addEventListener("DOMLoaded", loaded);
    if (animation.isLoaded) loaded();
    return () => {
      alive = false;
      animation.destroy();
      instance.current = null;
    };
  }, []);
  useEffect(() => {
    if (stopped) instance.current?.pause();
    else instance.current?.play();
  }, [stopped]);
  return (
    <div className="lottie-trial-frame">
      <div
        ref={container}
        role="img"
        aria-label="Original Lottie Traveler Walking Animation"
      />
      <span className="trial-runtime-status" role="status">
        {ready
          ? `Lottie · ${stopped ? "Paused" : "Playing"}`
          : "Loading local Lottie animation…"}
      </span>
    </div>
  );
}
export default function AnimationStudy({
  onClose,
  paused,
  onTogglePause,
  policy,
}) {
  const dialog = useRef(null);
  const stopped = paused || policy.hidden || policy.reduced;
  useEffect(() => {
    const previous = document.activeElement;
    dialog.current?.showModal();
    return () => previous?.focus();
  }, []);
  return (
    <dialog
      ref={dialog}
      className="animation-study"
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      aria-labelledby="animation-study-title"
    >
      <div className="trial-heading">
        <div>
          <h2 id="animation-study-title">The Articulated Traveler</h2>
          <p>Native, Rive & Lottie · Two-Second Walking Loops</p>
        </div>
        <button
          type="button"
          className="icon-button"
          aria-label="Close Animation Study"
          onClick={onClose}
        >
          <X size={19} />
        </button>
      </div>
      <div className="trial-comparison">
        <section>
          <h3>Native CSS & SVG</h3>
          <div
            className={`native-trial-frame ${stopped ? "is-still" : ""}`}
            style={{ "--motion-speed": 1, "--motion-intensity": 1 }}
          >
            <svg
              viewBox="-55 -175 130 200"
              aria-label="Original SVG Traveler Walking Animation"
              role="img"
            >
              <Traveler offset={false} />
            </svg>
            <span className="trial-runtime-status">
              SVG · {stopped ? "Paused" : "Playing"}
            </span>
          </div>
          <p>
            Individual limbs rotate around joints. The silhouette remains
            editable directly in the interface source.
          </p>
        </section>
        <section>
          <h3>Rive</h3>
          <RiveTraveler stopped={stopped} />
          <p>
            A separately authored cutout rig with keyframed legs, body, cloak
            and staff. Player, WASM and artwork are served locally.
          </p>
        </section>
        <section>
          <h3>Lottie Creator</h3>
          <LottieTraveler stopped={stopped} />
          <p>
            The same cutout drawing as Rive, with an opposing leg cycle authored
            in Lottie Creator. Easing and secondary movement differ.
          </p>
        </section>
      </div>
      <div className="trial-footer">
        <p>
          {policy.reduced
            ? "Your reduced-motion setting keeps all three studies still."
            : "These compare a walking action, with different rigs and timing details. The native drawing differs; none recreates the unavailable 1965 reference."}
        </p>
        <button
          type="button"
          className="panel-button"
          onClick={onTogglePause}
          aria-pressed={paused}
        >
          {paused ? <Play size={14} /> : <Pause size={14} />}{" "}
          {paused ? "Resume All" : "Pause All"}
        </button>
      </div>
    </dialog>
  );
}
