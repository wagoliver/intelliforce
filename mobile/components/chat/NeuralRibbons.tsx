// COPIADO/ADAPTADO de web/app/(app)/skills/components/NeuralRibbons.tsx
// (reduzido a 3 fitas para performance no mobile). Lê --accent-green/--accent-cyan.
"use client";

import { useEffect, useRef } from "react";

export function NeuralRibbons({
  dimmed = false,
  className = "neural-ribbons",
}: {
  dimmed?: boolean;
  className?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dimmedRef = useRef(dimmed);
  dimmedRef.current = dimmed;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let raf = 0;
    let isMounted = true;

    function readColors() {
      const root = canvas?.parentElement ?? document.documentElement;
      const styles = getComputedStyle(root);
      const green = styles.getPropertyValue("--accent-green").trim() || "oklch(0.62 0.17 152)";
      const cyan = styles.getPropertyValue("--accent-cyan").trim() || "oklch(0.66 0.14 212)";
      const isDark = document.documentElement.classList.contains("dark");
      return { green, cyan, isDark };
    }

    let { green, cyan, isDark } = readColors();
    const observer = new MutationObserver(() => {
      ({ green, cyan, isDark } = readColors());
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });

    let dpr = window.devicePixelRatio || 1;
    function resize() {
      if (!canvas) return;
      dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      canvas.width = Math.max(1, Math.floor(rect.width * dpr));
      canvas.height = Math.max(1, Math.floor(rect.height * dpr));
    }
    resize();
    window.addEventListener("resize", resize);

    type Ribbon = {
      color: "green" | "cyan";
      width: number;
      opacity: number;
      speed: number;
      f1: number; a1: number; ph1: number;
      f2: number; a2: number; ph2: number;
      f3: number; a3: number; ph3: number;
      yOffset: number;
    };

    const ribbons: Ribbon[] = [
      {
        color: "green", width: 1.6, opacity: 0.6, speed: 0.18,
        f1: 1.2, a1: 0.22, ph1: 0, f2: 2.7, a2: 0.1, ph2: 1.3, f3: 0.5, a3: 0.18, ph3: 2.1,
        yOffset: 0.44,
      },
      {
        color: "cyan", width: 2.2, opacity: 0.5, speed: 0.13,
        f1: 0.9, a1: 0.28, ph1: 1.1, f2: 2.1, a2: 0.08, ph2: 2.7, f3: 0.7, a3: 0.14, ph3: 0.4,
        yOffset: 0.5,
      },
      {
        color: "green", width: 1.0, opacity: 0.42, speed: 0.22,
        f1: 1.5, a1: 0.18, ph1: 2.4, f2: 3.1, a2: 0.07, ph2: 0.6, f3: 0.4, a3: 0.2, ph3: 1.9,
        yOffset: 0.56,
      },
    ];

    const POINTS = 56;
    const start = performance.now();

    function frame(t: number) {
      if (!isMounted || !canvas || !ctx) return;
      const time = (t - start) / 1000;
      const w = canvas.width / dpr;
      const h = canvas.height / dpr;

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      ctx.globalCompositeOperation = "lighter";

      for (const r of ribbons) {
        const baseY = h * r.yOffset;
        const amp = Math.min(h * 0.32, 90);
        const pts: { x: number; y: number }[] = [];
        for (let i = 0; i <= POINTS; i++) {
          const x = (i / POINTS) * w;
          const u = i / POINTS;
          const phase = u * 2.5 + time * r.speed;
          const y =
            baseY +
            amp * (
              r.a1 * Math.sin(phase * r.f1 * 2 * Math.PI + r.ph1) +
              r.a2 * Math.cos(phase * r.f2 * 2 * Math.PI + r.ph2) +
              r.a3 * Math.sin(phase * r.f3 * 2 * Math.PI + r.ph3)
            );
          pts.push({ x, y });
        }

        ctx.beginPath();
        ctx.moveTo(pts[0].x, pts[0].y);
        for (let i = 1; i < pts.length - 1; i++) {
          const xc = (pts[i].x + pts[i + 1].x) / 2;
          const yc = (pts[i].y + pts[i + 1].y) / 2;
          ctx.quadraticCurveTo(pts[i].x, pts[i].y, xc, yc);
        }
        ctx.lineTo(pts[pts.length - 1].x, pts[pts.length - 1].y);

        const colorVar = r.color === "green" ? green : cyan;
        ctx.strokeStyle = colorVar;
        const dimFactor = dimmedRef.current ? 0.3 : 1;
        ctx.globalAlpha = r.opacity * (isDark ? 1 : 0.75) * dimFactor;
        ctx.lineWidth = r.width;
        ctx.lineCap = "round";
        if (isDark) {
          ctx.shadowColor = colorVar;
          ctx.shadowBlur = dimmedRef.current ? 4 : 8;
        } else {
          ctx.shadowBlur = 0;
        }
        ctx.stroke();
      }

      ctx.globalAlpha = 1;
      ctx.shadowBlur = 0;
      ctx.globalCompositeOperation = "source-over";
      raf = requestAnimationFrame(frame);
    }

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reducedMotion) {
      frame(performance.now());
    } else {
      raf = requestAnimationFrame(frame);
    }

    return () => {
      isMounted = false;
      if (raf) cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      observer.disconnect();
    };
  }, []);

  return <canvas ref={canvasRef} className={className} aria-hidden="true" />;
}
