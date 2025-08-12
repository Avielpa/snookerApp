// _layout.tsx - Root Layout with Theme System
import React from 'react';
import { ImageBackground, View, StyleSheet, StatusBar } from 'react-native';
import { Stack } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ThemeProvider, useTheme } from '../contexts/ThemeContext';

// --- Component Imports ---
import Header from './components/Header';
import BottomBar from './components/BottomBar';

// Main Layout Component - wraps everything in ThemeProvider
const ThemedLayout = () => {
    const { theme } = useTheme();
    const colors = theme.colors;
    
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
        <ThemeProvider>
            <ThemedLayout />
        </ThemeProvider>
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

