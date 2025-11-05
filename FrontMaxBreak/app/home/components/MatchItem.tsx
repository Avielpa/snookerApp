// app/home/components/MatchItem.tsx
import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { logger } from '../../../utils/logger';
import { TOUCH_SLOP, MATCH_CONSTANTS } from '../../../utils/constants';
import { getMatchPlayerNames, areScoresValid, normalizeScore } from '../../../utils/playerUtils';
import { clearMatchCache } from '../../../services/matchServices';
import { ModernGlassCard } from '../../components/modern/ModernGlassCard';  // MODERN CARD
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

export const MatchItem = ({
    item,
    tourName,
    navigation
}: MatchItemProps) => {
    const COLORS = useHomeColors();
    const styles = createStyles(COLORS);
    
    // Debug counter for force refresh on multiple taps
    const [debugTapCount, setDebugTapCount] = React.useState(0);
    
    // Get formatted player names - DIRECT from backend JSON
    const { player1Name, player2Name} = getMatchPlayerNames(item);

    // Get and normalize scores - DIRECT from backend JSON
    const hasValidScores = areScoresValid(item.score1, item.score2);
    let score1 = normalizeScore(item.score1);
    let score2 = normalizeScore(item.score2);
    const scoreDisplay = hasValidScores ? `${score1} - ${score2}` : 'vs';

    const scheduledDate = formatDate(item.scheduled_date);
    
    
    // CORRECT: Only highlight winner AFTER match is finished (status_code = 3)
    const isMatchFinished = item.status_code === 3;
    
    // Enhanced winner detection: Use winner_id if available, otherwise fall back to scores
    let isPlayer1Winner = false;
    let isPlayer2Winner = false;
    
    // Winner detection - SIMPLE and DIRECT like match details screen
    if (isMatchFinished && hasValidScores) {
        const winnerId = item.winner_id;
        const player1Id = item.player1_id;
        const player2Id = item.player2_id;

        if (winnerId && player1Id && player2Id) {
            // Use winner_id from backend
            isPlayer1Winner = (winnerId === player1Id);
            isPlayer2Winner = (winnerId === player2Id);
        } else {
            // Fallback to score comparison
            isPlayer1Winner = (score1 > score2);
            isPlayer2Winner = (score2 > score1);
        }
    }
    
    const handlePlayerPress = (playerId: number | null) => {
        // CRASH FIX: Enhanced player ID validation before navigation
        if (playerId && typeof playerId === 'number' && playerId > 0 && playerId !== 376) {
            navigation.push(`/player/${playerId}`);
        } else {
            logger.debug(`[MatchItem] Skipping navigation for invalid/unknown player ID: ${playerId}`);
        }
    };
    
    const handleMatchPress = (apiMatchId: number | null) => {
        // CRASH FIX: Enhanced match ID validation before navigation
        if (apiMatchId && typeof apiMatchId === 'number' && apiMatchId > 0) {
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
            logger.warn(`[MatchItem] Cannot navigate: invalid api_match_id: ${apiMatchId}`);
        }
    };

    return (
        <TouchableOpacity
            onPress={() => handleMatchPress(item.api_match_id)}
            disabled={!item.api_match_id || typeof item.api_match_id !== 'number' || item.api_match_id <= 0}
            activeOpacity={0.6}
        >
            <ModernGlassCard style={styles.matchItemContainer}>
                {item.matchCategory === 'livePlaying' && <LiveIndicator />}

                {/* FIXED: Same pattern as match details - separate containers */}
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
                    {/* PLAYER 1 CONTAINER */}
                    <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                        <Text
                            style={[styles.playerName, isPlayer1Winner && styles.winnerText]}
                            onPress={() => handlePlayerPress(item.player1_id)}
                            disabled={!item.player1_id || item.player1_id === 376}
                            numberOfLines={1}
                        >
                            {player1Name}
                        </Text>
                        <Text style={[styles.playerScore, isPlayer1Winner && styles.winnerText]}>
                            {score1}
                        </Text>
                    </View>

                    {/* VS SEPARATOR */}
                    <Text style={styles.vsSeparator}>VS</Text>

                    {/* PLAYER 2 CONTAINER */}
                    <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                        <Text style={[styles.playerScore, isPlayer2Winner && styles.winnerText]}>
                            {score2}
                        </Text>
                        <Text
                            style={[styles.playerName, { textAlign: 'right' }, isPlayer2Winner && styles.winnerText]}
                            onPress={() => handlePlayerPress(item.player2_id)}
                            disabled={!item.player2_id || item.player2_id === 376}
                            numberOfLines={1}
                        >
                            {player2Name}
                        </Text>
                    </View>
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


            </ModernGlassCard>
        </TouchableOpacity>
    );
};

MatchItem.displayName = 'MatchItem';
