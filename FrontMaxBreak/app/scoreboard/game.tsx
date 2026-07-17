import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useKeepAwake } from 'expo-keep-awake';
import { View, Text, TouchableOpacity, StyleSheet, Alert, AppState, useWindowDimensions, ScrollView } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, router, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scoreboardColors } from '../../constants/scoreboardTheme';
import { useGameContext } from '../../contexts/GameContext';
import { useSnookerGame, BallType, getSnookersNeeded, GameState } from '../../hooks/useSnookerGame';
import { useGameAutosave } from '../../hooks/useGameAutosave';
import { saveMatch, saveDraft, loadDraft, clearDraft, GameDraft, StoredMatch } from '../../services/gameStorage';
import { uploadMatch } from '../../services/scoreboardSyncService';
import { isLoggedIn } from '../../services/authService';
import ScorePanel from '../components/scoreboard/ScorePanel';
import FormRow from '../components/scoreboard/FormRow';
import BallPad from '../components/scoreboard/BallPad';
import FoulModal from '../components/scoreboard/FoulModal';
import FrameSummary from '../components/scoreboard/FrameSummary';
import RespotBreakerModal from '../components/scoreboard/RespotBreakerModal';
import FrameRaceTracker from '../components/scoreboard/FrameRaceTracker';
import BreakChain from '../components/scoreboard/BreakChain';
import CenturyCelebration from '../components/scoreboard/CenturyCelebration';
import { shouldTriggerCentury } from '../../services/centuryTrigger';
import { detectGameSituations, pickInsight, SituationKey } from '../../services/insightTemplates';
import { computeWinProbability } from '../../services/winProbability';
import { computeMomentumSeries } from '../../services/momentum';
import BannerAdSlot from '../../components/ads/BannerAdSlot';

function GameScreen({ initialState }: { initialState?: GameState }) {
  const c = scoreboardColors;
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;
  const params = useLocalSearchParams<{
    id: string; player1: string; player2: string; numberOfReds: string; bestOf: string; mode: string;
  }>();

  const isTrainMode = params.bestOf === 'train';
  const isUnlimitedMode = params.bestOf === 'unlimited';

  const config = {
    id: params.id,
    player1Name: params.player1,
    player2Name: params.player2,
    numberOfReds: parseInt(params.numberOfReds, 10),
    // bestOf=9999 prevents auto match-end in training/unlimited (target=5000 — never reachable)
    bestOf: isTrainMode || isUnlimitedMode ? 9999 : (params.bestOf === 'single' ? null : parseInt(params.bestOf, 10)),
  };

  useKeepAwake();
  const { state, potBall, addExtraRed, endVisit, applyFoul, undo, concede, confirmFrameEnd, declareFreesBall, applyFreeBall, chooseRespotBreaker } = useSnookerGame(config, initialState);
  const { current: snap, framesWon, frameNumber, frameHighestBreak, isMatchOver, matchWinner } = state;

  const { setGameActive } = useGameContext();
  const stateRef = useRef(state);
  const matchSaved = useRef(false);

  useEffect(() => { stateRef.current = state; }, [state]);

  // Shared helper: writes draft to AsyncStorage if the game has progress and hasn't
  // been intentionally saved. Called on navigation-away blur AND on app backgrounding,
  // so force-close / battery-death / child pressing the home button are all covered.
  const saveDraftIfNeeded = useCallback(() => {
    if (matchSaved.current) return;
    const s = stateRef.current;
    const hasProgress =
      s.frameResults.length > 0 ||
      s.current.scores[0] > 0 ||
      s.current.scores[1] > 0 ||
      s.current.currentBreak > 0;
    if (hasProgress) {
      const draft: GameDraft = {
        params: {
          id: params.id,
          player1: params.player1,
          player2: params.player2,
          numberOfReds: params.numberOfReds,
          bestOf: params.bestOf,
        },
        state: s,
        savedAt: new Date().toISOString(),
      };
      saveDraft(draft).catch(() => {});
    }
  }, []);

  // Save draft after every state change — covers force-kill from recents where AppState
  // background may not fire before the process is killed.
  useGameAutosave(state, saveDraftIfNeeded);

  // Save draft when the OS moves the app to background (covers force-close, battery death,
  // home button press). The blur handler below covers intentional in-app navigation.
  useEffect(() => {
    const sub = AppState.addEventListener('change', nextState => {
      if (nextState === 'background') saveDraftIfNeeded();
    });
    return () => sub.remove();
  }, []);

  useFocusEffect(
    useCallback(() => {
      clearDraft().catch(() => {});
      setGameActive(true);
      return () => {
        setGameActive(false);
        saveDraftIfNeeded();
      };
    }, []),
  );

  const [showFoul, setShowFoul] = useState(false);
  const [showFrameSummary, setShowFrameSummary] = useState(false);
  const [pendingWinner, setPendingWinner] = useState<0 | 1>(0);
  const [lastCelebratedFrame, setLastCelebratedFrame] = useState<number | null>(null);

  const playerNames: [string, string] = [config.player1Name, config.player2Name];

  // Best break so far across completed breaks this session
  const sessionBest = state.frameResults.reduce(
    (best, fr) => Math.max(best, fr.highestBreak[0]), 0,
  );

  useEffect(() => {
    if (snap.isFrameOver && !showFrameSummary) {
      const winner: 0 | 1 = isTrainMode
        ? 0
        : (snap.respotForfeitWinner ?? (snap.scores[0] >= snap.scores[1] ? 0 : 1));
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
      mode: isTrainMode ? 'train' : isUnlimitedMode ? 'unlimited' : 'match',
    };
    if (complete) stored.completedAt = new Date().toISOString();
    await saveMatch(stored);
    if (complete) {
      isLoggedIn().then(logged => {
        if (logged) uploadMatch(stored).catch(() => {});
      });
    }
  }

  function handleNextFrame() {
    confirmFrameEnd(pendingWinner, isTrainMode ? 0 : undefined);
    setShowFrameSummary(false);
  }

  async function handleEndMatch() {
    matchSaved.current = true;
    setShowFrameSummary(false);
    await persistMatch(true);
    router.replace('/scoreboard/history' as any);
  }

  async function handleMatchOver() {
    matchSaved.current = true;
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
            matchSaved.current = true;
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

  async function handleUnlimitedEndMatch() {
    const framesCompleted = state.frameResults.length;
    Alert.alert(
      'End Match?',
      framesCompleted > 0
        ? `${framesCompleted} frame${framesCompleted !== 1 ? 's' : ''} completed. Current frame in progress will be discarded. Save and exit?`
        : 'No frames completed yet. Match will not be saved.',
      [
        { text: 'Keep playing', style: 'cancel' },
        {
          text: 'End Match',
          style: 'default',
          onPress: async () => {
            matchSaved.current = true;
            if (framesCompleted > 0) {
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
                mode: 'unlimited',
              };
              await saveMatch(stored);
            }
            router.replace('/scoreboard/history' as any);
          },
        },
      ],
    );
  }

  async function handleAbandonMatch() {
    const framesCompleted = state.frameResults.length;
    Alert.alert(
      'End Match?',
      framesCompleted > 0
        ? `${framesCompleted} frame${framesCompleted !== 1 ? 's' : ''} completed. Save results and exit?`
        : 'No frames completed yet. Exit without saving?',
      [
        { text: 'Keep playing', style: 'cancel' },
        {
          text: framesCompleted > 0 ? 'Save & Exit' : 'Exit',
          style: 'default',
          onPress: async () => {
            matchSaved.current = true;
            if (framesCompleted > 0) {
              const stored: StoredMatch = {
                id: config.id,
                player1Name: config.player1Name,
                player2Name: config.player2Name,
                numberOfReds: config.numberOfReds,
                bestOf: config.bestOf,
                startedAt: new Date().toISOString(),
                completedAt: new Date().toISOString(),
                isComplete: false,
                frameResults: state.frameResults,
                framesWon: framesWon,
                mode: 'match',
              };
              await saveMatch(stored);
            }
            router.replace('/scoreboard/history' as any);
          },
        },
      ],
    );
  }

  function handleFoulConfirm(value: number, opponentPlays: boolean, redsAccidentallyPotted: number) {
    setShowFoul(false);
    applyFoul(value, opponentPlays, redsAccidentallyPotted);
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
    : `${playerNames[scoreDiff > 0 ? 0 : 1]} ahead · ${playerNames[scoreDiff > 0 ? 1 : 0]} ${Math.abs(scoreDiff)} behind`;

  // Local, free, no-AI ticker text (see services/insightTemplates.ts). Whitewash/tight-frame/
  // decidingFrame situations don't mean anything in train mode (there's no real opponent —
  // scores[1] stays 0), so they're filtered out there; century/highestBreakSoFar still apply.
  const TRAIN_IRRELEVANT_SITUATIONS: SituationKey[] = ['decidingFrame', 'whitewash', 'tightFrame'];
  const situations = detectGameSituations(state, sessionBest, playerNames)
    .filter(s => !isTrainMode || !TRAIN_IRRELEVANT_SITUATIONS.includes(s.key));
  const insightSeed = snap.scores[0] * 31 + snap.scores[1] * 17 + frameNumber;
  const insightText = pickInsight(situations, insightSeed);

  // Win probability isn't meaningful in train mode (no second player).
  const winProbability = !isTrainMode ? computeWinProbability(snap.scores, snap.pointsOnTable, snap.isFrameOver) : null;

  // Momentum graph — same "no second player in train mode" reasoning as win probability.
  const momentumSeries = !isTrainMode ? computeMomentumSeries(snap, state.history) : [];

  // Century celebration — fires once per frame the break crosses 100 (see services/centuryTrigger.ts).
  const centuryTrigger = shouldTriggerCentury(snap.currentBreak, lastCelebratedFrame, frameNumber);
  useEffect(() => {
    if (centuryTrigger) setLastCelebratedFrame(frameNumber);
  }, [centuryTrigger, frameNumber]);

  return (
    <LinearGradient
      colors={[c.background, c.backgroundVignetteEnd]}
      style={[styles.root, { paddingTop: insets.top }]}>
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
                Frame {frameNumber} · {isUnlimitedMode ? 'Unlimited' : config.bestOf === null ? 'Single Frame' : `Best of ${config.bestOf}`}
              </Text>
              <Text style={[styles.frameScore, { color: c.textSecondary }]}>
                {framesWon[0]} – {framesWon[1]}
              </Text>
            </>
          )}
        </View>

        <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
          {!isTrainMode && (
            <TouchableOpacity
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              onPress={isUnlimitedMode ? handleUnlimitedEndMatch : handleAbandonMatch}
            >
              <Text style={{ color: c.textMuted, fontSize: 13, fontFamily: 'PoppinsBold' }}>End ⏹</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity onPress={() => router.push('/scoreboard/rules' as any)}>
            <Text style={{ color: c.textMuted, fontSize: 18 }}>📖</Text>
          </TouchableOpacity>
        </View>
      </View>

      {(() => {
        const topInfoBlock = (
          <>
            {insightText && (
              <View style={[styles.insightChip, { backgroundColor: 'rgba(199,164,92,0.07)', borderColor: 'rgba(199,164,92,0.22)' }]}>
                <Text style={[styles.insightChipText, { color: c.textHeader }]}>💡 {insightText}</Text>
              </View>
            )}
            {!isTrainMode && (
              <View style={styles.raceTrackerWrap}>
                <FrameRaceTracker framesWon={framesWon} bestOf={config.bestOf} />
              </View>
            )}
            <BannerAdSlot />
          </>
        );

        const scorePanelBlock = (
          <ScorePanel
            playerNames={playerNames}
            scores={snap.scores}
            framesWon={framesWon}
            currentBreak={snap.currentBreak}
            highestBreak={frameHighestBreak}
            currentPlayer={snap.currentPlayer}
            pointsOnTable={snap.pointsOnTable}
            isTrainMode={isTrainMode}
            onEndVisit={(forPlayer) => endVisit()}
            leadText={!isTrainMode ? leadText : undefined}
          />
        );

        const breakChainBlock = !snap.isFrameOver && (
          <View style={styles.breakChainWrap}>
            <BreakChain breakBalls={snap.breakBalls} currentBreak={snap.currentBreak} />
          </View>
        );

        const formRowBlock = !snap.isFrameOver && (
          <FormRow winProbability={winProbability} momentumSeries={momentumSeries} />
        );

        const snookerBlock = !isTrainMode && !snap.isFrameOver && (() => {
          const [sn0, sn1] = getSnookersNeeded(snap.scores, snap.pointsOnTable);
          const trailerIdx = sn0 >= 2 ? 0 : sn1 >= 2 ? 1 : null;
          if (trailerIdx === null) return null;
          const snookersCount = [sn0, sn1][trailerIdx];
          const leaderIdx: 0 | 1 = trailerIdx === 0 ? 1 : 0;
          return (
            <TouchableOpacity
              style={[styles.snookerRibbon, { backgroundColor: 'rgba(199,164,92,0.06)', borderColor: 'rgba(199,164,92,0.4)' }]}
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
        })();

        const ballPadBlock = (
          <BallPad
            phase={snap.phase}
            awaiting={snap.awaiting}
            colorsRemaining={snap.colorsRemaining}
            redsRemaining={snap.redsRemaining}
            currentBreak={snap.currentBreak}
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
        );

        if (isLandscape) {
          return (
            <View style={styles.landscapeRow}>
              <ScrollView
                style={[styles.landscapeColumn, { paddingLeft: insets.left }]}
                contentContainerStyle={{ paddingBottom: 12 }}
              >
                {topInfoBlock}
                {scorePanelBlock}
                {breakChainBlock}
                {formRowBlock}
                {snookerBlock}
              </ScrollView>
              <View style={[styles.landscapeColumn, styles.landscapeRightColumn, { paddingRight: insets.right }]}>
                {ballPadBlock}
                <View style={{ height: insets.bottom }} />
              </View>
            </View>
          );
        }

        return (
          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ flexGrow: 1 }}>
            {topInfoBlock}
            {scorePanelBlock}
            {breakChainBlock}
            {formRowBlock}
            {snookerBlock}
            <View style={{ flex: 1 }} />
            {ballPadBlock}
            <View style={{ height: insets.bottom }} />
          </ScrollView>
        );
      })()}

      <CenturyCelebration
        trigger={centuryTrigger}
        player={playerNames[snap.currentPlayer]}
        breakValue={snap.currentBreak}
      />

      {/* Modals */}
      <RespotBreakerModal
        visible={!isTrainMode && snap.awaitingRespotChoice}
        playerNames={playerNames}
        onChoose={chooseRespotBreaker}
      />

      <FoulModal
        visible={showFoul}
        foulingPlayer={playerNames[snap.currentPlayer]}
        opponentName={isTrainMode ? playerNames[0] : playerNames[snap.currentPlayer === 0 ? 1 : 0]}
        phase={snap.phase}
        redsRemaining={snap.redsRemaining}
        onConfirm={handleFoulConfirm}
        onCancel={() => setShowFoul(false)}
      />

      {showFrameSummary && (() => {
        const displayFW: [number, number] = [framesWon[0], framesWon[1]];
        displayFW[pendingWinner]++;
        const bestOfTarget = config.bestOf ? Math.ceil(config.bestOf / 2) : 1;
        const isOver = !isTrainMode && !isUnlimitedMode && (config.bestOf === null || displayFW[0] >= bestOfTarget || displayFW[1] >= bestOfTarget);
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
    </LinearGradient>
  );
}

export default function GameScreenWrapper() {
  const params = useLocalSearchParams<{
    id: string; player1: string; player2: string; numberOfReds: string; bestOf: string; mode: string;
  }>();
  const c = scoreboardColors;
  const [ready, setReady] = useState(false);
  const [draftState, setDraftState] = useState<GameState | undefined>(undefined);

  useEffect(() => {
    loadDraft().then(draft => {
      if (draft && draft.params.id === params.id) {
        setDraftState(draft.state);
      }
      setReady(true);
    }).catch(() => setReady(true));
  }, []);

  if (!ready) return <View style={{ flex: 1, backgroundColor: c.background }} />;
  return <GameScreen initialState={draftState} />;
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
  insightChip: {
    marginHorizontal: 16,
    marginTop: 8,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  insightChipText: { fontSize: 11, fontFamily: 'PoppinsBold' },
  raceTrackerWrap: {
    marginHorizontal: 16,
    marginTop: 8,
  },
  breakChainWrap: {
    marginHorizontal: 16,
    marginTop: 10,
  },
  snookerRibbon: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: 16,
    marginTop: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 4,
    borderWidth: 1,
    borderLeftWidth: 3,
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
  landscapeRow: {
    flex: 1,
    flexDirection: 'row',
  },
  landscapeColumn: {
    flex: 1,
  },
  landscapeRightColumn: {
    justifyContent: 'flex-end',
  },
});
