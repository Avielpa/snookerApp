// config/deviceTabConfig.ts
import { Platform, Dimensions, StyleSheet } from 'react-native';
import * as Device from 'expo-device';
import { logger } from '../utils/logger';

/**
 * Comprehensive Device-Aware Tab/Filter Configuration System
 * 
 * This configuration system addresses the specific tab/filter inconsistency issues
 * found across different Android devices, especially Samsung Galaxy series.
 * 
 * Research findings:
 * - TouchableOpacity has documented issues with Samsung Galaxy devices
 * - Import source affects Android compatibility (gesture-handler vs react-native)
 * - Samsung devices need larger touch areas and different timing
 * - Pressable is more reliable but needs custom feedback implementation
 */

export interface DeviceProfile {
  name: string;
  manufacturer: string;
  touchComponent: 'touchable' | 'pressable';
  touchConfig: TouchConfiguration;
  styleConfig: StyleConfiguration;
  layoutConfig: LayoutConfiguration;
}

export interface TouchConfiguration {
  hitSlop: { top: number; bottom: number; left: number; right: number };
  pressRetentionOffset: { top: number; bottom: number; left: number; right: number };
  delayPressIn: number;
  delayPressOut: number;
  activeOpacity: number;
  minimumTouchableSize: number;
  useNativeFeedback?: boolean;
  rippleColor?: string;
  eventThrottle?: number;
}

export interface StyleConfiguration {
  filterButton: {
    paddingVertical: number;
    paddingHorizontal: number;
    borderRadius: number;
    marginRight: number;
    elevation?: number;
    shadowOpacity?: number;
    minHeight?: number;
    minWidth?: number;
  };
  filterText: {
    fontSize: number;
    marginLeft: number;
    letterSpacing: number;
    fontWeight?: string;
  };
  spacing: {
    containerPadding: number;
    buttonSpacing: number;
    scrollPadding: number;
  };
}

export interface LayoutConfiguration {
  scrollBehavior: {
    decelerationRate: 'normal' | 'fast' | number;
    scrollEventThrottle: number;
    showsHorizontalScrollIndicator: boolean;
    bounces: boolean;
  };
  accessibility: {
    accessibilityRole: string;
    accessible: boolean;
  };
}

/**
 * Device detection utilities
 */
class DeviceDetector {
  private static instance: DeviceDetector;
  private deviceInfo: any;

  private constructor() {
    this.deviceInfo = this.collectDeviceInfo();
  }

  public static getInstance(): DeviceDetector {
    if (!DeviceDetector.instance) {
      DeviceDetector.instance = new DeviceDetector();
    }
    return DeviceDetector.instance;
  }

  private collectDeviceInfo() {
    const { width, height } = Dimensions.get('window');
    
    return {
      platform: Platform.OS,
      manufacturer: Device.manufacturer || 'Unknown',
      modelName: Device.modelName || 'Unknown',
      deviceName: Device.deviceName || 'Unknown',
      modelId: Device.modelId || 'Unknown',
      screenWidth: width,
      screenHeight: height,
      pixelRatio: Platform.select({
        ios: () => require('react-native').PixelRatio.get(),
        android: () => require('react-native').PixelRatio.get(),
        default: () => 1,
      })(),
      fontScale: Platform.select({
        ios: () => require('react-native').PixelRatio.getFontScale(),
        android: () => require('react-native').PixelRatio.getFontScale(),
        default: () => 1,
      })(),
      isTablet: width >= 768 || height >= 768,
    };
  }

  public getDeviceProfile(): string {
    const info = this.deviceInfo;
    
    // Screen size categories
    const isTablet = info.isTablet;
    const isSmallScreen = info.screenWidth < 360;
    const isLargeScreen = info.screenWidth > 400;
    
    // Samsung Galaxy series detection with screen size consideration
    if (info.manufacturer?.toLowerCase().includes('samsung')) {
      if (info.modelName?.includes('S24') || info.modelName?.includes('Galaxy S24')) {
        return isTablet ? 'samsung_galaxy_s24_tablet' : 'samsung_galaxy_s24';
      }
      if (info.modelName?.includes('S23') || info.modelName?.includes('Galaxy S23')) {
        return isTablet ? 'samsung_galaxy_s23_tablet' : 'samsung_galaxy_s23';
      }
      if (info.modelName?.includes('S22') || info.modelName?.includes('Galaxy S22')) {
        return isTablet ? 'samsung_galaxy_s22_tablet' : 'samsung_galaxy_s22';
      }
      // Check by model ID patterns for Samsung
      if (info.modelId?.startsWith('SM-S9')) {
        return isTablet ? 'samsung_galaxy_s24_tablet' : 'samsung_galaxy_s24';
      }
      // Generic Samsung with screen size variants
      if (isTablet) return 'samsung_galaxy_tablet';
      if (isSmallScreen) return 'samsung_galaxy_small';
      if (isLargeScreen) return 'samsung_galaxy_large';
      return 'samsung_galaxy_generic';
    }

    // Other manufacturer detection with screen variants
    if (info.manufacturer?.toLowerCase().includes('google')) {
      return isTablet ? 'google_pixel_tablet' : 'google_pixel';
    }
    
    if (info.manufacturer?.toLowerCase().includes('oneplus')) {
      return isTablet ? 'oneplus_tablet' : 'oneplus_generic';
    }

    if (info.manufacturer?.toLowerCase().includes('xiaomi')) {
      return isTablet ? 'xiaomi_tablet' : 'xiaomi_generic';
    }

    // Platform fallbacks with screen size consideration
    if (info.platform === 'android') {
      if (isTablet) return 'android_tablet';
      if (isSmallScreen) return 'android_small';
      if (isLargeScreen) return 'android_large';
      return 'android_generic';
    }
    
    if (info.platform === 'ios') {
      return isTablet ? 'ios_tablet' : 'ios_generic';
    }

    return 'unknown_device';
  }

  public getDeviceInfo() {
    return this.deviceInfo;
  }

  public logDeviceInfo() {
    logger.log('[DeviceTabConfig] Device Detection Results:', {
      profile: this.getDeviceProfile(),
      info: this.deviceInfo,
      timestamp: new Date().toISOString(),
    });
  }
}

/**
 * Device-specific configurations
 * Each configuration is tested and optimized for specific device families
 */
const deviceProfiles: Record<string, DeviceProfile> = {
  // Samsung Galaxy S24 Series - YOUR WORKING DEVICE
  samsung_galaxy_s24: {
    name: 'Samsung Galaxy S24 Series',
    manufacturer: 'Samsung',
    touchComponent: 'pressable', // More reliable on Samsung
    touchConfig: {
      hitSlop: { top: 15, bottom: 15, left: 8, right: 8 }, // Much smaller to prevent overlap
      pressRetentionOffset: { top: 15, bottom: 15, left: 10, right: 10 }, // Much smaller
      delayPressIn: 0,
      delayPressOut: 0, // No delay needed on S24
      activeOpacity: 0.6,
      minimumTouchableSize: 44,
      useNativeFeedback: true,
      rippleColor: 'rgba(255, 143, 0, 0.3)',
      eventThrottle: 16,
    },
    styleConfig: {
      filterButton: {
        paddingVertical: 8, // Slightly larger for better touch
        paddingHorizontal: 12,
        borderRadius: 16,
        marginRight: 8,
        elevation: 2,
        shadowOpacity: 0.1,
        minHeight: 36,
        minWidth: 60,
      },
      filterText: {
        fontSize: 12,
        marginLeft: 6,
        letterSpacing: 0.1,
        fontWeight: 'medium',
      },
      spacing: {
        containerPadding: 16,
        buttonSpacing: 8,
        scrollPadding: 16,
      },
    },
    layoutConfig: {
      scrollBehavior: {
        decelerationRate: 'fast',
        scrollEventThrottle: 16,
        showsHorizontalScrollIndicator: false,
        bounces: false,
      },
      accessibility: {
        accessibilityRole: 'tab',
        accessible: true,
      },
    },
  },

  // Samsung Galaxy S23 Series
  samsung_galaxy_s23: {
    name: 'Samsung Galaxy S23 Series',
    manufacturer: 'Samsung',
    touchComponent: 'pressable',
    touchConfig: {
      hitSlop: { top: 18, bottom: 18, left: 10, right: 10 }, // Much smaller to prevent overlap
      pressRetentionOffset: { top: 20, bottom: 20, left: 12, right: 12 }, // Much smaller
      delayPressIn: 0,
      delayPressOut: 50, // Small delay for S23
      activeOpacity: 0.7,
      minimumTouchableSize: 48,
      useNativeFeedback: true,
      rippleColor: 'rgba(255, 143, 0, 0.3)',
      eventThrottle: 16,
    },
    styleConfig: {
      filterButton: {
        paddingVertical: 10, // Larger padding
        paddingHorizontal: 14,
        borderRadius: 18,
        marginRight: 10,
        elevation: 3,
        shadowOpacity: 0.15,
        minHeight: 40,
        minWidth: 70,
      },
      filterText: {
        fontSize: 13,
        marginLeft: 8,
        letterSpacing: 0.2,
        fontWeight: 'medium',
      },
      spacing: {
        containerPadding: 18,
        buttonSpacing: 10,
        scrollPadding: 18,
      },
    },
    layoutConfig: {
      scrollBehavior: {
        decelerationRate: 'normal', // Slower for better control
        scrollEventThrottle: 32, // Less frequent events
        showsHorizontalScrollIndicator: false,
        bounces: true,
      },
      accessibility: {
        accessibilityRole: 'tab',
        accessible: true,
      },
    },
  },

  // Generic Samsung fallback - for older devices with known issues
  samsung_galaxy_generic: {
    name: 'Samsung Galaxy Generic',
    manufacturer: 'Samsung',
    touchComponent: 'pressable', // Always use Pressable for Samsung
    touchConfig: {
      hitSlop: { top: 20, bottom: 20, left: 12, right: 12 }, // Much smaller to prevent overlap
      pressRetentionOffset: { top: 22, bottom: 22, left: 15, right: 15 }, // Much smaller
      delayPressIn: 0,
      delayPressOut: 100, // Longer delay for older Samsung devices
      activeOpacity: 0.8,
      minimumTouchableSize: 50,
      useNativeFeedback: true,
      rippleColor: 'rgba(255, 143, 0, 0.4)',
      eventThrottle: 32,
    },
    styleConfig: {
      filterButton: {
        paddingVertical: 12, // Maximum padding for touch area
        paddingHorizontal: 16,
        borderRadius: 20,
        marginRight: 12,
        elevation: 4,
        shadowOpacity: 0.2,
        minHeight: 44,
        minWidth: 80,
      },
      filterText: {
        fontSize: 14,
        marginLeft: 8,
        letterSpacing: 0.3,
        fontWeight: 'bold',
      },
      spacing: {
        containerPadding: 20,
        buttonSpacing: 12,
        scrollPadding: 20,
      },
    },
    layoutConfig: {
      scrollBehavior: {
        decelerationRate: 'normal',
        scrollEventThrottle: 48,
        showsHorizontalScrollIndicator: false,
        bounces: true,
      },
      accessibility: {
        accessibilityRole: 'tab',
        accessible: true,
      },
    },
  },

  // Generic Android - for other manufacturers
  android_generic: {
    name: 'Generic Android Device',
    manufacturer: 'Android',
    touchComponent: 'pressable',
    touchConfig: {
      hitSlop: { top: 15, bottom: 15, left: 8, right: 8 }, // Reduced to prevent overlap
      pressRetentionOffset: { top: 35, bottom: 35, left: 35, right: 35 },
      delayPressIn: 0,
      delayPressOut: 75,
      activeOpacity: 0.7,
      minimumTouchableSize: 44,
      useNativeFeedback: true,
      rippleColor: 'rgba(255, 143, 0, 0.3)',
    },
    styleConfig: {
      filterButton: {
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderRadius: 16,
        marginRight: 8,
        elevation: 2,
        minHeight: 36,
      },
      filterText: {
        fontSize: 12,
        marginLeft: 6,
        letterSpacing: 0.1,
      },
      spacing: {
        containerPadding: 16,
        buttonSpacing: 8,
        scrollPadding: 16,
      },
    },
    layoutConfig: {
      scrollBehavior: {
        decelerationRate: 'fast',
        scrollEventThrottle: 16,
        showsHorizontalScrollIndicator: false,
        bounces: false,
      },
      accessibility: {
        accessibilityRole: 'tab',
        accessible: true,
      },
    },
  },

  // iOS Configuration
  ios_generic: {
    name: 'iOS Device',
    manufacturer: 'Apple',
    touchComponent: 'touchable', // TouchableOpacity works fine on iOS
    touchConfig: {
      hitSlop: { top: 20, bottom: 20, left: 20, right: 20 },
      pressRetentionOffset: { top: 25, bottom: 25, left: 25, right: 25 },
      delayPressIn: 0,
      delayPressOut: 50,
      activeOpacity: 0.6,
      minimumTouchableSize: 44,
    },
    styleConfig: {
      filterButton: {
        paddingVertical: 6,
        paddingHorizontal: 10,
        borderRadius: 16,
        marginRight: 6,
        shadowOpacity: 0.1,
        minHeight: 32,
      },
      filterText: {
        fontSize: 12,
        marginLeft: 4,
        letterSpacing: 0.1,
      },
      spacing: {
        containerPadding: 16,
        buttonSpacing: 6,
        scrollPadding: 16,
      },
    },
    layoutConfig: {
      scrollBehavior: {
        decelerationRate: 'fast',
        scrollEventThrottle: 16,
        showsHorizontalScrollIndicator: false,
        bounces: true,
      },
      accessibility: {
        accessibilityRole: 'tab',
        accessible: true,
      },
    },
  },

  // Screen Size Variants
  android_small: {
    name: 'Small Android Device (<360px)',
    manufacturer: 'Android',
    touchComponent: 'pressable',
    touchConfig: {
      hitSlop: { top: 40, bottom: 40, left: 40, right: 40 }, // Larger for small screens
      pressRetentionOffset: { top: 45, bottom: 45, left: 45, right: 45 },
      delayPressIn: 0,
      delayPressOut: 75,
      activeOpacity: 0.7,
      minimumTouchableSize: 48, // Larger minimum for accessibility
      useNativeFeedback: true,
      rippleColor: 'rgba(255, 143, 0, 0.3)',
    },
    styleConfig: {
      filterButton: {
        paddingVertical: 10, // More padding for small screens
        paddingHorizontal: 8,  // Less horizontal to fit more
        borderRadius: 14,
        marginRight: 4,  // Less margin to fit more buttons
        elevation: 2,
        minHeight: 40,
        minWidth: 50,
      },
      filterText: {
        fontSize: 11,  // Smaller text
        marginLeft: 4,
        letterSpacing: 0.1,
      },
      spacing: {
        containerPadding: 12,  // Less padding
        buttonSpacing: 4,
        scrollPadding: 12,
      },
    },
    layoutConfig: {
      scrollBehavior: {
        decelerationRate: 'normal',
        scrollEventThrottle: 16,
        showsHorizontalScrollIndicator: false,
        bounces: false,
      },
      accessibility: {
        accessibilityRole: 'tab',
        accessible: true,
      },
    },
  },

  android_large: {
    name: 'Large Android Device (>400px)',
    manufacturer: 'Android',
    touchComponent: 'pressable',
    touchConfig: {
      hitSlop: { top: 25, bottom: 25, left: 25, right: 25 }, // Smaller for large screens
      pressRetentionOffset: { top: 30, bottom: 30, left: 30, right: 30 },
      delayPressIn: 0,
      delayPressOut: 50,
      activeOpacity: 0.6,
      minimumTouchableSize: 44,
      useNativeFeedback: true,
      rippleColor: 'rgba(255, 143, 0, 0.3)',
    },
    styleConfig: {
      filterButton: {
        paddingVertical: 8,
        paddingHorizontal: 16, // More horizontal padding
        borderRadius: 18,      // More rounded
        marginRight: 10,       // More spacing
        elevation: 3,
        minHeight: 36,
        minWidth: 80,
      },
      filterText: {
        fontSize: 13,  // Larger text
        marginLeft: 6,
        letterSpacing: 0.2,
      },
      spacing: {
        containerPadding: 20,  // More padding
        buttonSpacing: 10,
        scrollPadding: 20,
      },
    },
    layoutConfig: {
      scrollBehavior: {
        decelerationRate: 'fast',
        scrollEventThrottle: 16,
        showsHorizontalScrollIndicator: false,
        bounces: false,
      },
      accessibility: {
        accessibilityRole: 'tab',
        accessible: true,
      },
    },
  },

  android_tablet: {
    name: 'Android Tablet (≥768px)',
    manufacturer: 'Android',
    touchComponent: 'pressable',
    touchConfig: {
      hitSlop: { top: 20, bottom: 20, left: 20, right: 20 },
      pressRetentionOffset: { top: 25, bottom: 25, left: 25, right: 25 },
      delayPressIn: 0,
      delayPressOut: 50,
      activeOpacity: 0.6,
      minimumTouchableSize: 44,
      useNativeFeedback: true,
      rippleColor: 'rgba(255, 143, 0, 0.3)',
    },
    styleConfig: {
      filterButton: {
        paddingVertical: 12,   // Larger for tablets
        paddingHorizontal: 20,
        borderRadius: 20,
        marginRight: 12,
        elevation: 2,
        minHeight: 44,
        minWidth: 100,
      },
      filterText: {
        fontSize: 14,  // Larger text for tablets
        marginLeft: 8,
        letterSpacing: 0.2,
      },
      spacing: {
        containerPadding: 24,  // More padding for tablets
        buttonSpacing: 12,
        scrollPadding: 24,
      },
    },
    layoutConfig: {
      scrollBehavior: {
        decelerationRate: 'fast',
        scrollEventThrottle: 16,
        showsHorizontalScrollIndicator: false,
        bounces: true,
      },
      accessibility: {
        accessibilityRole: 'tab',
        accessible: true,
      },
    },
  },

  ios_tablet: {
    name: 'iPad',
    manufacturer: 'Apple',
    touchComponent: 'touchable',
    touchConfig: {
      hitSlop: { top: 20, bottom: 20, left: 20, right: 20 },
      pressRetentionOffset: { top: 25, bottom: 25, left: 25, right: 25 },
      delayPressIn: 0,
      delayPressOut: 50,
      activeOpacity: 0.6,
      minimumTouchableSize: 44,
    },
    styleConfig: {
      filterButton: {
        paddingVertical: 10,
        paddingHorizontal: 18,
        borderRadius: 18,
        marginRight: 10,
        shadowOpacity: 0.1,
        minHeight: 40,
        minWidth: 90,
      },
      filterText: {
        fontSize: 14,
        marginLeft: 6,
        letterSpacing: 0.2,
      },
      spacing: {
        containerPadding: 24,
        buttonSpacing: 10,
        scrollPadding: 24,
      },
    },
    layoutConfig: {
      scrollBehavior: {
        decelerationRate: 'fast',
        scrollEventThrottle: 16,
        showsHorizontalScrollIndicator: false,
        bounces: true,
      },
      accessibility: {
        accessibilityRole: 'tab',
        accessible: true,
      },
    },
  },
};

/**
 * Main configuration class
 */
export class DeviceTabConfigManager {
  private static instance: DeviceTabConfigManager;
  private detector: DeviceDetector;
  private currentProfile: DeviceProfile;

  private constructor() {
    this.detector = DeviceDetector.getInstance();
    const profileKey = this.detector.getDeviceProfile();
    this.currentProfile = deviceProfiles[profileKey] || deviceProfiles['android_generic'];
    
    // Log device detection results
    this.detector.logDeviceInfo();
    logger.log('[DeviceTabConfig] Selected Profile:', this.currentProfile.name);
  }

  public static getInstance(): DeviceTabConfigManager {
    if (!DeviceTabConfigManager.instance) {
      DeviceTabConfigManager.instance = new DeviceTabConfigManager();
    }
    return DeviceTabConfigManager.instance;
  }

  public getProfile(): DeviceProfile {
    return this.currentProfile;
  }

  public getTouchConfig(): TouchConfiguration {
    return this.currentProfile.touchConfig;
  }

  public getStyleConfig(): StyleConfiguration {
    return this.currentProfile.styleConfig;
  }

  public getLayoutConfig(): LayoutConfiguration {
    return this.currentProfile.layoutConfig;
  }

  public shouldUsePressable(): boolean {
    return this.currentProfile.touchComponent === 'pressable';
  }

  public createDynamicStyles(colors: any) {
    const styleConfig = this.getStyleConfig();
    
    return StyleSheet.create({
      filterButton: {
        flexDirection: 'row' as const,
        alignItems: 'center' as const,
        justifyContent: 'center' as const,
        // Lively, inviting background with subtle color
        backgroundColor: 'rgba(255, 255, 255, 0.06)',
        paddingVertical: Math.max(styleConfig.filterButton.paddingVertical - 2, 4), // Much smaller padding
        paddingHorizontal: Math.max(styleConfig.filterButton.paddingHorizontal - 4, 6), // Compact horizontal space
        borderRadius: Math.max(styleConfig.filterButton.borderRadius - 8, 6), // Much smaller radius
        marginRight: Math.max(styleConfig.filterButton.marginRight, 6), // More spacing to prevent overlap
        marginHorizontal: 3, // Even more margin to prevent tap overlap
        
        // More visible, inviting border with debug visibility
        borderWidth: 1.5,
        borderColor: 'rgba(255, 255, 255, 0.25)', // More visible border to see exact boundaries
        
        // No shadows - clean modern look
        shadowColor: 'transparent',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0,
        shadowRadius: 0,
        
        // Minimal elevation
        elevation: 0,
        
        // Compact size constraints - SofaScore style
        minHeight: Math.max((styleConfig.filterButton.minHeight || 36) - 12, 24), // Much smaller
        minWidth: Math.max((styleConfig.filterButton.minWidth || 60) - 20, 40), // Much more compact
        
        // No backdrop filters - cleaner
        
        // Clean iOS style - no shadows
        ...(Platform.OS === 'ios' && {
          shadowColor: 'transparent',
          shadowOffset: { width: 0, height: 0 },
          shadowOpacity: 0,
          shadowRadius: 0,
        }),
      },
      
      filterButtonActive: {
        // Vibrant, lively active state
        backgroundColor: '#FF6B35', // Vibrant orange-red
        borderColor: '#FF6B35',
        borderWidth: 1, // Same border width - no thickness change
        
        // No glow effects - clean
        shadowColor: 'transparent',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0,
        shadowRadius: 0,
        
        // No elevation changes
        elevation: 0,
        
        // No scaling - cleaner
        transform: [{ scale: 1 }],
        
        // Clean iOS - no shadows
        ...(Platform.OS === 'ios' && {
          shadowColor: 'transparent',
          shadowOffset: { width: 0, height: 0 },
          shadowOpacity: 0,
          shadowRadius: 0,
        }),
      },
      
      filterText: {
        color: 'rgba(255, 255, 255, 0.75)', // Better contrast - more readable
        fontSize: Math.max(styleConfig.filterText.fontSize - 1, 10), // Smaller font
        fontFamily: 'PoppinsMedium',
        fontWeight: '400' as const, // Lighter weight
        marginLeft: Math.max(styleConfig.filterText.marginLeft - 2, 2), // Less margin
        letterSpacing: 0, // No extra letter spacing
        textAlign: 'center' as const,
        // No text shadows - clean modern look
      },
      
      filterTextActive: {
        color: '#FFFFFF', // Pure white for active
        fontFamily: 'PoppinsMedium', // Same weight as inactive
        fontWeight: '500' as const, // Only slightly bolder
        // No text shadows - clean
      },
      
      filterScrollView: {
        marginVertical: 2, // Minimal vertical space
        paddingVertical: 1, // Minimal internal padding
      },
      
      filterContainer: {
        paddingHorizontal: Math.max(styleConfig.spacing.containerPadding - 6, 8), // Less container padding
        paddingRight: Math.max(styleConfig.spacing.scrollPadding - 6, 8), // Less right padding
        paddingVertical: 2, // Minimal vertical padding
        backgroundColor: 'transparent', // Clean background
        borderRadius: 0, // No border radius
      },
      
      // Icon style - SofaScore clean
      filterIcon: {
        marginRight: 3, // Smaller margin
        opacity: 0.7, // More muted
      },
      
      filterIconActive: {
        opacity: 1, // Full opacity when active
        // No shadows - clean
      },
      
      // Button wrapper with proper separation
      buttonWrapper: {
        marginHorizontal: 1, // Small margin for separation
        borderRadius: 0, // No border radius
        backgroundColor: 'transparent', // No background
        padding: 1, // Small padding to create separation
      },
      
      buttonWrapperActive: {
        backgroundColor: 'transparent', // No background change
        // No shadows - clean active state
      },
    });
  }
}

// Export convenience functions
export const getDeviceTabConfig = () => DeviceTabConfigManager.getInstance();
export const shouldUsePressableForTabs = () => getDeviceTabConfig().shouldUsePressable();
export const getTabTouchConfig = () => getDeviceTabConfig().getTouchConfig();
export const getTabStyleConfig = () => getDeviceTabConfig().getStyleConfig();
export const createTabStyles = (colors: any) => getDeviceTabConfig().createDynamicStyles(colors);