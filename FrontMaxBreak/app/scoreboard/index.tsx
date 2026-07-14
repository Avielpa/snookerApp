import React, { useState, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, Alert,
} from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../contexts/ThemeContext';
import { useAuth } from '../../contexts/AuthContext';
import { generateMatchId, loadDraft, clearDraft, GameDraft } from '../../services/gameStorage';
import AuthCard from '../components/AuthCard';
import BannerAdSlot from '../../components/ads/BannerAdSlot';

const RED_OPTIONS = [6, 10, 15] as const;
const BEST_OF_OPTIONS: (number | null)[] = [null, 3, 5, 7, 9, 11];

export default function ScoreboardSetup() {
  const { theme } = useTheme();
  const c = theme.colors;
  const insets = useSafeAreaInsets();
  const prefill = useLocalSearchParams<{ prefillPlayer1?: string; prefillPlayer2?: string }>();
  const { loggedIn } = useAuth();

  const [mode, setMode] = useState<'match' | 'train'>('match');
  const [player1, setPlayer1] = useState(prefill.prefillPlayer1?.trim() || 'Player 1');
  const [player2, setPlayer2] = useState(prefill.prefillPlayer2?.trim() || 'Player 2');
  const [numberOfReds, setNumberOfReds] = useState<number>(15);
  const [bestOf, setBestOf] = useState<number | null>(null);
  const [isUnlimited, setIsUnlimited] = useState(false);
  const [draft, setDraft] = useState<GameDraft | null>(null);
  const [authVisible, setAuthVisible] = useState(false);
  const [bannerDismissed, setBannerDismissed] = useState(false);

  const isTrainMode = mode === 'train';

  useFocusEffect(
    useCallback(() => {
      loadDraft().then(d => setDraft(d)).catch(() => setDraft(null));
    }, []),
  );

  function startMatch() {
    if (!player1.trim()) {
      Alert.alert('Missing name', 'Please enter your name.');
      return;
    }
    if (!isTrainMode && !player2.trim()) {
      Alert.alert('Missing name', 'Please enter both player names.');
      return;
    }
    clearDraft().catch(() => {});
    setDraft(null);
    const id = generateMatchId();
    router.push({
      pathname: '/scoreboard/game' as any,
      params: {
        id,
        player1: player1.trim(),
        player2: isTrainMode ? '' : player2.trim(),
        numberOfReds: String(numberOfReds),
        bestOf: isTrainMode ? 'train' : isUnlimited ? 'unlimited' : (bestOf === null ? 'single' : String(bestOf)),
        mode,
      },
    });
  }

  const startingPoints = numberOfReds * 8 + 27;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: c.background }}
      contentContainerStyle={[styles.container, { paddingBottom: insets.bottom + 24 }]}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={[styles.title, { color: c.textHeader }]}>Play Mode</Text>
      <Text style={[styles.subtitle, { color: c.textSecondary }]}>Set up your session</Text>

      {/* Sign-in nudge — dismissible, shown when logged out */}
      {!loggedIn && !bannerDismissed && (
        <View style={[styles.signInBanner, { backgroundColor: c.cardBackground, borderColor: c.primary }]}>
          <Text style={[styles.signInBannerText, { color: c.textPrimary }]}>
            Sign in to save your matches and track rivalries with friends
          </Text>
          <TouchableOpacity
            onPress={() => setAuthVisible(true)}
            style={[styles.signInBannerBtn, { backgroundColor: c.primary }]}
          >
            <Text style={styles.signInBannerBtnText}>Sign In</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setBannerDismissed(true)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={{ paddingLeft: 6 }}
          >
            <Text style={{ color: c.textMuted, fontSize: 16 }}>✕</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Resume card — shown when a saved draft exists */}
      {draft && (
        <View style={[styles.resumeCard, { backgroundColor: c.cardBackground, borderColor: c.primary }]}>
          <TouchableOpacity
            style={styles.resumeMain}
            onPress={() => router.push({ pathname: '/scoreboard/game' as any, params: draft.params })}
            activeOpacity={0.8}
          >
            <Text style={[styles.resumeLabel, { color: c.primary }]}>
              {draft.params.bestOf === 'train' ? '🎯 Resume Training' : '⚔️ Resume Match'}
            </Text>
            <Text style={[styles.resumeNames, { color: c.textPrimary }]}>
              {draft.params.bestOf === 'train'
                ? draft.params.player1
                : `${draft.params.player1} vs ${draft.params.player2}`}
            </Text>
            <Text style={[styles.resumeMeta, { color: c.textMuted }]}>
              {draft.params.bestOf === 'train'
                ? `Break ${draft.state.frameNumber} · ${draft.params.numberOfReds} reds`
                : `Frame ${draft.state.frameNumber} · ${draft.state.framesWon[0]}–${draft.state.framesWon[1]} frames`}
              {'  ·  Tap to resume →'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.resumeDismiss}
            onPress={() => { clearDraft().catch(() => {}); setDraft(null); }}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={[styles.resumeDismissText, { color: c.textMuted }]}>✕</Text>
          </TouchableOpacity>
        </View>
      )}

      <BannerAdSlot />

      {/* Mode toggle */}
      <View style={[styles.modeToggle, { backgroundColor: c.backgroundSecondary, borderColor: c.cardBorder }]}>
        {(['match', 'train'] as const).map(m => (
          <TouchableOpacity
            key={m}
            style={[styles.modeBtn, mode === m && { backgroundColor: c.primary }]}
            onPress={() => setMode(m)}
          >
            <Text style={[styles.modeBtnText, { color: mode === m ? '#121212' : c.textSecondary }]}>
              {m === 'match' ? '⚔️  Match' : '🎯  Train'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Player names */}
      <View style={[styles.card, { backgroundColor: c.cardBackground, borderColor: c.cardBorder }]}>
        <Text style={[styles.label, { color: c.textMuted }]}>{isTrainMode ? 'YOUR NAME' : 'PLAYER 1'}</Text>
        <TextInput
          style={[styles.input, { color: c.textPrimary, borderColor: c.cardBorder }]}
          value={player1}
          onChangeText={setPlayer1}
          placeholder="Enter name"
          placeholderTextColor={c.textMuted}
          maxLength={20}
          selectTextOnFocus
        />

        {!isTrainMode && (
          <>
            <Text style={[styles.label, { color: c.textMuted, marginTop: 12 }]}>PLAYER 2</Text>
            <TextInput
              style={[styles.input, { color: c.textPrimary, borderColor: c.cardBorder }]}
              value={player2}
              onChangeText={setPlayer2}
              placeholder="Enter name"
              placeholderTextColor={c.textMuted}
              maxLength={20}
              selectTextOnFocus
            />
          </>
        )}
      </View>

      {/* Number of reds */}
      <View style={[styles.card, { backgroundColor: c.cardBackground, borderColor: c.cardBorder }]}>
        <Text style={[styles.label, { color: c.textMuted }]}>NUMBER OF REDS</Text>
        <View style={styles.optionRow}>
          {RED_OPTIONS.map(n => (
            <TouchableOpacity
              key={n}
              style={[
                styles.optionBtn,
                { borderColor: numberOfReds === n ? c.primary : c.cardBorder },
                numberOfReds === n && { backgroundColor: 'rgba(255,183,77,0.12)' },
              ]}
              onPress={() => setNumberOfReds(n)}
            >
              <Text style={[
                styles.optionBtnText,
                { color: numberOfReds === n ? c.primary : c.textSecondary },
              ]}>
                {n}
              </Text>
            </TouchableOpacity>
          ))}
          {/* Custom reds */}
          {![6, 10, 15].includes(numberOfReds) && (
            <View style={[styles.optionBtn, { borderColor: c.primary, backgroundColor: 'rgba(255,183,77,0.12)' }]}>
              <Text style={[styles.optionBtnText, { color: c.primary }]}>{numberOfReds}</Text>
            </View>
          )}
        </View>
        <View style={styles.redSliderRow}>
          {Array.from({ length: 15 }, (_, i) => i + 1).map(n => (
            <TouchableOpacity
              key={n}
              onPress={() => setNumberOfReds(n)}
              style={[
                styles.redDot,
                {
                  backgroundColor: n <= numberOfReds ? '#CC0000' : c.backgroundTertiary,
                  borderColor: n === numberOfReds ? c.primary : 'transparent',
                },
              ]}
            />
          ))}
        </View>
        <Text style={[styles.meta, { color: c.textMuted }]}>
          Starting points on table: {startingPoints}  ·  Max break: {startingPoints}
        </Text>
      </View>

      {/* Match format */}
      <View style={[styles.card, { backgroundColor: c.cardBackground, borderColor: c.cardBorder }]}>
        <Text style={[styles.label, { color: c.textMuted }]}>MATCH FORMAT</Text>
        <View style={styles.optionRow}>
          {BEST_OF_OPTIONS.map(bo => (
            <TouchableOpacity
              key={String(bo)}
              style={[
                styles.optionBtn,
                { borderColor: !isUnlimited && bestOf === bo ? c.primary : c.cardBorder },
                !isUnlimited && bestOf === bo && { backgroundColor: 'rgba(255,183,77,0.12)' },
              ]}
              onPress={() => { setBestOf(bo); setIsUnlimited(false); }}
            >
              <Text style={[
                styles.optionBtnText,
                { color: !isUnlimited && bestOf === bo ? c.primary : c.textSecondary },
                { fontSize: bo === null ? 11 : 14 },
              ]}>
                {bo === null ? '1 frame' : `BO${bo}`}
              </Text>
            </TouchableOpacity>
          ))}
          <TouchableOpacity
            style={[
              styles.optionBtn,
              { borderColor: isUnlimited ? c.primary : c.cardBorder },
              isUnlimited && { backgroundColor: 'rgba(255,183,77,0.12)' },
            ]}
            onPress={() => setIsUnlimited(true)}
          >
            <Text style={[styles.optionBtnText, { color: isUnlimited ? c.primary : c.textSecondary, fontSize: 16 }]}>
              ∞
            </Text>
          </TouchableOpacity>
        </View>
        {isUnlimited ? (
          <Text style={[styles.meta, { color: c.textMuted }]}>
            Play as many frames as you like
          </Text>
        ) : bestOf !== null ? (
          <Text style={[styles.meta, { color: c.textMuted }]}>
            First to {Math.ceil(bestOf / 2)} frame{Math.ceil(bestOf / 2) > 1 ? 's' : ''} wins
          </Text>
        ) : null}
      </View>

      {/* Start button */}
      <TouchableOpacity
        style={[styles.startBtn, { backgroundColor: c.primary }]}
        onPress={startMatch}
        activeOpacity={0.85}
      >
        <Text style={styles.startBtnText}>Start Match</Text>
      </TouchableOpacity>

      {/* Match History — prominent secondary button */}
      <TouchableOpacity
        style={[styles.historyBtn, { borderColor: c.primary }]}
        onPress={() => router.push('/scoreboard/history' as any)}
        activeOpacity={0.8}
      >
        <Text style={[styles.historyBtnText, { color: c.primary }]}>📊  Match History & Rivalries</Text>
      </TouchableOpacity>

      {/* Rules link */}
      <TouchableOpacity style={styles.linksRow} onPress={() => router.push('/scoreboard/rules' as any)}>
        <Text style={[styles.link, { color: c.textMuted }]}>📖 Rules Reference</Text>
      </TouchableOpacity>

      <AuthCard visible={authVisible} onClose={() => setAuthVisible(false)} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    gap: 12,
  },
  title: {
    fontSize: 28,
    fontFamily: 'PoppinsBold',
    marginTop: 8,
  },
  subtitle: {
    fontSize: 14,
    marginBottom: 4,
  },
  card: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 16,
  },
  label: {
    fontSize: 11,
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    fontFamily: 'PoppinsBold',
  },
  optionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 10,
  },
  optionBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    minWidth: 52,
    alignItems: 'center',
  },
  optionBtnText: {
    fontFamily: 'PoppinsBold',
    fontSize: 14,
  },
  redSliderRow: {
    flexDirection: 'row',
    gap: 4,
    flexWrap: 'wrap',
    marginBottom: 8,
  },
  redDot: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1.5,
  },
  meta: {
    fontSize: 11,
    marginTop: 4,
  },
  startBtn: {
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
    marginTop: 4,
  },
  startBtnText: {
    fontSize: 18,
    fontFamily: 'PoppinsBold',
    color: '#121212',
  },
  historyBtn: {
    borderWidth: 1.5,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  historyBtnText: {
    fontSize: 15,
    fontFamily: 'PoppinsBold',
  },
  signInBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    paddingVertical: 10,
    paddingHorizontal: 14,
    gap: 8,
  },
  signInBannerText: {
    flex: 1,
    fontSize: 13,
  },
  signInBannerBtn: {
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  signInBannerBtnText: {
    fontSize: 12,
    fontFamily: 'PoppinsBold',
    color: '#121212',
  },
  linksRow: {
    alignItems: 'center',
    marginTop: 4,
  },
  link: {
    fontSize: 13,
  },
  modeToggle: {
    flexDirection: 'row',
    borderRadius: 12,
    borderWidth: 1,
    padding: 4,
    gap: 4,
  },
  modeBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  modeBtnText: {
    fontSize: 14,
    fontFamily: 'PoppinsBold',
  },
  resumeCard: {
    borderRadius: 14,
    borderWidth: 1.5,
    flexDirection: 'row',
    alignItems: 'center',
    overflow: 'hidden',
  },
  resumeMain: {
    flex: 1,
    padding: 14,
    gap: 2,
  },
  resumeLabel: {
    fontSize: 11,
    fontFamily: 'PoppinsBold',
    letterSpacing: 0.5,
  },
  resumeNames: {
    fontSize: 15,
    fontFamily: 'PoppinsBold',
  },
  resumeMeta: {
    fontSize: 11,
    marginTop: 2,
  },
  resumeDismiss: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    alignSelf: 'stretch',
    justifyContent: 'center',
    alignItems: 'center',
  },
  resumeDismissText: {
    fontSize: 16,
  },
});
