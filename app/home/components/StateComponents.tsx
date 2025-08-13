// app/home/components/StateComponents.tsx
import React from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { GlassCard } from '../../components/modern/GlassCard';
import { ICONS } from '../utils/icons';

interface StateComponentProps {
    COLORS: any;
    styles: any;
    error?: string | null;
    tourName?: string | null;
    onRetry?: () => void;
}

export const LoadingComponent = ({ COLORS, styles }: StateComponentProps) => (
    <View style={styles.centerContent}>
        <ActivityIndicator size="large" color={COLORS.accentLight}/>
        <Text style={styles.messageText}>Loading...</Text>
    </View>
);

export const ErrorComponent = ({ COLORS, styles, error, onRetry }: StateComponentProps) => (
    <View style={styles.centerContent}>
        <Ionicons name={ICONS.error} size={36} color={COLORS.error} />
        <Text style={[styles.messageText, { color: COLORS.error }]}>Error: {error}</Text>
        <TouchableOpacity onPress={onRetry} style={styles.retryButton}>
            <Ionicons name={ICONS.refresh} size={16} color={COLORS.white} />
            <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
    </View>
);

export const EmptyComponent = ({ COLORS, styles, tourName }: StateComponentProps) => (
    <View style={styles.centerContent}>
        <GlassCard>
            <Ionicons name={ICONS.empty} size={36} color={COLORS.textMuted} />
            <Text style={styles.messageText}>
                {tourName ? 'No matches found for the selected filter.' : 'No active tournament.'}
            </Text>
        </GlassCard>
    </View>
);
