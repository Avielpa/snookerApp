// _layout.tsx - Root Layout with Theme System
import React, { useEffect } from 'react';
import { ImageBackground, View, StyleSheet, StatusBar } from 'react-native';
import { Stack } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as Updates from 'expo-updates';
import { ThemeProvider, useTheme } from '../contexts/ThemeContext';
import { logger } from '../utils/logger';
import { api } from '../services/api';

// --- Component Imports ---
import Header from './components/Header';
import BottomBar from './components/BottomBar';
import ErrorBoundary from '../components/ErrorBoundary';

// Main Layout Component - wraps everything in ThemeProvider
const ThemedLayout = () => {
    const { theme } = useTheme();
    const colors = theme.colors;

    // Check for OTA update on startup and apply immediately if available
    useEffect(() => {
        const checkForUpdate = async () => {
            try {
                if (!Updates.isEmbeddedLaunch) {
                    // Already running an OTA bundle — check for a newer one
                    const update = await Updates.checkForUpdateAsync();
                    if (update.isAvailable) {
                        logger.log('[OTA] New update available — downloading...');
                        await Updates.fetchUpdateAsync();
                        logger.log('[OTA] Update downloaded — reloading app');
                        await Updates.reloadAsync();
                    }
                }
            } catch (e) {
                // Non-fatal — silently skip if update check fails
            }
        };
        checkForUpdate();
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
            <ImageBackground
                source={require('../assets/snooker_background.jpg')}
                resizeMode='cover'
                style={[styles.background, { backgroundColor: colors.background }]}
            >
                <Header />
                
                <View style={styles.contentArea}>
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
                
                <BottomBar />
            </ImageBackground>
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
    contentArea: {
        flex: 1,
    },
});

