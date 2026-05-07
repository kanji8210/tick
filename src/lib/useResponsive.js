import { useState, useEffect } from 'react';

// A phone in landscape (e.g. 844×390) has innerWidth > 768 but is still a phone.
// We detect "phone" via the shortest viewport side OR a coarse-pointer device with
// limited height — so landscape phones map to the mobile view, while real tablets
// (shortest side ≥ ~600px) and desktops keep their layouts.
const isPhoneViewport = () => {
  const w = window.innerWidth;
  const h = window.innerHeight;
  const shortest = Math.min(w, h);

  // Standard portrait phone
  if (w <= 768) return true;

  // Landscape phone: short side ≤ 500px (covers iPhone SE → Pro Max, most Androids)
  if (shortest <= 500) return true;

  // Touch device in landscape with low height — catches edge cases
  const coarse = typeof window.matchMedia === 'function'
    && window.matchMedia('(pointer: coarse)').matches;
  if (coarse && h <= 500) return true;

  return false;
};

const getBreakpoints = () => {
  const w = window.innerWidth;
  const mobile = isPhoneViewport();
  return {
    mobile,
    tablet: !mobile && w > 768 && w <= 1024,
    desktop: !mobile && w > 1024,
  };
};

export const useResponsive = () => {
  const [bp, setBp] = useState(getBreakpoints);

  useEffect(() => {
    let timer;
    const handler = () => {
      clearTimeout(timer);
      timer = setTimeout(() => setBp(getBreakpoints()), 100);
    };
    window.addEventListener('resize', handler);
    window.addEventListener('orientationchange', handler);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', handler);
      window.removeEventListener('orientationchange', handler);
    };
  }, []);

  return bp;
};
