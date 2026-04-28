// _layout.tsx - Root Layout with Theme System
import React, { useEffect } from 'react';
import { View, StyleSheet, StatusBar } from 'react-native';
import { Stack } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as Updates from 'expo-updates';
import { ThemeProvider, useTheme } from '../contexts/ThemeContext';
import { logger } from '../utils/logger';
import { api } from '../services/api';
import { initPushNotifications } from '../utils/notifications';
import { loadFavorites } from '../services/favoritesService';
import { useDeviceType } from '../hooks/useDeviceType';

// --- Component Imports ---
import Header from './components/Header';
import BottomBar from './components/BottomBar';
import SideNav from './components/SideNav';
import ErrorBoundary from '../components/ErrorBoundary';

// Main Layout Component - wraps everything in ThemeProvider
const ThemedLayout = () => {
    const { theme } = useTheme();
    const colors = theme.colors;
    const device = useDeviceType();

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
                {device === 'phone' && <Header />}

                <View style={styles.mainRow}>
                    {device !== 'phone' && <SideNav device={device} />}

                    <View style={[
                        styles.contentArea,
                        device === 'tablet' && styles.contentAreaTablet,
                    ]}>
                        <Stack
                            screenOptions={{
                                headerShown: false,
                                contentStyle: {
                                    backgroundColor: 'transparent'
                                },
                                animation: 'fade',
                            }}
                        />
                    </View>
                </View>

                {device === 'phone' && <BottomBar />}
            </View>
        </SafeAreaProvider>
    );
};

export default function RootLayout() {
    return (
        <ErrorBoundary>
            <ThemeProvider>
                <ThemedLayout />
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

