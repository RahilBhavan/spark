"use client";

import { useRef, useState, useEffect, type ReactNode, type AnchorHTMLAttributes } from "react";
import gsap from "gsap";

type MagneticButtonProps = AnchorHTMLAttributes<HTMLAnchorElement> & {
  children: ReactNode;
  /** Magnetic strength (movement toward cursor). 0 = none, 0.3 = subtle, 0.5 = strong */
  strength?: number;
};

/**
 * Wraps an anchor so it slightly moves toward the cursor when nearby (magnetic effect).
 * Use on landing CTAs only; not for dashboard form controls.
 */
export function MagneticButton({
  children,
  strength = 0.3,
  className,
  ...props
}: MagneticButtonProps) {
  const ref = useRef<HTMLAnchorElement>(null);
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduceMotion(mq.matches);
    const handler = () => setReduceMotion(mq.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  const handleMouseMove = (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (reduceMotion) return;
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = (e.clientX - rect.left - rect.width / 2) * strength;
    const y = (e.clientY - rect.top - rect.height / 2) * strength;
    gsap.to(el, { x, y, duration: 0.3, ease: "power2.out" });
  };

  const handleMouseLeave = () => {
    if (reduceMotion) return;
    const el = ref.current;
    if (!el) return;
    gsap.to(el, { x: 0, y: 0, duration: 0.5, ease: "elastic.out(1, 0.5)" });
  };

  return (
    <a
      ref={ref}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className={className}
      style={{ display: "inline-block" }}
      {...props}
    >
      {children}
    </a>
  );
}
