// components/Sidebar.tsx
import { Feather } from "@expo/vector-icons";
import { useRouter, Href } from "expo-router";
import { logger } from '../../utils/logger';
import React, { useEffect, useRef, useState } from "react"; // Added useState
import {
  Animated,
  TouchableOpacity,
  View,
  Text,
  StyleSheet,
  Platform, // Import Platform
} from "react-native";

// Props interface
interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

// Menu item interface
interface MenuItem {
  name: string;
  icon: keyof typeof Feather.glyphMap;
  route: Href;
}

const SIDEBAR_WIDTH = 270;

const Sidebar = ({ isOpen, onClose }: SidebarProps) => {
  // Initialize translateX to the closed position (-width)
  const translateX = useRef(new Animated.Value(-SIDEBAR_WIDTH)).current;
  // State to control pointerEvents after animation finishes
  const [isAnimating, setIsAnimating] = useState(false);
  const [isVisible, setIsVisible] = useState(isOpen); // Track visibility for pointerEvents

  const router = useRouter();

  useEffect(() => {
    setIsAnimating(true); // Start animation
    if (isOpen) {
        setIsVisible(true); // Make container touchable before animation starts
    }
    Animated.timing(translateX, {
      toValue: isOpen ? 0 : -SIDEBAR_WIDTH,
      duration: 250, // Slightly faster animation
      // Consider adding easing function e.g., Easing.out(Easing.ease)
      useNativeDriver: Platform.OS !== 'web', // Use native driver only on native platforms
    }).start(() => {
        setIsAnimating(false); // End animation
        if (!isOpen) {
            setIsVisible(false); // Make container non-touchable after closing animation
        }
    }); // Animation completion callback
  }, [isOpen, translateX]);

  const menuItems: MenuItem[] = [
    { name: 'Home', icon: 'home', route: '/' },
    { name: 'Ranking', icon: 'bar-chart-2', route: '/RankingEnhanced' },
    { name: 'Calendar', icon: 'calendar', route: '/CalendarEnhanced' },
  ];

  const navigateTo = (route: Href) => {
    if (route) {
      router.push(route);
      onClose();
    } else {
      logger.warn("Sidebar: Invalid route:", route);
    }
  };

  return (
    // Conditionally apply pointerEvents based on visibility and animation state
    <View
        style={styles.sidebarContainer}
        pointerEvents={isVisible ? 'auto' : 'none'} // Only allow touches when visible
    >
      {/* Overlay - Animate its opacity */}
      <TouchableOpacity
        style={styles.overlay}
        activeOpacity={1}
        onPress={onClose}
        disabled={isAnimating || !isOpen} // Disable overlay press during animation or when closed
      >
          <Animated.View style={[styles.overlayBackground, { opacity: translateX.interpolate({ inputRange: [-SIDEBAR_WIDTH, 0], outputRange: [0, 1] }) }]} />
      </TouchableOpacity>

      {/* Animated sidebar panel */}
      <Animated.View style={[styles.sidebar, { transform: [{ translateX }] }]}>
        <View style={styles.sidebarHeader}>
          <Text style={styles.sidebarTitle}>Menu</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Feather name="x" size={24} color="white" />
          </TouchableOpacity>
        </View>

        <View style={styles.sidebarContent}>
          {menuItems.map((item) => (
            <TouchableOpacity
              key={item.name}
              style={styles.sidebarItem}
              onPress={() => navigateTo(item.route)}
            >
              <Feather name={item.icon} size={20} color="white" style={styles.itemIcon}/>
              <Text style={styles.sidebarItemText}>{item.name}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  sidebarContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1000, // Ensure it's above other content
  },
  overlay: { // Touchable overlay takes full screen
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  overlayBackground: { // Animated background for the overlay
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.5)', // Darker overlay
  },
  sidebar: {
    position: 'absolute',
    top: 0,
    left: 0,
    bottom: 0,
    width: SIDEBAR_WIDTH, // Use constant
    backgroundColor: 'rgba(11, 93, 47, 0.98)', // Slightly more opaque
    paddingTop: 60, // Adjust as needed, consider safe area
    // paddingHorizontal: 0, // Remove horizontal padding here
    borderTopRightRadius: 10, // Soften radius
    borderBottomRightRadius: 10,
    shadowColor: '#000',
    shadowOffset: { width: 2, height: 0 }, // Adjusted shadow
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 10, // Increased elevation
  },
  sidebarHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 30,
    paddingHorizontal: 20, // Add padding here
  },
   closeButton: { // Make close button easier to tap
      padding: 8,
  },
  sidebarTitle: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '700',
    // fontFamily: 'System', // Use your app's font
  },
  sidebarContent: {
    flex: 1,
  },
  sidebarItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 15, // Increased vertical padding
    paddingHorizontal: 20, // Add horizontal padding here
    // borderBottomWidth: 1, // Optional: Remove border for cleaner look
    // borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
   itemIcon: {
      marginRight: 15, // Space between icon and text
      width: 24, // Give icon a fixed width for alignment
      textAlign: 'center',
  },
  sidebarItemText: {
    color: '#FFFFFF',
    fontSize: 16,
    // marginLeft: 12, // Removed, using icon margin
    fontWeight: '500',
    // fontFamily: 'System', // Use your app's font
  },
});

export default Sidebar;