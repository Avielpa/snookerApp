// _layout.tsx - Root Layout with Theme System
import React, { useEffect } from 'react';
import { View, StyleSheet, StatusBar } from 'react-native';
import { Stack, usePathname } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as Updates from 'expo-updates';
import * as SplashScreen from 'expo-splash-screen';
import { ThemeProvider, useTheme } from '../contexts/ThemeContext';
import { GameProvider } from '../contexts/GameContext';
import { AuthProvider, useAuth } from '../contexts/AuthContext';
import { logger } from '../utils/logger';
import { api } from '../services/api';
import { initPushNotifications } from '../utils/notifications';
import { loadFavorites } from '../services/favoritesService';
import { useDeviceType } from '../hooks/useDeviceType';
import { useAnalyticsScreenTracking } from '../hooks/useAnalyticsScreenTracking';
import { shouldShowScoreboardBanner } from '../services/scoreboardBannerService';

// --- Component Imports ---
import Header from './components/Header';
import BottomBar from './components/BottomBar';
import SideNav from './components/SideNav';
import ScoreboardBanner from './components/ScoreboardBanner';
import ErrorBoundary from '../components/ErrorBoundary';

// Keep the native splash screen visible past the default auto-hide point —
// held open in ThemedLayout below until auth state (the one real async
// readiness signal this app has before first paint) has resolved. Must be
// called at module scope so it takes effect before the first render.
SplashScreen.preventAutoHideAsync().catch(() => {});

// Main Layout Component - wraps everything in ThemeProvider
const ThemedLayout = () => {
    const { theme } = useTheme();
    const colors = theme.colors;
    const device = useDeviceType();
    const pathname = usePathname();
    const { loading: authLoading } = useAuth();

    // Log a screen_view analytics event on every route change
    useAnalyticsScreenTracking();

    // Hide the native splash screen once critical initial state (auth) is
    // resolved, instead of the default "as soon as JS renders" auto-hide —
    // avoids a flash of stale/incorrect logged-in-vs-out chrome.
    useEffect(() => {
        if (!authLoading) {
            SplashScreen.hideAsync().catch(() => {});
        }
    }, [authLoading]);

    // Brief scoreboard discovery banner — shows on every launch for a limited
    // window of days, skipped while already inside the scoreboard section.
    const [showScoreboardBanner, setShowScoreboardBanner] = React.useState(false);
    useEffect(() => {
        if (pathname?.startsWith('/scoreboard')) return;
        shouldShowScoreboardBanner().then(setShowScoreboardBanner);
    }, []);

    // React to updates found by the automatic ON_LOAD check and apply immediately
    const { isUpdateAvailable } = Updates.useUpdates();

    useEffect(() => {
        if (__DEV__ || !isUpdateAvailable) return;
        logger.log('[OTA] Update available — downloading and applying...');
        Updates.fetchUpdateAsync()
            .then(() => Updates.reloadAsync())
            .catch((e: any) => logger.warn(`[OTA] Apply failed: ${e?.message}`));
    }, [isUpdateAvailable]);

    // Register device for push notifications + prime the favourites cache
    useEffect(() => {
        initPushNotifications();
        loadFavorites().catch(() => {}); // warm the in-memory cache
    }, []);


    // Test API connectivity on app start
    useEffect(() => {
        const testAPIConnectivity = async () => {
            try {
                logger.log('[App Startup] Testing API connectivity...');
                const response = await api.get('events/');
                if (Array.isArray(response.data) && response.data.length > 0) {
                    logger.log(`[App Startup] ✅ API is working! Found ${response.data.length} tournaments`);
                    logger.log(`[App Startup] Sample tournament: ${response.data[0]?.Name || 'Unknown'}`);
                } else {
                    logger.warn('[App Startup] ⚠️ API returned empty or invalid data:', response.data);
                }
            } catch (error: any) {
                logger.error('[App Startup] ❌ API connectivity test failed:', {
                    message: error.message,
                    status: error.response?.status,
                    statusText: error.response?.statusText,
                    url: error.config?.url,
                    baseURL: error.config?.baseURL
                });
            }
        };

        testAPIConnectivity();
    }, []);
    
    return (
        <SafeAreaProvider>
            <StatusBar
                barStyle={theme.isDark ? "light-content" : "dark-content"}
                backgroundColor={colors.background}
            />
            <View style={[styles.background, { backgroundColor: colors.background }]}>
                {device !== 'tv' && <Header />}

                <View style={styles.mainRow}>
                    {device === 'tv' && <SideNav device={device} />}

                    <View style={styles.contentArea}>
                        <Stack
                            screenOptions={{
                                headerShown: false,
                                contentStyle: {
                                    backgroundColor: 'transparent'
                                },
                                animation: 'fade',
                            }}
                        >
                            {/* Match Details: overriding animation:'none' from inside the
                                pushed screen itself (MatchEnhanced.tsx) never worked because
                                the entrance-transition animation is decided by the navigator
                                at push time, before the destination screen has rendered its
                                own <Stack.Screen> options. The real override has to live here,
                                at the navigator level, to actually suppress the fade-in this
                                screen was pushed with. */}
                            <Stack.Screen name="match/[matchId]" options={{ animation: 'none' }} />
                        </Stack>
                    </View>
                </View>

                {device !== 'tv' && <BottomBar />}

                <ScoreboardBanner
                    visible={showScoreboardBanner}
                    onHide={() => setShowScoreboardBanner(false)}
                />
            </View>
        </SafeAreaProvider>
    );
};

export default function RootLayout() {
    return (
        <ErrorBoundary>
            <ThemeProvider>
                <AuthProvider>
                    <GameProvider>
                        <ThemedLayout />
                    </GameProvider>
                </AuthProvider>
            </ThemeProvider>
        </ErrorBoundary>
    );
}

// --- Styles ---
const styles = StyleSheet.create({
    background: {
        flex: 1,
    },
    mainRow: {
        flex: 1,
        flexDirection: 'row',
    },
    contentArea: {
        flex: 1,
    },
    contentAreaTablet: {
        maxWidth: 960,
        alignSelf: 'center',
        width: '100%',
    },
});

