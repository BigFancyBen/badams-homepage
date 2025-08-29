import { MobileDetection } from '../types';
import { useWindowSize } from './useWindowSize';

// Mobile detection utilities
export function useMobileDetection(): MobileDetection {
  const { width, height, isClient } = useWindowSize();

  const isMobileLandscape = isClient && height < 500 && width > height;
  const isMobilePortrait = isClient && width < 768 && height > width;
  const isLandscape = isClient && width > height;

  return { isMobileLandscape, isMobilePortrait, isLandscape, isClient };
}

