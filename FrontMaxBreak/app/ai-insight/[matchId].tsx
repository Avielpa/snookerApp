// app/ai-insight/[matchId].tsx — AI Match Prediction Screen
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useColors } from '../../contexts/ThemeContext';
import {
    AIPrediction,
    MatchPlayers,
    fetchAIPrediction,
    fetchMatchPlayers,
} from '../../services/aiPredictionService';

// ── Feature rows displayed in the breakdown section ───────────────────────────

const FEATURE_ROWS: { key: keyof AIPrediction['features_p1']; label: string }[] = [
    { key: 'elo',               label: 'Elo Rating' },
    { key: 'weighted_form',     label: 'Current Form' },
    { key: 'h2h_win_rate',      label: 'H2H Record' },
    { key: 'deciding_pct',      label: 'Clutch (Deciding Frames)' },
    { key: 'avg_break_quality', label: 'Avg Break Quality' },
    { key: 'frame_dominance',   label: 'Frame Dominance' },
    { key: 'stamina_score',     label: 'Stamina (Late Frames)' },
];

// ── Helper: normalise two values to [0, 1] proportional bars ─────────────────

function proportionalBars(
    v1: number | null,
    v2: number | null,
): { b1: number; b2: number } {
    if (v1 == null && v2 == null) return { b1: 0.5, b2: 0.5 };
    const a = v1 ?? 0;
    const b = v2 ?? 0;
    // shift both so minimum is 0, then normalise
    const mn = Math.min(a, b, 0);
    const na = a - mn;
    const nb = b - mn;
    const total = na + nb;
    if (total === 0) return { b1: 0.5, b2: 0.5 };
    return { b1: na / total, b2: nb / total };
}

// ── Confidence label ──────────────────────────────────────────────────────────

function confidenceLabel(conf: string, winProb: number): string {
    const pct = Math.round(winProb * 100);
    if (conf === 'high')   return `High confidence (${pct}%)`;
    if (conf === 'medium') return `Moderate confidence (${pct}%)`;
    return `Close call (${pct}%)`;
}

// ── Main screen ───────────────────────────────────────────────────────────────

export default function AIInsightScreen() {
    const colors = useColors();
    const router = useRouter();
    const { matchId } = useLocalSearchParams<{ matchId: string }>();

    const [players, setPlayers] = useState<MatchPlayers | null>(null);
    const [prediction, setPrediction] = useState<AIPrediction | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!matchId) return;
        const id = parseInt(matchId, 10);
        if (isNaN(id)) { setError('Invalid match ID'); setLoading(false); return; }

        (async () => {
            try {
                const pm = await fetchMatchPlayers(id);
                setPlayers(pm);
                const pred = await fetchAIPrediction(pm.p1Id, pm.p2Id);
                setPrediction(pred);
            } catch {
                setError('Failed to load AI prediction. Please try again.');
            } finally {
                setLoading(false);
            }
        })();
    }, [matchId]);

    const s = styles(colors);

    // ── Derived values ────────────────────────────────────────────────────────

    const winnerName = prediction && players
        ? (prediction.predicted_winner_id === players.p1Id ? players.p1Name : players.p2Name)
        : '';

    const winnerProb = prediction
        ? (prediction.predicted_winner_id === (players?.p1Id ?? 0)
            ? prediction.p1_win_probability
            : prediction.p2_win_probability)
        : 0;

    const loserProb = 1 - winnerProb;

    // ── Render ────────────────────────────────────────────────────────────────

    return (
        <SafeAreaView style={s.container} edges={['top', 'left', 'right']}>
            <Stack.Screen options={{ headerShown: false }} />

            {/* Header */}
            <View style={s.header}>
                <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                    <Ionicons name="arrow-back" size={22} color={colors.textPrimary} />
                </TouchableOpacity>
                <Text style={s.headerTitle}>AI Prediction</Text>
                <View style={{ width: 22 }} />
            </View>

            {/* Loading */}
            {loading && (
                <View style={s.center}>
                    <ActivityIndicator size="large" color={colors.primary} />
                    <Text style={s.loadingText}>Analysing match data...</Text>
                </View>
            )}

            {/* Error */}
            {!loading && error && (
                <View style={s.center}>
                    <Ionicons name="wifi-outline" size={40} color={colors.textMuted} />
                    <Text style={s.errorText}>{error}</Text>
                    <TouchableOpacity onPress={() => router.back()} style={[s.retryBtn, { borderColor: colors.primary }]}>
                        <Text style={{ color: colors.primary, fontFamily: 'PoppinsRegular' }}>Go Back</Text>
                    </TouchableOpacity>
                </View>
            )}

            {/* Content */}
            {!loading && !error && prediction && players && (
                <ScrollView contentContainerStyle={s.scrollContent} showsVerticalScrollIndicator={false}>

                    {/* Player names */}
                    <View style={s.playersRow}>
                        <Text style={s.playerName} numberOfLines={1}>{players.p1Name}</Text>
                        <Text style={s.vsText}>vs</Text>
                        <Text style={s.playerName} numberOfLines={1}>{players.p2Name}</Text>
                    </View>

                    {/* Verdict card */}
                    <View style={s.verdictCard}>
                        <Text style={s.verdictLabel}>Predicted Winner</Text>
                        <Text style={s.verdictWinner}>{winnerName}</Text>
                        <Text style={[s.confidenceLabel, {
                            color: prediction.confidence === 'high' ? '#22C55E'
                                : prediction.confidence === 'medium' ? '#F59E0B'
                                : colors.textSecondary,
                        }]}>
                            {confidenceLabel(prediction.confidence, winnerProb)}
                        </Text>

                        {/* Probability bar */}
                        <View style={s.probBarContainer}>
                            <Text style={s.probBarName} numberOfLines={1}>{players.p1Name}</Text>
                            <View style={s.probBarTrack}>
                                <View style={[s.probBarFill, {
                                    width: `${Math.round(prediction.p1_win_probability * 100)}%`,
                                    backgroundColor: prediction.predicted_winner_id === players.p1Id
                                        ? '#22C55E' : colors.textMuted,
                                }]} />
                            </View>
                            <Text style={s.probBarPct}>{Math.round(prediction.p1_win_probability * 100)}%</Text>
                        </View>
                        <View style={s.probBarContainer}>
                            <Text style={s.probBarName} numberOfLines={1}>{players.p2Name}</Text>
                            <View style={s.probBarTrack}>
                                <View style={[s.probBarFill, {
                                    width: `${Math.round(prediction.p2_win_probability * 100)}%`,
                                    backgroundColor: prediction.predicted_winner_id === players.p2Id
                                        ? '#22C55E' : colors.textMuted,
                                }]} />
                            </View>
                            <Text style={s.probBarPct}>{Math.round(prediction.p2_win_probability * 100)}%</Text>
                        </View>

                        <Text style={s.modelBadge}>
                            {prediction.model_version === 'xgboost_trained'
                                ? `XGBoost model${prediction.model_brier_score ? ` · Brier ${prediction.model_brier_score}` : ''}`
                                : 'Rule-based model (training data pending)'}
                        </Text>
                    </View>

                    {/* Top factors */}
                    {prediction.top_factors.length > 0 && (
                        <View style={s.card}>
                            <Text style={s.sectionTitle}>Key Factors</Text>
                            {prediction.top_factors.map((f, i) => (
                                <View key={i} style={s.factorRow}>
                                    <Text style={s.factorBullet}>•</Text>
                                    <Text style={s.factorText}>{f}</Text>
                                </View>
                            ))}
                        </View>
                    )}

                    {/* Feature breakdown */}
                    <View style={s.card}>
                        <Text style={s.sectionTitle}>Statistical Breakdown</Text>
                        <View style={s.featureHeader}>
                            <Text style={[s.featurePlayerLabel, { textAlign: 'left' }]} numberOfLines={1}>
                                {players.p1Name}
                            </Text>
                            <View style={{ flex: 1 }} />
                            <Text style={[s.featurePlayerLabel, { textAlign: 'right' }]} numberOfLines={1}>
                                {players.p2Name}
                            </Text>
                        </View>
                        {FEATURE_ROWS.map(({ key, label }) => {
                            const v1 = prediction.features_p1[key] as number | null;
                            const v2 = prediction.features_p2[key] as number | null;
                            const { b1, b2 } = proportionalBars(v1, v2);
                            const p1Wins = v1 !== null && v2 !== null && v1 > v2;
                            const p2Wins = v1 !== null && v2 !== null && v2 > v1;
                            return (
                                <View key={key} style={s.featureRow}>
                                    {/* P1 bar (right-aligned) */}
                                    <View style={s.featureBarLeft}>
                                        <View style={[s.featureBarFill, {
                                            width: `${Math.round(b1 * 100)}%`,
                                            backgroundColor: p1Wins ? '#22C55E' : colors.textMuted,
                                            alignSelf: 'flex-end',
                                        }]} />
                                    </View>
                                    <Text style={s.featureLabel}>{label}</Text>
                                    {/* P2 bar (left-aligned) */}
                                    <View style={s.featureBarRight}>
                                        <View style={[s.featureBarFill, {
                                            width: `${Math.round(b2 * 100)}%`,
                                            backgroundColor: p2Wins ? '#22C55E' : colors.textMuted,
                                            alignSelf: 'flex-start',
                                        }]} />
                                    </View>
                                </View>
                            );
                        })}
                    </View>

                    {/* Claude narrative */}
                    <View style={s.card}>
                        <View style={s.narrativeHeader}>
                            <Ionicons name="sparkles" size={16} color={colors.primary} />
                            <Text style={s.sectionTitle}>AI Analysis</Text>
                        </View>
                        <Text style={s.narrativeText}>{prediction.narrative}</Text>
                        <Text style={s.narrativeFooter}>Powered by Claude · For informational use only</Text>
                    </View>

                    {/* Full comparison link */}
                    <TouchableOpacity
                        style={[s.compareBtn, { borderColor: colors.primary }]}
                        onPress={() => router.push(`/compare?p1=${players.p1Id}&p2=${players.p2Id}` as any)}
                    >
                        <Ionicons name="stats-chart-outline" size={16} color={colors.primary} />
                        <Text style={[s.compareBtnText, { color: colors.primary }]}>
                            View Full Career Comparison
                        </Text>
                    </TouchableOpacity>

                    <View style={{ height: 32 }} />
                </ScrollView>
            )}
        </SafeAreaView>
    );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = (colors: ReturnType<typeof useColors>) => StyleSheet.create({
    container:       { flex: 1, backgroundColor: colors.background },
    center:          { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24 },
    loadingText:     { fontFamily: 'PoppinsRegular', fontSize: 14, color: colors.textSecondary, marginTop: 8 },
    errorText:       { fontFamily: 'PoppinsRegular', fontSize: 14, color: colors.textSecondary, textAlign: 'center' },
    retryBtn:        { borderWidth: 1, borderRadius: 8, paddingHorizontal: 20, paddingVertical: 8, marginTop: 8 },

    // Header
    header:          { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.08)' },
    headerTitle:     { fontFamily: 'PoppinsBold', fontSize: 17, color: colors.textPrimary },

    scrollContent:   { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8 },

    // Players row
    playersRow:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 16, gap: 8 },
    playerName:      { fontFamily: 'PoppinsBold', fontSize: 14, color: colors.textPrimary, flex: 1, textAlign: 'center' },
    vsText:          { fontFamily: 'PoppinsRegular', fontSize: 12, color: colors.textMuted },

    // Verdict
    verdictCard:     { backgroundColor: 'rgba(26,115,58,0.12)', borderRadius: 12, borderWidth: 1, borderColor: 'rgba(26,115,58,0.3)', padding: 16, marginBottom: 12 },
    verdictLabel:    { fontFamily: 'PoppinsRegular', fontSize: 12, color: colors.textSecondary, textAlign: 'center', marginBottom: 4 },
    verdictWinner:   { fontFamily: 'PoppinsBold', fontSize: 26, color: '#22C55E', textAlign: 'center', marginBottom: 4 },
    confidenceLabel: { fontFamily: 'PoppinsRegular', fontSize: 13, textAlign: 'center', marginBottom: 12 },

    probBarContainer: { flexDirection: 'row', alignItems: 'center', marginBottom: 6, gap: 8 },
    probBarName:     { fontFamily: 'PoppinsRegular', fontSize: 11, color: colors.textSecondary, width: 90 },
    probBarTrack:    { flex: 1, height: 6, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 3, overflow: 'hidden' },
    probBarFill:     { height: 6, borderRadius: 3 },
    probBarPct:      { fontFamily: 'PoppinsBold', fontSize: 11, color: colors.textSecondary, width: 30, textAlign: 'right' },

    modelBadge:      { fontFamily: 'PoppinsRegular', fontSize: 10, color: colors.textMuted, textAlign: 'center', marginTop: 10 },

    // Cards
    card:            { backgroundColor: colors.surface || 'rgba(255,255,255,0.05)', borderRadius: 12, padding: 14, marginBottom: 12 },
    sectionTitle:    { fontFamily: 'PoppinsBold', fontSize: 14, color: colors.textPrimary, marginBottom: 10, marginLeft: 6 },

    // Top factors
    factorRow:       { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 6, paddingHorizontal: 4 },
    factorBullet:    { color: '#22C55E', fontSize: 16, marginRight: 8, lineHeight: 20 },
    factorText:      { fontFamily: 'PoppinsRegular', fontSize: 13, color: colors.textSecondary, flex: 1, lineHeight: 20 },

    // Feature breakdown
    featureHeader:   { flexDirection: 'row', marginBottom: 8, paddingHorizontal: 4 },
    featurePlayerLabel: { fontFamily: 'PoppinsBold', fontSize: 11, color: colors.textSecondary, flex: 1 },
    featureRow:      { flexDirection: 'row', alignItems: 'center', marginBottom: 8, gap: 6 },
    featureBarLeft:  { flex: 1, height: 6, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 3, overflow: 'hidden', flexDirection: 'row', justifyContent: 'flex-end' },
    featureBarRight: { flex: 1, height: 6, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 3, overflow: 'hidden', flexDirection: 'row', justifyContent: 'flex-start' },
    featureBarFill:  { height: 6, borderRadius: 3 },
    featureLabel:    { fontFamily: 'PoppinsRegular', fontSize: 10, color: colors.textMuted, textAlign: 'center', width: 90 },

    // Narrative
    narrativeHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
    narrativeText:   { fontFamily: 'PoppinsRegular', fontSize: 14, color: colors.textSecondary, lineHeight: 22 },
    narrativeFooter: { fontFamily: 'PoppinsRegular', fontSize: 10, color: colors.textMuted, marginTop: 10, textAlign: 'center' },

    // Compare button
    compareBtn:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderWidth: 1, borderRadius: 10, paddingVertical: 12, marginBottom: 8 },
    compareBtnText:  { fontFamily: 'PoppinsBold', fontSize: 14 },
});
