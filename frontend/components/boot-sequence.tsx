"use client";

import { useEffect, useState, useSyncExternalStore } from "react";

const LINES = [
  "SYSTEM INITIALIZING...",
  "SECURITY BREACH DETECTED",
  "MASTER CODE: MISSING",
  "RECRUITING INVESTIGATORS",
  "DIGIHUNT ONLINE",
];

const LINE_DELAY_MS = 300; // gap between lines appearing
const HOLD_MS = 600; // pause after the last line before fading out
const FADE_MS = 300; // css transition duration, kept in sync with the class below

const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

function subscribeReducedMotion(onStoreChange: () => void) {
  const media = window.matchMedia(REDUCED_MOTION_QUERY);
  media.addEventListener("change", onStoreChange);
  return () => media.removeEventListener("change", onStoreChange);
}

function getReducedMotionSnapshot() {
  return window.matchMedia(REDUCED_MOTION_QUERY).matches;
}

function getReducedMotionServerSnapshot() {
  return false;
}

export function BootSequence() {
  const reduceMotion = useSyncExternalStore(
    subscribeReducedMotion,
    getReducedMotionSnapshot,
    getReducedMotionServerSnapshot,
  );
  const [dismissed, setDismissed] = useState(false);
  const [lineCount, setLineCount] = useState(0);
  const [fading, setFading] = useState(false);

  useEffect(() => {
    if (reduceMotion) {
      return;
    }

    const timers: ReturnType<typeof setTimeout>[] = [];
    LINES.forEach((_, i) => {
      timers.push(
        setTimeout(() => setLineCount(i + 1), i * LINE_DELAY_MS)
      );
    });
    const totalReveal = LINES.length * LINE_DELAY_MS;
    timers.push(setTimeout(() => setFading(true), totalReveal + HOLD_MS));
    timers.push(
      setTimeout(() => setDismissed(true), totalReveal + HOLD_MS + FADE_MS)
    );

    return () => timers.forEach(clearTimeout);
  }, [reduceMotion]);

  function skip() {
    setDismissed(true);
  }

  if (reduceMotion || dismissed) return null;

  return (
    <div
      role="dialog"
      aria-label="Boot sequence"
      onClick={skip}
      className={`fixed inset-0 z-50 flex cursor-pointer flex-col items-center justify-center gap-3 bg-background px-6 transition-opacity duration-300 ${
        fading ? "opacity-0" : "opacity-100"
      }`}
    >
      <div className="font-mono-data text-sm text-primary sm:text-base">
        {LINES.slice(0, lineCount).map((line) => (
          <p key={line} className="glow-cyan py-0.5">
            {"> "}
            {line}
          </p>
        ))}
      </div>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          skip();
        }}
        className="mt-6 rounded-md border border-border px-4 py-1.5 font-mono-data text-xs uppercase tracking-widest text-muted-foreground outline-none hover:border-primary hover:text-primary focus:ring-2 focus:ring-ring"
      >
        Skip
      </button>
    </div>
  );
}
