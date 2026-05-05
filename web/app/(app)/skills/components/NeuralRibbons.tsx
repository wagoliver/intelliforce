"use client";

import { useEffect, useRef } from "react";

/**
 * NeuralRibbons — fitas sinuosas inspiradas no IBM Watson Threads.
 *
 * Renderiza N curvas finas atravessando o canvas, cada uma com:
 *   - 60 pontos calculados por sin/cos de frequências coprimas
 *     (combinações nunca repetem exatamente)
 *   - Velocidade, fase e amplitude próprias (movimento dessincronizado)
 *   - Cor verde ou cyan (brand IntelliForce), espessura variando
 *
 * Threads se sobrepõem com `globalCompositeOperation = "lighter"` —
 * cruzamentos viram highlights naturais.
 *
 * Sensação: redes neurais respirando, fluxo contemplativo, "comando
 * orquestrando agentes em paralelo".
 *
 * Theme aware: lê tokens CSS via getComputedStyle.
 * Reduced-motion: mantém última pose estática (não some).
 */
export function NeuralRibbons() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let raf = 0;
    let isMounted = true;

    // Lê cores brand via CSS vars (adapta light/dark automaticamente)
    function readColors() {
      const root = canvas?.parentElement ?? document.documentElement;
      const styles = getComputedStyle(root);
      const green = styles.getPropertyValue("--accent-green").trim() || "oklch(0.55 0.18 152)";
      const cyan = styles.getPropertyValue("--accent-cyan").trim() || "oklch(0.55 0.15 215)";
      // Detecta se está em theme dark pra ajustar opacities
      const isDark =
        document.documentElement.classList.contains("dark") ||
        document.documentElement.getAttribute("data-theme") === "dark";
      return { green, cyan, isDark };
    }

    let { green, cyan, isDark } = readColors();
    // Re-lê quando o theme muda (observador no html)
    const observer = new MutationObserver(() => {
      ({ green, cyan, isDark } = readColors());
    });
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class", "data-theme"],
    });

    let dpr = window.devicePixelRatio || 1;

    function resize() {
      if (!canvas) return;
      dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      canvas.width = Math.max(1, Math.floor(rect.width * dpr));
      canvas.height = Math.max(1, Math.floor(rect.height * dpr));
      // ctx.scale aplicado em cada frame após reset
    }
    resize();
    window.addEventListener("resize", resize);

    // Configuração de cada thread — frequências coprimas evitam loop óbvio
    type Ribbon = {
      color: "green" | "cyan";
      width: number;
      opacity: number;
      speed: number;
      // 3 oscilações sobrepostas com freq incompatíveis
      f1: number; a1: number; ph1: number;
      f2: number; a2: number; ph2: number;
      f3: number; a3: number; ph3: number;
      yOffset: number; // posição vertical base relativa
    };

    const ribbons: Ribbon[] = [
      {
        color: "green", width: 1.4, opacity: 0.55, speed: 0.18,
        f1: 1.2, a1: 0.22, ph1: 0,
        f2: 2.7, a2: 0.10, ph2: 1.3,
        f3: 0.5, a3: 0.18, ph3: 2.1,
        yOffset: 0.42,
      },
      {
        color: "cyan", width: 2.0, opacity: 0.45, speed: 0.13,
        f1: 0.9, a1: 0.28, ph1: 1.1,
        f2: 2.1, a2: 0.08, ph2: 2.7,
        f3: 0.7, a3: 0.14, ph3: 0.4,
        yOffset: 0.50,
      },
      {
        color: "cyan", width: 0.9, opacity: 0.40, speed: 0.22,
        f1: 1.5, a1: 0.18, ph1: 2.4,
        f2: 3.1, a2: 0.07, ph2: 0.6,
        f3: 0.4, a3: 0.20, ph3: 1.9,
        yOffset: 0.55,
      },
      {
        color: "green", width: 1.6, opacity: 0.35, speed: 0.10,
        f1: 0.7, a1: 0.30, ph1: 3.2,
        f2: 1.9, a2: 0.09, ph2: 1.6,
        f3: 0.3, a3: 0.16, ph3: 0.9,
        yOffset: 0.48,
      },
      {
        color: "green", width: 0.7, opacity: 0.30, speed: 0.16,
        f1: 1.7, a1: 0.16, ph1: 0.7,
        f2: 2.5, a2: 0.06, ph2: 2.2,
        f3: 0.6, a3: 0.12, ph3: 3.0,
        yOffset: 0.52,
      },
    ];

    const POINTS = 64; // resolução de cada curva
    const start = performance.now();

    function frame(t: number) {
      if (!isMounted || !canvas || !ctx) return;
      const time = (t - start) / 1000;
      const w = canvas.width / dpr;
      const h = canvas.height / dpr;

      // Reset transform e clear
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);

      // Composite "lighter" → cruzamentos viram highlights
      ctx.globalCompositeOperation = "lighter";

      for (const r of ribbons) {
        const baseY = h * r.yOffset;
        // Amplitude vertical proporcional à altura do canvas (mas com cap)
        const amp = Math.min(h * 0.3, 180);

        // Calcula pontos
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

        // Path com bezier suave (cada par de pontos vira curva quadrática)
        ctx.beginPath();
        ctx.moveTo(pts[0].x, pts[0].y);
        for (let i = 1; i < pts.length - 1; i++) {
          const xc = (pts[i].x + pts[i + 1].x) / 2;
          const yc = (pts[i].y + pts[i + 1].y) / 2;
          ctx.quadraticCurveTo(pts[i].x, pts[i].y, xc, yc);
        }
        ctx.lineTo(pts[pts.length - 1].x, pts[pts.length - 1].y);

        // Stroke com glow leve (só em dark — em light fica sujo)
        const colorVar = r.color === "green" ? green : cyan;
        ctx.strokeStyle = colorVar;
        ctx.globalAlpha = r.opacity * (isDark ? 1 : 0.7);
        ctx.lineWidth = r.width;
        ctx.lineCap = "round";

        if (isDark) {
          ctx.shadowColor = colorVar;
          ctx.shadowBlur = 8;
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

    // prefers-reduced-motion: renderiza 1 frame estático e para
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reducedMotion) {
      frame(performance.now());
      // não agenda próximo frame
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

  return (
    <canvas
      ref={canvasRef}
      className="skills-neural-ribbons"
      aria-hidden="true"
    />
  );
}
