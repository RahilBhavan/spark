"use client";

/**
 * Full-screen subtle noise/grain overlay for a cinematic, tactile feel.
 * Fixed position, pointer-events: none, so it doesn't block interaction.
 */
const GRAIN_SVG = `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100%25' height='100%25'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E`;

export function GrainOverlay() {
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 z-[1000] opacity-[0.04] mix-blend-soft-light"
      style={{
        backgroundImage: `url("${GRAIN_SVG}")`,
        backgroundRepeat: "repeat",
      }}
    />
  );
}
