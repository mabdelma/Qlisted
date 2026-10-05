import { useEffect, useRef, useState } from 'react';

/**
 * True once the element has been scrolled into view, and true forever after.
 *
 * For animations that should PLAY rather than just appear — the AI chat
 * mockup types out a conversation, which is pointless if it finishes while
 * still below the fold.
 *
 * Returns true immediately when the viewer prefers reduced motion or when
 * IntersectionObserver is unavailable, so callers render their finished state
 * instead of an empty box.
 */
export function useInView<T extends HTMLElement = HTMLDivElement>(threshold = 0.3) {
  const ref = useRef<T | null>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (
      typeof IntersectionObserver === 'undefined'
      || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    ) {
      setInView(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setInView(true);
          io.unobserve(el);
        }
      },
      { threshold },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [threshold]);

  return [ref, inView] as const;
}

/**
 * Reveal an element the first time it scrolls into view.
 *
 * Deliberately not a motion library. The visual work is all CSS (see the
 * "Scroll reveal" block in index.css); this only flips `data-reveal` to "in"
 * once, so there is no per-frame JS and nothing added to the bundle.
 *
 * Two things it gets right that a naive version does not:
 *
 *  - It unobserves after the first reveal. A section that re-animates every
 *    time you scroll past reads as a glitch, not as polish.
 *  - It respects `prefers-reduced-motion`. The CSS hidden state only applies
 *    under `no-preference`, so for a reduced-motion visitor this hook does
 *    nothing and the content is simply there — rather than being hidden by
 *    CSS that never animates it back in.
 *
 * Also marks the element settled after the transition so `will-change` can be
 * released; keeping hundreds of promoted layers alive on a long landing page
 * costs more than the animation saves.
 */
export function useReveal<T extends HTMLElement = HTMLDivElement>(options?: {
  /** Fraction of the element that must be visible. Default 0.15. */
  threshold?: number;
  /** Stagger, in ms, applied via the --reveal-delay custom property. */
  delay?: number;
}) {
  const ref = useRef<T | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // Nothing to do when the viewer asked for less motion, or where
    // IntersectionObserver is unavailable (older Safari, some webviews) — in
    // both cases the CSS leaves the element visible.
    if (
      typeof IntersectionObserver === 'undefined'
      || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    ) {
      el.dataset.reveal = 'in';
      return;
    }

    if (options?.delay) el.style.setProperty('--reveal-delay', `${options.delay}ms`);

    const settle = () => el.classList.add('reveal-settled');

    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          el.dataset.reveal = 'in';
          el.addEventListener('transitionend', settle, { once: true });
          io.unobserve(el);
        }
      },
      { threshold: options?.threshold ?? 0.15, rootMargin: '0px 0px -10% 0px' },
    );

    io.observe(el);
    return () => {
      io.disconnect();
      el.removeEventListener('transitionend', settle);
    };
  }, [options?.threshold, options?.delay]);

  return ref;
}
