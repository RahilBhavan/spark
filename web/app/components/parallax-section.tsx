"use client";

import { useRef, useEffect, type ReactNode } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

type ParallaxSectionProps = {
  children: ReactNode;
  className?: string;
  /** Speed factor: 0.5 = moves half as fast as scroll (background), 1 = no parallax */
  speed?: number;
};

/**
 * Wraps content and applies a vertical parallax transform based on scroll.
 * Use for hero backgrounds or sections that should move slower than foreground.
 */
export function ParallaxSection({
  children,
  className,
  speed = 0.4,
}: ParallaxSectionProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      return;
    }

    const yOffset = 120 * (1 - speed);
    const animation = gsap.to(el, {
      y: -yOffset,
      ease: "none",
      scrollTrigger: {
        trigger: el,
        start: "top bottom",
        end: "bottom top",
        scrub: 1,
      },
    });

    return () => {
      animation.kill();
      ScrollTrigger.getAll().forEach((t) => {
        if (t.trigger === el) t.kill();
      });
    };
  }, [speed]);

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}
