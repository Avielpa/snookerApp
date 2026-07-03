import { Ionicons } from "@expo/vector-icons";
import { usePathname, useRouter } from "expo-router";
import React, { useRef } from "react";
import { Alert, TouchableOpacity, View, Text, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "../../contexts/ThemeContext";
import { useGameContext } from "../../contexts/GameContext";
import { logger } from "../../utils/logger";
import { logTap } from "../../services/analyticsService";



const BottomBar = () => {
    const router = useRouter();
    const pathname = usePathname();
    const insets = useSafeAreaInsets();
    const colors = useColors();
    const { isGameActive } = useGameContext();
    const alertActive = useRef(false);

    const navItems : {
        path: string;
        icon: React.ComponentProps<typeof Ionicons>["name"];
        iconOutline: React.ComponentProps<typeof Ionicons>["name"];
        label: string;
    }[] = [
        { 
            path: '/', 
            icon: 'home',
            iconOutline: 'home-outline', 
            label: 'Home' 
        },
        { 
            path: '/CalendarEnhanced', 
            icon: 'calendar', 
            iconOutline: 'calendar-outline', 
            label: 'Calendar' 
        },
        {
            path: '/RankingEnhanced',
            icon: 'trophy',
            iconOutline: 'trophy-outline',
            label: 'Rankings'
        },
        {
            path: '/NewsScreen',
            icon: 'film',
            iconOutline: 'film-outline',
            label: 'Media',
        },
        {
            path: '/StatsScreen',
            icon: 'bar-chart',
            iconOutline: 'bar-chart-outline',
            label: 'Stats',
        },
    ];

    const styles = createBottomBarStyles(colors);
    
    return (
        <View style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom, 10) }]}>
            {navItems.map((item) => {
                const isActive = pathname === item.path;
                return (
                    <TouchableOpacity 
                        key={item.path}
                        style={[styles.bottomBarItem, isActive && styles.activeBottomBarItem]} 
                        onPress={() => {
                            logTap('tab_select', { tab: item.label });
                            if (isGameActive) {
                                if (alertActive.current) return;
                                alertActive.current = true;
                                Alert.alert(
                                    'Game in progress',
                                    'Leaving will pause your game. You can resume it later.',
                                    [
                                        { text: 'Stay', style: 'cancel', onPress: () => { alertActive.current = false; } },
                                        {
                                            text: 'Leave',
                                            style: 'destructive',
                                            onPress: () => {
                                                alertActive.current = false;
                                                logger.log(`[BottomBar] Leaving game, navigating to ${item.path}`);
                                                router.push(item.path as any);
                                            },
                                        },
                                    ],
                                );
                                return;
                            }
                            logger.log(`[BottomBar] Navigating from ${pathname} to ${item.path}`);
                            router.push(item.path as any);
                        }}
                        activeOpacity={0.6}
                        hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
                        delayPressIn={0}
                    >
                        <Ionicons 
                            name={isActive ? item.icon : item.iconOutline} 
                            size={24} 
                            color={isActive ? colors.primary : colors.textSecondary} 
                        />
                        <Text style={[styles.bottomBarText, isActive && styles.activeBottomBarText]}>
                            {item.label}
                        </Text>
                    </TouchableOpacity>
                );
            })}
        </View>
    );
};
  

const createBottomBarStyles = (colors: any) => StyleSheet.create({
    bottomBar: {
        backgroundColor: colors.cardBackground,
        flexDirection: 'row',
        justifyContent: 'space-around',
        borderTopWidth: 1,
        borderTopColor: colors.cardBorder,
        paddingVertical: 8,
    },
    bottomBarItem: {
        flexDirection: 'column',
        alignItems: 'center',
        paddingVertical: 10,
        paddingHorizontal: 8,
        borderRadius: 12,
        minWidth: 60,
        minHeight: 64,
        justifyContent: 'center',
    },
    activeBottomBarItem: {
        backgroundColor: colors.filterButton,
    },
    bottomBarText: {
        color: colors.textSecondary,
        marginTop: 4,
        fontSize: 10,
        fontFamily: 'PoppinsMedium',
    },
    activeBottomBarText: {
        color: colors.primary,
        fontFamily: 'PoppinsBold',
    },
});


export default BottomBar;
