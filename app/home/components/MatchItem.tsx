// app/home/components/MatchItem.tsx
import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { logger } from '../../../utils/logger';
import { TOUCH_SLOP, MATCH_CONSTANTS } from '../../../utils/constants';
import { getMatchPlayerNames, areScoresValid, normalizeScore } from '../../../utils/playerUtils';
import { clearMatchCache } from '../../../services/matchServices';
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
    
    // Debug counter for force refresh on multiple taps
    const [debugTapCount, setDebugTapCount] = React.useState(0);
    
    // Get formatted player names using utility function
    const { player1Name, player2Name } = getMatchPlayerNames(item);
    
    // Enhanced score validation and consistent display using utility functions
    const hasValidScores = areScoresValid(item.score1, item.score2);
    const score1 = normalizeScore(item.score1);
    const score2 = normalizeScore(item.score2);
    const scoreDisplay = hasValidScores ? `${score1} - ${score2}` : 'vs';
    
    const scheduledDate = formatDate(item.scheduled_date);
    // Enhanced winner validation with data consistency checking
    const isMatchFinished = item.status_code === MATCH_CONSTANTS.STATUS.FINISHED;
    const hasWinnerId = item.winner_id != null && item.winner_id !== undefined;
    
    let isPlayer1Winner = false;
    let isPlayer2Winner = false;
    
    if (isMatchFinished && hasValidScores) {
        // Primary validation: Use scores as the most reliable indicator
        const scoreBasedWinner1 = score1 > score2;
        const scoreBasedWinner2 = score2 > score1;
        const isScoreTie = score1 === score2;
        
        // Enhanced data consistency logging
        const dataConsistencyInfo = {
            api_match_id: item.api_match_id,
            scores: `${score1}-${score2}`,
            winner_id: item.winner_id,
            player1_id: item.player1_id,
            player2_id: item.player2_id,
            status_code: item.status_code,
            scoreBasedWinner: scoreBasedWinner1 ? 'Player1' : scoreBasedWinner2 ? 'Player2' : 'Tie'
        };
        
        if (isScoreTie && hasWinnerId) {
            logger.warn(`[MatchItem] DATA INCONSISTENCY: Tie score but winner_id exists:`, dataConsistencyInfo);
        }
        
        if (hasWinnerId) {
            // Validate that winner_id matches score-based winner
            const winnerIdBasedWinner1 = item.winner_id === item.player1_id;
            const winnerIdBasedWinner2 = item.winner_id === item.player2_id;
            
            // Check for data inconsistency
            const isWinnerIdConsistent = 
                (scoreBasedWinner1 && winnerIdBasedWinner1) || 
                (scoreBasedWinner2 && winnerIdBasedWinner2) ||
                isScoreTie; // Allow winner_id on ties (possible in snooker)
            
            if (isWinnerIdConsistent) {
                isPlayer1Winner = winnerIdBasedWinner1;
                isPlayer2Winner = winnerIdBasedWinner2;
                logger.debug(`[MatchItem] Using consistent winner_id for match ${item.api_match_id}: ${item.winner_id}`);
            } else {
                // DATA INCONSISTENCY DETECTED - Use scores as authoritative
                isPlayer1Winner = scoreBasedWinner1;
                isPlayer2Winner = scoreBasedWinner2;
                logger.error(`[MatchItem] 🚨 DATA INCONSISTENCY DETECTED:`, {
                    ...dataConsistencyInfo,
                    winnerIdBasedWinner: winnerIdBasedWinner1 ? 'Player1' : winnerIdBasedWinner2 ? 'Player2' : 'Neither',
                    action: 'Using score-based winner as authoritative'
                });
                
                // Clear cache for this match to force fresh data on next access
                if (item.api_match_id) {
                    clearMatchCache(item.api_match_id);
                    logger.debug(`[MatchItem] Cache cleared for inconsistent match ${item.api_match_id}`);
                }
            }
        } else {
            // No winner_id, use score comparison
            isPlayer1Winner = scoreBasedWinner1;
            isPlayer2Winner = scoreBasedWinner2;
            logger.debug(`[MatchItem] Using score-based winner for match ${item.api_match_id}: ${score1}-${score2}`);
        }
    }
    
    const handlePlayerPress = (playerId: number | null) => {
        if (playerId) {
            navigation.push(`/player/${playerId}`);
        }
    };
    
    const handleMatchPress = (apiMatchId: number | null) => {
        if (apiMatchId) {
            // Debug functionality: Multiple taps force cache refresh
            const newTapCount = debugTapCount + 1;
            setDebugTapCount(newTapCount);
            
            if (newTapCount >= 5) {
                // After 5 taps, force cache refresh for this match
                logger.log(`[MatchItem] DEBUG: Force refreshing cache for match ${apiMatchId} after ${newTapCount} taps`);
                clearMatchCache(apiMatchId);
                setDebugTapCount(0);
            }
            
            navigation.push(`/match/${apiMatchId}`);
        } else {
            logger.warn("Cannot navigate: missing api_match_id");
        }
    };

    return (
        <TouchableOpacity 
            onPress={() => handleMatchPress(item.api_match_id)} 
            disabled={!item.api_match_id} 
            activeOpacity={0.6}
            hitSlop={{ top: 35, bottom: 35, left: 35, right: 35 }}
            delayPressIn={0}
            delayPressOut={0}
            pressRetentionOffset={{ top: 40, bottom: 40, left: 40, right: 40 }}
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
    // Custom comparison for React.memo to ensure re-render when any relevant data changes
    const prevItem = prevProps.item;
    const nextItem = nextProps.item;
    
    // Compare all critical fields that affect display
    const isEqual = (
        prevItem.id === nextItem.id &&
        prevItem.score1 === nextItem.score1 &&
        prevItem.score2 === nextItem.score2 &&
        prevItem.status_code === nextItem.status_code &&
        prevItem.winner_id === nextItem.winner_id &&
        prevItem.player1_id === nextItem.player1_id &&
        prevItem.player2_id === nextItem.player2_id &&
        prevItem.player1_name === nextItem.player1_name &&
        prevItem.player2_name === nextItem.player2_name &&
        prevItem.api_match_id === nextItem.api_match_id &&
        prevProps.tourName === nextProps.tourName
    );
    
    // Log when re-render occurs for debugging
    if (!isEqual) {
        logger.debug(`[MatchItem] Re-rendering match ${nextItem.api_match_id} due to data change`);
    }
    
    return isEqual;
});

MatchItem.displayName = 'MatchItem';
