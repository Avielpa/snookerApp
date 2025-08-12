// components/MobileTouch.tsx
/**
 * Enhanced TouchableOpacity component optimized for mobile devices
 * Fixes common touch responsiveness issues on real devices vs emulators
 */

import React from 'react';
import { TouchableOpacity, TouchableOpacityProps, Platform } from 'react-native';

interface MobileTouchProps extends TouchableOpacityProps {
  children: React.ReactNode;
  enhancedHitSlop?: boolean;
}

export const MobileTouch: React.FC<MobileTouchProps> = ({ 
  children, 
  enhancedHitSlop = true,
  activeOpacity = 0.7,
  delayPressIn = 0,
  hitSlop,
  ...props 
}) => {
  // Default enhanced hit slop for mobile devices
  const defaultHitSlop = enhancedHitSlop ? {
    top: Platform.OS === 'ios' ? 10 : 8,
    bottom: Platform.OS === 'ios' ? 10 : 8, 
    left: Platform.OS === 'ios' ? 10 : 8,
    right: Platform.OS === 'ios' ? 10 : 8,
  } : undefined;

  return (
    <TouchableOpacity
      activeOpacity={activeOpacity}
      delayPressIn={delayPressIn}
      hitSlop={hitSlop || defaultHitSlop}
      {...props}
    >
      {children}
    </TouchableOpacity>
  );
};

export default MobileTouch;