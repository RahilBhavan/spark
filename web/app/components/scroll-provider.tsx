"use client";

import { ReactLenis, useLenis } from "lenis/react";
import { useEffect, useState } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { CustomCursor } from "./custom-cursor";
import { GrainOverlay } from "./grain-overlay";

gsap.registerPlugin(ScrollTrigger);

const LENIS_OPTIONS = {
  duration: 1.2,
  smoothWheel: true,
  touchMultiplier: 2,
  autoRaf: true,
};

/**
 * Syncs GSAP ScrollTrigger with Lenis scroll position so scroll-based
 * animations (reveals, parallax) use the smooth-scroll value.
 */
function ScrollTriggerSync() {
  const lenis = useLenis();

  useEffect(() => {
    if (!lenis) return;

    ScrollTrigger.scrollerProxy(document.body, {
      scrollTop(value) {
        if (arguments.length && typeof value === "number") {
          lenis.scrollTo(value, { immediate: true });
        }
        return lenis.scroll;
      },
    });

    const unsub = lenis.on("scroll", ScrollTrigger.update);

    return () => {
      unsub();
      ScrollTrigger.scrollerProxy(document.body, {});
    };
  }, [lenis]);

  return null;
}

type ScrollProviderProps = {
  children: React.ReactNode;
};

/**
 * Client wrapper that provides Lenis smooth scroll and GSAP ScrollTrigger
 * sync. When prefers-reduced-motion, skips smooth scroll and custom cursor.
 */
export function ScrollProvider({ children }: ScrollProviderProps) {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setPrefersReducedMotion(mq.matches);
    const handler = () => setPrefersReducedMotion(mq.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  if (prefersReducedMotion) {
    return (
      <>
        <GrainOverlay />
        {children}
      </>
    );
  }

  return (
    <ReactLenis root options={LENIS_OPTIONS}>
      <ScrollTriggerSync />
      <CustomCursor />
      <GrainOverlay />
      {children}
    </ReactLenis>
  );
}
