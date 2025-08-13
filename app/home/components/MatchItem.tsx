// app/home/components/MatchItem.tsx
import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { logger } from '../../../utils/logger';
import { TOUCH_SLOP, MATCH_CONSTANTS } from '../../../utils/constants';
import { getMatchPlayerNames, areScoresValid, normalizeScore } from '../../../utils/playerUtils';
import { GlassCard } from '../../components/modern/GlassCard';
import { LiveIndicator } from '../../components/modern/LiveIndicator';
import { MatchListItem } from '../types';
import { formatDate } from '../utils/dateFormatting';
import { ICONS } from '../utils/icons';
import { useHomeColors } from '../hooks/useHomeColors';
import { createStyles } from '../styles/homeStyles';

interface MatchItemProps {
    item: MatchListItem;
    tourName: string | null;
    navigation: any;
}

export const MatchItem = React.memo(({
    item,
    tourName,
    navigation
}: MatchItemProps) => {
    const COLORS = useHomeColors();
    const styles = createStyles(COLORS);
    
    // Get formatted player names using utility function
    const { player1Name, player2Name } = getMatchPlayerNames(item);
    
    // Enhanced score validation and consistent display using utility functions
    const hasValidScores = areScoresValid(item.score1, item.score2);
    const score1 = normalizeScore(item.score1);
    const score2 = normalizeScore(item.score2);
    const scoreDisplay = hasValidScores ? `${score1} - ${score2}` : 'vs';
    
    const scheduledDate = formatDate(item.scheduled_date);
    // Enhanced winner validation - check both winner_id and scores for consistency
    const isMatchFinished = item.status_code === MATCH_CONSTANTS.STATUS.FINISHED;
    const hasWinnerId = item.winner_id != null && item.winner_id !== undefined;
    
    let isPlayer1Winner = false;
    let isPlayer2Winner = false;
    
    if (isMatchFinished) {
        if (hasWinnerId) {
            // Use winner_id if available
            isPlayer1Winner = item.winner_id === item.player1_id;
            isPlayer2Winner = item.winner_id === item.player2_id;
        } else if (hasValidScores) {
            // Fallback to score comparison if no winner_id
            isPlayer1Winner = score1 > score2;
            isPlayer2Winner = score2 > score1;
        }
    }
    
    const handlePlayerPress = (playerId: number | null) => {
        if (playerId) {
            navigation.push(`/player/${playerId}`);
        }
    };
    
    const handleMatchPress = (apiMatchId: number | null) => {
        if (apiMatchId) {
            navigation.push(`/match/${apiMatchId}`);
        } else {
            logger.warn("Cannot navigate: missing api_match_id");
        }
    };

    return (
        <TouchableOpacity 
            onPress={() => handleMatchPress(item.api_match_id)} 
            disabled={!item.api_match_id} 
            activeOpacity={0.8}
            hitSlop={TOUCH_SLOP.MEDIUM}
            delayPressIn={0}
        >
            <GlassCard style={styles.matchItemContainer}>
                {item.matchCategory === 'livePlaying' && <LiveIndicator />}
                <View style={styles.playerRow}>
                    <Text 
                        style={[styles.playerName, styles.playerLeft, isPlayer1Winner && styles.winnerText]} 
                        onPress={() => handlePlayerPress(item.player1_id)} 
                        disabled={!item.player1_id} 
                        numberOfLines={1}
                    >
                        {player1Name}
                    </Text>
                    
                    <Text style={styles.score}>{scoreDisplay}</Text>
                    
                    <Text 
                        style={[styles.playerName, styles.playerRight, isPlayer2Winner && styles.winnerText]} 
                        onPress={() => handlePlayerPress(item.player2_id)} 
                        disabled={!item.player2_id} 
                        numberOfLines={1}
                    >
                        {player2Name}
                    </Text>
                </View>
                
                <View style={styles.detailsRow}>
                    <View style={styles.detailItem}>
                        <Ionicons name={ICONS.calendar} size={11} color={COLORS.textSecondary} />
                        <Text style={styles.detailText}>{scheduledDate}</Text>
                    </View>
                    
                    {tourName && (
                        <View style={[styles.detailItem, { justifyContent: 'flex-end' }]}>
                            <Ionicons name={ICONS.trophy} size={11} color={COLORS.textSecondary} />
                            <Text style={[styles.detailText, { textAlign: 'right' }]} numberOfLines={1}>
                                {tourName}
                            </Text>
                        </View>
                    )}
                </View>
            </GlassCard>
        </TouchableOpacity>
    );
}, (prevProps, nextProps) => {
    // Custom comparison for React.memo to ensure re-render when scores change
    const prevItem = prevProps.item;
    const nextItem = nextProps.item;
    
    return (
        prevItem.id === nextItem.id &&
        prevItem.score1 === nextItem.score1 &&
        prevItem.score2 === nextItem.score2 &&
        prevItem.status_code === nextItem.status_code &&
        prevItem.winner_id === nextItem.winner_id &&
        prevItem.player1_name === nextItem.player1_name &&
        prevItem.player2_name === nextItem.player2_name &&
        prevProps.tourName === nextProps.tourName
    );
});

MatchItem.displayName = 'MatchItem';
