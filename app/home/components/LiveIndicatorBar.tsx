// app/home/components/LiveIndicatorBar.tsx
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Match } from '../types';

interface LiveIndicatorBarProps {
    isMonitoring: boolean;
    nextMatchInfo: {
        match: Match;
        minutesUntilStart: number;
    } | null;
    liveUpdateCount: number;
    colors: any;
}

export const LiveIndicatorBar: React.FC<LiveIndicatorBarProps> = ({
    isMonitoring,
    nextMatchInfo,
    liveUpdateCount,
    colors
}) => {
    if (!isMonitoring && !nextMatchInfo) return null;

    const getStatusText = () => {
        if (nextMatchInfo) {
            const { match, minutesUntilStart } = nextMatchInfo;
            const playerNames = `${match.player1_name || 'Player 1'} vs ${match.player2_name || 'Player 2'}`;
            
            if (minutesUntilStart <= 1) {
                return `🔴 ${playerNames} starting now!`;
            } else if (minutesUntilStart <= 5) {
                return `⏱️ ${playerNames} in ${minutesUntilStart}min`;
            }
        }
        
        if (isMonitoring) {
            return liveUpdateCount > 0 
                ? `🔄 Live monitoring (${liveUpdateCount} updates)`
                : '📡 Monitoring for live matches';
        }
        
        return '';
    };

    const getStatusColor = () => {
        if (nextMatchInfo?.minutesUntilStart && nextMatchInfo.minutesUntilStart <= 1) {
            return '#FF6B35'; // Urgent orange-red
        } else if (nextMatchInfo?.minutesUntilStart && nextMatchInfo.minutesUntilStart <= 5) {
            return '#FFA726'; // Warning orange
        }
        return colors.success; // Monitoring green
    };

    const statusText = getStatusText();
    if (!statusText) return null;

    return (
        <View style={[styles.container, { backgroundColor: `${getStatusColor()}15` }]}>
            <View style={styles.content}>
                <View style={styles.iconContainer}>
                    <View style={[styles.pulsingDot, { backgroundColor: getStatusColor() }]} />
                    <Ionicons 
                        name="radio-outline" 
                        size={16} 
                        color={getStatusColor()} 
                        style={styles.icon}
                    />
                </View>
                <Text style={[styles.statusText, { color: getStatusColor() }]} numberOfLines={1}>
                    {statusText}
                </Text>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        marginHorizontal: 16,
        marginVertical: 8,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: 'rgba(255, 167, 38, 0.3)',
    },
    content: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingVertical: 8,
    },
    iconContainer: {
        position: 'relative',
        marginRight: 8,
    },
    pulsingDot: {
        position: 'absolute',
        width: 8,
        height: 8,
        borderRadius: 4,
        top: 4,
        left: -4,
        opacity: 0.8,
    },
    icon: {
        marginLeft: 4,
    },
    statusText: {
        fontSize: 14,
        fontFamily: 'PoppinsMedium',
        flex: 1,
    },
});