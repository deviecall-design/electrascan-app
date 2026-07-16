import { useEffect, useRef, useState } from 'react';

// Drives the `.ds-reveal` CSS in index.css. The element is fully visible by
// default (the `.ds-reveal` base class alone never hides anything); this
// hook only ever ADDS a one-shot settle-in animation class once the element
// scrolls into view. If IntersectionObserver never fires — a headless
// render, a hidden tab, a screenshot taken at t=0 — content simply stays in
// its plain, fully-visible default instead of shipping blank.
export function useReveal<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setPlaying(true);
          observer.unobserve(el);
        }
      },
      { threshold: 0.15, rootMargin: '0px 0px -10% 0px' }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return { ref, playing };
}
