import { useState, useEffect } from 'react';

const getBreakpoints = () => ({
  mobile: window.innerWidth <= 768,
  tablet: window.innerWidth > 768 && window.innerWidth <= 1024,
  desktop: window.innerWidth > 1024,
});

export const useResponsive = () => {
  const [bp, setBp] = useState(getBreakpoints);

  useEffect(() => {
    let timer;
    const handler = () => {
      clearTimeout(timer);
      timer = setTimeout(() => setBp(getBreakpoints()), 100);
    };
    window.addEventListener('resize', handler);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', handler);
    };
  }, []);

  return bp;
};
