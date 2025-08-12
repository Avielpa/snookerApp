import { Ionicons } from "@expo/vector-icons";
import { usePathname, useRouter } from "expo-router";
import React from "react";
import { TouchableOpacity, View, Text, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "../../contexts/ThemeContext";



const BottomBar = () => {
    const router = useRouter();
    const pathname = usePathname();
    const insets = useSafeAreaInsets();
    const colors = useColors();

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
                        onPress={() => router.push(item.path as any)}
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
        paddingVertical: 8,
        paddingHorizontal: 16,
        borderRadius: 12,
        minWidth: 80,
    },
    activeBottomBarItem: {
        backgroundColor: colors.filterButton,
    },
    bottomBarText: {
        color: colors.textSecondary,
        marginTop: 4,
        fontSize: 12,
        fontFamily: 'PoppinsMedium',
    },
    activeBottomBarText: {
        color: colors.primary,
        fontFamily: 'PoppinsBold',
    },
});


export default BottomBar;
