// hooks/useIsMobile.js
import { useState, useEffect } from 'react';

const useIsMobile = () => {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkIsMobile = () => {
      const userAgent = typeof window.navigator === "undefined" ? "" : navigator.userAgent;
      const mobileRegex = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i;
      const tabletRegex = /Tablet|iPad/i;

      const isMobileDevice = mobileRegex.test(userAgent);
      const isTablet = tabletRegex.test(userAgent) || (window.innerWidth <= 1024 && window.innerWidth > 768);

      setIsMobile(isMobileDevice || isTablet);
    };

    checkIsMobile();
    window.addEventListener('resize', checkIsMobile);

    return () => window.removeEventListener('resize', checkIsMobile);
  }, []);

  return isMobile;
};

export default useIsMobile;