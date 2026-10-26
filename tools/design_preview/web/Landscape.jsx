import React, { useId } from "react";
import { sceneImages } from "./scenes.js";
import "./illustration.css";

// These are static illustration studies. Edge and shadow masks are evaluated on
// the painting, never on the reading surface or its text, and never animated.
function SketchIllustration({ source, id, graphite }) {
  const ink = graphite ? [0.2, 0.21, 0.2] : [0.34, 0.24, 0.13];
  return (
    <svg className="sketch-illustration" width="100%" height="100%">
      <defs>
        <filter id={`etch-${id}`} x="0" y="0" width="100%" height="100%" colorInterpolationFilters="sRGB">
          <feColorMatrix type="saturate" values="0" result="gray" />
          <feGaussianBlur in="gray" stdDeviation="1.1" result="soft" />
          <feComposite in="soft" in2="gray" operator="arithmetic" k2="-3.2" k3="3.2" k4="1" />
          <feComponentTransfer>
            <feFuncR type="linear" slope={1 - ink[0]} intercept={ink[0]} />
            <feFuncG type="linear" slope={1 - ink[1]} intercept={ink[1]} />
            <feFuncB type="linear" slope={1 - ink[2]} intercept={ink[2]} />
          </feComponentTransfer>
        </filter>
        <filter id={`shadow-${id}`} x="0" y="0" width="100%" height="100%" colorInterpolationFilters="sRGB">
          <feColorMatrix values="0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 -.2126 -.7152 -.0722 0 1" />
          <feComponentTransfer>
            <feFuncA type="gamma" amplitude="1" exponent="2.1" offset="0" />
          </feComponentTransfer>
        </filter>
        <mask id={`hatch-shadow-${id}`} maskUnits="objectBoundingBox" maskContentUnits="userSpaceOnUse" style={{ maskType: "alpha" }}>
          <image href={source} width="100%" height="100%" preserveAspectRatio="xMidYMax slice" filter={`url(#shadow-${id})`} />
        </mask>
        <pattern id={`hatch-${id}`} patternUnits="userSpaceOnUse" width="7" height="7">
          <path d="M-1 1 1-1M0 7 7 0M6 8 8 6" fill="none" stroke="currentColor" strokeWidth=".65" />
          <path d="M0 1 6 7" fill="none" stroke="currentColor" strokeWidth=".35" opacity=".45" />
        </pattern>
      </defs>
      <image className="sketch-contours" href={source} width="100%" height="100%" preserveAspectRatio="xMidYMax slice" filter={`url(#etch-${id})`} />
      <rect className="sketch-hatching" width="100%" height="100%" fill={`url(#hatch-${id})`} mask={`url(#hatch-shadow-${id})`} />
    </svg>
  );
}

export function Traveler({ offset = true }) {
  return (
    <g
      className="traveler-position"
      transform={offset ? "translate(1290 685)" : undefined}
    >
      <g
        className="traveler"
        fill="currentColor"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      >
        <g className="traveler-body">
          <path d="M-9-80 Q-15-110-4-124 L13-120 19-82 8-65Z" />
          <path d="M-6-122 -16-97 -30-63 -13-75 2-111Z" opacity=".75" />
          <path d="M-3-126 Q-11-143 1-147 Q13-146 11-130Z" />
          <path d="M-17-145 Q1-152 22-146 L4-151 0-159-8-150Z" />
          <g className="traveler-arm">
            <path d="M8-118 23-95 42-94 43-88 19-87 3-108Z" />
            <path d="M43-92 47-160 49-160 45-92Z" />
          </g>
          <g className="traveler-leg leg-a">
            <path d="M-6-79 4-78 4-42 -8-7 -3-3 -18-3 -13-16 -7-45Z" />
          </g>
          <g className="traveler-leg leg-b">
            <path d="M5-78 14-79 22-44 23-8 32-3 17-2 14-15 10-43Z" />
          </g>
        </g>
        <path d="M-26 4 Q5 0 39 5" strokeWidth="1" opacity=".3" />
      </g>
    </g>
  );
}
function Windmill() {
  return (
    <g transform="translate(252 505)" fill="currentColor" stroke="currentColor">
      <path d="M-18 94 -13 9 Q0 0 13 9 L20 94Z" opacity=".7" />
      <path d="M-17 11 0-7 17 11Z" />
      <path d="M-3 94-3 74Q2 69 6 74V94Z" opacity=".5" />
      <g className="mill-sails">
        {[0, 90, 180, 270].map((r) => (
          <g key={r} transform={`rotate(${r})`}>
            <path d="M0 0 0-65" fill="none" strokeWidth="2" />
            <path d="M-2-15 -2-63 11-59 11-15Z" fill="none" strokeWidth="1.3" />
            <path
              d="M-2-24H11M-2-33H11M-2-42H11M-2-51H11"
              fill="none"
              strokeWidth=".8"
            />
          </g>
        ))}
        <circle r="4" />
      </g>
    </g>
  );
}
function Reeds() {
  return (
    <g
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
    >
      {[0, 1, 2, 3, 4].map((n) => (
        <g
          key={n}
          className="reed"
          style={{ animationDelay: `${n * -0.7}s` }}
          transform={`translate(${78 + n * 19} ${840 - n * 6})`}
        >
          <path d={`M0 0 Q${n % 2 ? -13 : 16}-68 ${n % 2 ? -9 : 22}-116`} />
          <path d="M2-32Q-21-43-27-65M6-51Q28-66 31-89M10-76Q-2-89-1-102" />
          <path
            d="M17-111 20-127 25-114 21-99Z"
            fill="currentColor"
            stroke="none"
          />
        </g>
      ))}
    </g>
  );
}
export default function Landscape({ settings, stopped }) {
  const id = useId().replaceAll(":", "");
  const { motion, composition, treatment, intensity, speed } = settings;
  const isSketch = treatment === "ink-sepia" || treatment === "graphite";
  return (
    <div
      className={`landscape treatment-${treatment} composition-${composition} motion-${motion} ${stopped ? "is-still" : ""}`}
      style={{ "--motion-intensity": intensity, "--motion-speed": speed }}
      aria-hidden="true"
    >
      <img
        className="landscape-painting"
        src={sceneImages[settings.scene]}
        alt=""
        draggable="false"
      />
      {isSketch && <SketchIllustration source={sceneImages[settings.scene]} id={id} graphite={treatment === "graphite"} />}
      {isSketch && <div className="illustration-paper" />}
      <div className="atmosphere-layer">
        <div className="cloud cloud-one" />
        <div className="cloud cloud-two" />
        <div className="mist" />
      </div>
      <svg
        className="illustration-layer"
        viewBox="0 0 1600 900"
        preserveAspectRatio="xMidYMax slice"
      >
        <defs>
          <filter id={`paper-${id}`}>
            <feTurbulence
              type="fractalNoise"
              baseFrequency=".2"
              numOctaves="2"
              seed="4"
            />
            <feColorMatrix type="saturate" values="0" />
            <feComponentTransfer>
              <feFuncA type="linear" slope=".08" />
            </feComponentTransfer>
            <feBlend in="SourceGraphic" mode="multiply" />
          </filter>
        </defs>
        <g className="vegetation-layer">
          <Reeds />
          <g transform="translate(1600 0) scale(-1 1)">
            <Reeds />
          </g>
        </g>
        <g className="windmill-layer">
          <Windmill />
        </g>
        <g className="traveler-layer" filter={`url(#paper-${id})`}>
          <Traveler />
        </g>
      </svg>
      <div className="landscape-grain" />
    </div>
  );
}
