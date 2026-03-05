"use client";

import { useRef, useEffect, type ReactNode } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

type RevealOnScrollProps = {
  children: ReactNode;
  className?: string;
  /** Animation variant: fade-up, fade-in, unskew */
  variant?: "fade-up" | "fade-in" | "unskew";
  /** Start trigger: "top 80%" = when element top hits 80% of viewport */
  start?: string;
  /** Stagger children (if multiple) by this many seconds */
  stagger?: number;
};

export function RevealOnScroll({
  children,
  className,
  variant = "fade-up",
  start = "top 85%",
  stagger = 0,
}: RevealOnScrollProps) {
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

    const fromVars =
      variant === "fade-up"
        ? { y: 40, opacity: 0 }
        : variant === "unskew"
          ? { skewY: 3, opacity: 0 }
          : { opacity: 0 };

    const toVars =
      variant === "fade-up"
        ? { y: 0, opacity: 1 }
        : variant === "unskew"
          ? { skewY: 0, opacity: 1 }
          : { opacity: 1 };

    const targets = stagger ? el.children : el;
    const animation = gsap.fromTo(
      targets,
      { ...fromVars },
      {
        ...toVars,
        duration: 0.7,
        ease: "power2.out",
        stagger: stagger,
        scrollTrigger: {
          trigger: el,
          start,
          toggleActions: "play none none none",
        },
      }
    );

    return () => {
      animation.kill();
      ScrollTrigger.getAll().forEach((t) => {
        if (t.trigger === el) t.kill();
      });
    };
  }, [variant, start, stagger]);

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}
