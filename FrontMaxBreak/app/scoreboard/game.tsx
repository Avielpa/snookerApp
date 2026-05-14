import React, { useState, useEffect } from 'react';
import { useKeepAwake } from 'expo-keep-awake';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../contexts/ThemeContext';
import { useSnookerGame, BallType, getSnookersNeeded } from '../../hooks/useSnookerGame';
import { saveMatch, StoredMatch } from '../../services/gameStorage';
import PlayerCard from '../components/scoreboard/PlayerCard';
import BallPad from '../components/scoreboard/BallPad';
import FoulModal from '../components/scoreboard/FoulModal';
import FrameSummary from '../components/scoreboard/FrameSummary';

export default function GameScreen() {
  const { theme } = useTheme();
  const c = theme.colors;
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{
    id: string; player1: string; player2: string; numberOfReds: string; bestOf: string; mode: string;
  }>();

  const isTrainMode = params.bestOf === 'train';

  const config = {
    id: params.id,
    player1Name: params.player1,
    player2Name: params.player2,
    numberOfReds: parseInt(params.numberOfReds, 10),
    // bestOf=9999 prevents auto match-end in training (target=5000 — never reachable)
    bestOf: isTrainMode ? 9999 : (params.bestOf === 'single' ? null : parseInt(params.bestOf, 10)),
  };

  useKeepAwake();
  const { state, potBall, addExtraRed, endVisit, applyFoul, undo, concede, confirmFrameEnd, declareFreesBall, applyFreeBall } = useSnookerGame(config);
  const { current: snap, framesWon, frameNumber, frameHighestBreak, isMatchOver, matchWinner } = state;

  const [showFoul, setShowFoul] = useState(false);
  const [showFrameSummary, setShowFrameSummary] = useState(false);
  const [pendingWinner, setPendingWinner] = useState<0 | 1>(0);

  const playerNames: [string, string] = [config.player1Name, config.player2Name];

  // Best break so far across completed breaks this session
  const sessionBest = state.frameResults.reduce(
    (best, fr) => Math.max(best, fr.highestBreak[0]), 0,
  );

  useEffect(() => {
    if (snap.isFrameOver && !showFrameSummary) {
      const winner: 0 | 1 = isTrainMode ? 0 : (snap.scores[0] >= snap.scores[1] ? 0 : 1);
      setPendingWinner(winner);
      setShowFrameSummary(true);
    }
  }, [snap.isFrameOver]);

  function buildFinalState(): { fw: [number, number]; results: typeof state.frameResults } {
    const fw: [number, number] = [framesWon[0], framesWon[1]];
    fw[pendingWinner]++;
    const currentResult = {
      frameNumber,
      winner: pendingWinner,
      scores: [...snap.scores] as [number, number],
      highestBreak: [...frameHighestBreak] as [number, number],
    };
    return { fw, results: [...state.frameResults, currentResult] };
  }

  async function persistMatch(complete: boolean) {
    const { fw, results } = buildFinalState();
    const stored: StoredMatch = {
      id: config.id,
      player1Name: config.player1Name,
      player2Name: config.player2Name,
      numberOfReds: config.numberOfReds,
      bestOf: isTrainMode ? null : config.bestOf,
      startedAt: new Date().toISOString(),
      isComplete: complete,
      frameResults: results,
      framesWon: fw,
      mode: isTrainMode ? 'train' : 'match',
    };
    if (complete) stored.completedAt = new Date().toISOString();
    await saveMatch(stored);
  }

  function handleNextFrame() {
    confirmFrameEnd(pendingWinner, isTrainMode ? 0 : undefined);
    setShowFrameSummary(false);
  }

  async function handleEndMatch() {
    setShowFrameSummary(false);
    await persistMatch(true);
    router.replace('/scoreboard/history' as any);
  }

  async function handleMatchOver() {
    setShowFrameSummary(false);
    await persistMatch(true);
    router.replace('/scoreboard/history' as any);
  }

  // Called from BallPad "End Session" button (mid-break): saves only completed breaks
  async function handleTrainEndSession() {
    const breaksDone = state.frameResults.length;
    Alert.alert(
      'End Session?',
      breaksDone > 0
        ? `${breaksDone} break${breaksDone !== 1 ? 's' : ''} will be saved. Current break progress will be lost.`
        : 'No breaks completed yet. Session will not be saved.',
      [
        { text: 'Continue', style: 'cancel' },
        {
          text: 'End Session', style: 'default',
          onPress: async () => {
            if (breaksDone > 0) {
              const stored: StoredMatch = {
                id: config.id,
                player1Name: config.player1Name,
                player2Name: config.player2Name,
                numberOfReds: config.numberOfReds,
                bestOf: null,
                startedAt: new Date().toISOString(),
                completedAt: new Date().toISOString(),
                isComplete: true,
                frameResults: state.frameResults,
                framesWon: framesWon,
                mode: 'train',
              };
              await saveMatch(stored);
            }
            router.replace('/scoreboard/history' as any);
          },
        },
      ],
    );
  }

  function handleFoulConfirm(value: number, opponentPlays: boolean) {
    setShowFoul(false);
    applyFoul(value, opponentPlays);
    if (opponentPlays) {
      Alert.alert(
        'Free ball?',
        'Is the incoming player snookered?',
        [
          { text: 'No', style: 'cancel' },
          { text: 'Yes — free ball', style: 'default', onPress: declareFreesBall },
        ],
      );
    }
  }

  function handleConcede() {
    Alert.alert(
      'Concede Frame',
      `${playerNames[snap.currentPlayer]} concedes this frame?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Yes, concede', style: 'destructive', onPress: concede },
      ],
    );
  }

  const scoreDiff = snap.scores[0] - snap.scores[1];
  const leadText = scoreDiff === 0
    ? 'Level'
    : `${playerNames[scoreDiff > 0 ? 0 : 1]} leads by ${Math.abs(scoreDiff)}`;

  return (
    <View style={[styles.root, { backgroundColor: c.background, paddingTop: insets.top }]}>
      {/* Header bar */}
      <View style={[styles.topBar, { borderBottomColor: c.cardBorder }]}>
        <TouchableOpacity
          style={styles.backBtn}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          onPress={() => {
            Alert.alert(
              'Leave?',
              isTrainMode ? 'Session progress will be lost.' : 'Match progress will be lost if not saved.',
              [
                { text: 'Stay', style: 'cancel' },
                { text: 'Leave', style: 'destructive', onPress: () => router.back() },
              ],
            );
          }}>
          <Text style={{ color: c.textMuted, fontSize: 28, lineHeight: 32 }}>‹</Text>
        </TouchableOpacity>

        <View style={{ alignItems: 'center' }}>
          {isTrainMode ? (
            <>
              <Text style={[styles.frameLabel, { color: c.textMuted }]}>Training Session</Text>
              <Text style={[styles.frameScore, { color: c.textSecondary }]}>
                Break {frameNumber} · {config.numberOfReds} reds
              </Text>
            </>
          ) : (
            <>
              <Text style={[styles.frameLabel, { color: c.textMuted }]}>
                Frame {frameNumber} · {config.bestOf === null ? 'Single Frame' : `Best of ${config.bestOf}`}
              </Text>
              <Text style={[styles.frameScore, { color: c.textSecondary }]}>
                {framesWon[0]} – {framesWon[1]}
              </Text>
            </>
          )}
        </View>

        <TouchableOpacity onPress={() => router.push('/scoreboard/rules' as any)}>
          <Text style={{ color: c.textMuted, fontSize: 18 }}>📖</Text>
        </TouchableOpacity>
      </View>

      {/* Points on table */}
      <View style={[styles.pot, { backgroundColor: c.backgroundSecondary }]}>
        <Text style={[styles.potLabel, { color: c.textMuted }]}>Points on table</Text>
        <Text style={[styles.potValue, { color: c.primary }]}>{snap.pointsOnTable}</Text>
        {isTrainMode ? (
          snap.currentBreak > 0 && (
            <Text style={[styles.leadText, { color: c.textSecondary }]}>
              Current break: {snap.currentBreak}
            </Text>
          )
        ) : (
          <Text style={[styles.leadText, { color: c.textSecondary }]}>{leadText}</Text>
        )}
      </View>

      {/* Player card(s) */}
      {isTrainMode ? (
        <View style={[styles.cardsRow, { paddingHorizontal: 16 }]}>
          <PlayerCard
            name={playerNames[0]}
            score={snap.scores[0]}
            framesWon={framesWon[0]}
            currentBreak={snap.currentBreak}
            highestBreak={frameHighestBreak[0]}
            isActive
            isLeft
          />
        </View>
      ) : (
        <View style={styles.cardsRow}>
          <PlayerCard
            name={playerNames[0]}
            score={snap.scores[0]}
            framesWon={framesWon[0]}
            currentBreak={snap.currentPlayer === 0 ? snap.currentBreak : 0}
            highestBreak={frameHighestBreak[0]}
            isActive={snap.currentPlayer === 0}
            isLeft
          />
          <PlayerCard
            name={playerNames[1]}
            score={snap.scores[1]}
            framesWon={framesWon[1]}
            currentBreak={snap.currentPlayer === 1 ? snap.currentBreak : 0}
            highestBreak={frameHighestBreak[1]}
            isActive={snap.currentPlayer === 1}
            isLeft={false}
          />
        </View>
      )}

      {/* Snookers needed banner — match mode only */}
      {!isTrainMode && !snap.isFrameOver && (() => {
        const [sn0, sn1] = getSnookersNeeded(snap.scores, snap.pointsOnTable);
        const trailerIdx = sn0 >= 2 ? 0 : sn1 >= 2 ? 1 : null;
        if (trailerIdx === null) return null;
        const snookersCount = [sn0, sn1][trailerIdx];
        const leaderIdx: 0 | 1 = trailerIdx === 0 ? 1 : 0;
        return (
          <TouchableOpacity
            style={[styles.snookerBanner, { backgroundColor: 'rgba(255,183,77,0.12)', borderColor: c.primary }]}
            onPress={() => {
              Alert.alert(
                'End Frame',
                `${playerNames[trailerIdx]} needs ${snookersCount} snookers. Award the frame to ${playerNames[leaderIdx]}?`,
                [
                  { text: 'Keep playing', style: 'cancel' },
                  { text: `${playerNames[leaderIdx]} wins frame`, style: 'default', onPress: concede },
                ],
              );
            }}
            activeOpacity={0.8}
          >
            <Text style={[styles.snookerBannerText, { color: c.primary }]}>
              ⚡ {playerNames[trailerIdx]} needs {snookersCount} snookers
            </Text>
            <Text style={[styles.snookerBannerBtn, { color: c.primary }]}>End Frame →</Text>
          </TouchableOpacity>
        );
      })()}

      <View style={{ flex: 1 }} />

      {/* Ball pad */}
      <BallPad
        phase={snap.phase}
        awaiting={snap.awaiting}
        colorsRemaining={snap.colorsRemaining}
        redsRemaining={snap.redsRemaining}
        onPot={(ball: BallType) => potBall(ball)}
        onExtraRed={addExtraRed}
        onMiss={isTrainMode ? concede : endVisit}
        onFoul={() => setShowFoul(true)}
        onUndo={undo}
        onConcede={isTrainMode ? handleTrainEndSession : handleConcede}
        canUndo={state.history.length > 0}
        trainMode={isTrainMode}
        freeBallActive={snap.freeBallActive}
        onFreeBall={applyFreeBall}
      />
      <View style={{ height: insets.bottom }} />

      {/* Modals */}
      <FoulModal
        visible={showFoul}
        foulingPlayer={playerNames[snap.currentPlayer]}
        opponentName={isTrainMode ? playerNames[0] : playerNames[snap.currentPlayer === 0 ? 1 : 0]}
        onConfirm={handleFoulConfirm}
        onCancel={() => setShowFoul(false)}
      />

      {showFrameSummary && (() => {
        const displayFW: [number, number] = [framesWon[0], framesWon[1]];
        displayFW[pendingWinner]++;
        const bestOfTarget = config.bestOf ? Math.ceil(config.bestOf / 2) : 1;
        const isOver = !isTrainMode && (config.bestOf === null || displayFW[0] >= bestOfTarget || displayFW[1] >= bestOfTarget);
        const mWinner: 0 | 1 = displayFW[0] > displayFW[1] ? 0 : 1;
        return (
          <FrameSummary
            visible
            frameNumber={frameNumber}
            scores={snap.scores}
            highestBreak={frameHighestBreak}
            playerNames={playerNames}
            framesWon={displayFW}
            winner={pendingWinner}
            isMatchOver={isOver}
            matchWinner={isOver ? mWinner : null}
            bestOf={isTrainMode ? null : config.bestOf}
            onNextFrame={handleNextFrame}
            onEndMatch={isOver ? handleMatchOver : handleEndMatch}
            trainMode={isTrainMode}
            sessionBest={sessionBest}
          />
        );
      })()}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  backBtn: { padding: 6 },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  frameLabel: { fontSize: 11 },
  frameScore: { fontSize: 18, fontFamily: 'PoppinsBold' },
  pot: {
    alignItems: 'center',
    paddingVertical: 10,
    marginHorizontal: 16,
    marginTop: 10,
    borderRadius: 12,
  },
  potLabel: { fontSize: 11, letterSpacing: 0.5 },
  potValue: { fontSize: 36, fontFamily: 'PoppinsBold', lineHeight: 42 },
  leadText: { fontSize: 12 },
  cardsRow: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    marginTop: 10,
    gap: 0,
  },
  snookerBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: 12,
    marginTop: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  snookerBannerText: {
    fontSize: 13,
    fontFamily: 'PoppinsBold',
  },
  snookerBannerBtn: {
    fontSize: 13,
    fontFamily: 'PoppinsBold',
    opacity: 0.8,
  },
});
