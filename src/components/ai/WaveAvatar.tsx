import { useEffect, useRef } from 'react';

/**
 * Voice-assistant globe — ported from Escoutly's WaveAvatar, themed to the
 * app's brand tokens. Reads the brand CSS variables at draw-time so the
 * colors follow the tenant's custom brand (set by BrandingProvider) instead
 * of being hardcoded. A masked circle with a radial gradient; animated sine
 * waves while the AI speaks, a calm glowing line otherwise. Pure canvas.
 */
function cssVar(name: string, fallback: string): string {
  const val = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return val || fallback;
}

function hexToRgb(hex: string): [number, number, number] {
  const m = hex.replace('#', '');
  const full = m.length === 3 ? m.split('').map((c) => c + c).join('') : m;
  const n = parseInt(full, 16);
  if (Number.isNaN(n)) return [139, 69, 19];
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function withAlpha(hex: string, a: number): string {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r},${g},${b},${a})`;
}

export function WaveAvatar({ speaking, size = 220 }: { speaking: boolean; size?: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const speakingRef = useRef(speaking);
  speakingRef.current = speaking;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Resolve brand colors once per mount (tracked by the CSS vars).
    const color500 = cssVar('--color-brand-500', '#0f766e');
    const color700 = cssVar('--color-brand-700', '#1e3a5f');
    const color900 = cssVar('--color-brand-900', '#0f2a3f');
    const stroke = cssVar('--color-accent-light', '#ccfbf1');
    const glow = cssVar('--color-brand-300', '#5eead4');

    const dpr = window.devicePixelRatio || 1;
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    ctx.scale(dpr, dpr);
    const w = size, h = size, r = size * 0.46;
    const waves = [
      { timeModifier: 1.0, amplitude: 14, wavelength: 26 },
      { timeModifier: 1.7, amplitude: 9, wavelength: 18 },
      { timeModifier: 0.7, amplitude: 18, wavelength: 34 },
    ];
    let raf = 0;
    const draw = () => {
      ctx.clearRect(0, 0, w, h);
      ctx.save();
      ctx.beginPath();
      ctx.arc(w / 2, h / 2, r, 0, Math.PI * 2);
      ctx.closePath();
      ctx.clip();
      // Brand globe
      const g = ctx.createRadialGradient(w / 2, h / 2, r * 0.2, w / 2, h / 2, r);
      g.addColorStop(0, withAlpha(color500, 0.95));
      g.addColorStop(0.5, withAlpha(color700, 0.97));
      g.addColorStop(1, withAlpha(color900, 0.98));
      ctx.beginPath();
      ctx.arc(w / 2, h / 2, r, 0, Math.PI * 2);
      ctx.fillStyle = g;
      ctx.fill();
      const x0 = w * 0.16, x1 = w * 0.84;
      if (!speakingRef.current) {
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(x0, h / 2);
        ctx.lineTo(x1, h / 2);
        ctx.strokeStyle = stroke;
        ctx.lineWidth = 2.5;
        ctx.shadowColor = glow;
        ctx.shadowBlur = 6;
        ctx.stroke();
        ctx.restore();
      } else {
        const now = Date.now() / 800;
        waves.forEach((wv, i) => {
          ctx.save();
          ctx.beginPath();
          for (let x = x0; x <= x1; x += 1) {
            const progress = x / wv.wavelength;
            const t = now * wv.timeModifier;
            const fade = Math.sin((Math.PI * (x - x0)) / (x1 - x0));
            const y = h / 2 + Math.sin(progress + t) * wv.amplitude * fade;
            if (x === x0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          }
          ctx.strokeStyle = stroke;
          ctx.globalAlpha = 0.45 + 0.5 / (i + 1);
          ctx.lineWidth = 2.5;
          ctx.shadowColor = glow;
          ctx.shadowBlur = 6;
          ctx.stroke();
          ctx.restore();
        });
      }
      ctx.restore();
      raf = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(raf);
  }, [size]);

  return <canvas ref={canvasRef} style={{ width: size, height: size }} className="rounded-full shadow-2xl" aria-hidden />;
}
