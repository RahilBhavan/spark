"use client";

import { useEffect, useState, useRef } from "react";
import gsap from "gsap";

/**
 * Custom cursor: dot that follows the pointer with delay; expands on link/button hover.
 * Hidden on touch devices (no hover). Requires cursor: none on body when active.
 */
export function CustomCursor() {
  const [isTouch, setIsTouch] = useState(false);
  const [hoverLabel, setHoverLabel] = useState<string | null>(null);
  const dotRef = useRef<HTMLDivElement>(null);
  const labelRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    setIsTouch(
      typeof window !== "undefined" &&
        ("ontouchstart" in window || navigator.maxTouchPoints > 0)
    );
  }, []);

  useEffect(() => {
    if (isTouch || typeof window === "undefined") return;

    const dot = dotRef.current;
    if (!dot) return;

    const mouse = { x: 0, y: 0 };
    const pos = { x: 0, y: 0 };

    const setMouse = (e: MouseEvent) => {
      mouse.x = e.clientX;
      mouse.y = e.clientY;
    };

    const raf = () => {
      pos.x += (mouse.x - pos.x) * 0.15;
      pos.y += (mouse.y - pos.y) * 0.15;
      gsap.set(dot, { x: pos.x, y: pos.y, xPercent: -50, yPercent: -50 });
      requestAnimationFrame(raf);
    };

    window.addEventListener("mousemove", setMouse);
    const id = requestAnimationFrame(raf);

    return () => {
      window.removeEventListener("mousemove", setMouse);
      cancelAnimationFrame(id);
    };
  }, [isTouch]);

  useEffect(() => {
    if (isTouch || typeof window === "undefined") return;

    const dot = dotRef.current;
    const label = labelRef.current;
    if (!dot) return;

    const onEnter = (e: MouseEvent) => {
      const target = (e.target as HTMLElement).closest("a, button");
      if (target) {
        gsap.to(dot, { scale: 2.5, borderColor: "var(--spark)", duration: 0.2 });
        const text =
          target.getAttribute("data-cursor") ||
          (target.tagName === "A" ? "View" : null);
        setHoverLabel(text);
        if (label) gsap.set(label, { opacity: 1 });
      }
    };

    const onLeave = (e: MouseEvent) => {
      const related = e.relatedTarget as Node | null;
      if (related && document.body.contains(related)) {
        const stillOver = (related as HTMLElement).closest?.("a, button");
        if (stillOver) return;
      }
      gsap.to(dot, {
        scale: 1,
        borderColor: "rgba(255,255,255,0.8)",
        duration: 0.2,
      });
      setHoverLabel(null);
      if (labelRef.current) gsap.set(labelRef.current, { opacity: 0 });
    };

    document.body.addEventListener("mouseover", onEnter as EventListener);
    document.body.addEventListener("mouseout", onLeave as EventListener);
    return () => {
      document.body.removeEventListener("mouseover", onEnter as EventListener);
      document.body.removeEventListener("mouseout", onLeave as EventListener);
    };
  }, [isTouch]);

  useEffect(() => {
    if (isTouch) return;
    document.body.style.cursor = "none";
    return () => {
      document.body.style.cursor = "";
    };
  }, [isTouch]);

  if (isTouch) return null;

  return (
    <div
      ref={dotRef}
      className="pointer-events-none fixed left-0 top-0 z-[9999] flex h-6 w-6 items-center justify-center rounded-full border-2 border-white/80 mix-blend-difference transition-colors"
      aria-hidden
    >
      <span
        ref={labelRef}
        className="absolute whitespace-nowrap text-[10px] font-medium text-white opacity-0"
        style={{ left: "50%", top: "50%", transform: "translate(-50%, -50%)" }}
      >
        {hoverLabel}
      </span>
    </div>
  );
}
