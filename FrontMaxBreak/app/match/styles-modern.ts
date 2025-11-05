// app/match/styles-modern.ts
// DARK, MODERN, PRACTICAL, COMFORTABLE - SAME CLASS NAMES, ZERO LOGIC CHANGES
import { StyleSheet } from 'react-native';

export const createMatchStyles = (colors: any) => StyleSheet.create({
  // CONTAINER
  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },

  // LOADING & ERROR STATES - Dark and comfortable
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 8,
    fontSize: 12,
    fontFamily: 'PoppinsRegular',
    color: 'rgba(255, 255, 255, 0.6)',
  },
  retryButton: {
    marginTop: 14,
    paddingHorizontal: 18,
    paddingVertical: 9,
    backgroundColor: '#FF8F00',
    borderRadius: 8,
  },
  retryText: {
    fontSize: 12,
    fontFamily: 'PoppinsSemiBold',
    color: '#1a1a1a',
  },
  shareButton: {
    padding: 6,
  },

  // PLAYER SCORE HEADER - DARK, COMPACT, CLEAR
  scoreHeader: {
    margin: 10,
    padding: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 143, 0, 0.3)',
  },
  scoreContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  playerContainer: {
    flex: 1,
    alignItems: 'center',
  },
  playerName: {
    fontSize: 12,
    fontFamily: 'PoppinsSemiBold',
    color: 'rgba(255, 255, 255, 0.85)',
    textAlign: 'center',
    marginBottom: 6,
  },
  player1: {
    textAlign: 'left',
  },
  player2: {
    textAlign: 'right',
  },
  playerScore: {
    fontSize: 24,
    fontFamily: 'PoppinsBold',
    color: 'rgba(255, 255, 255, 0.9)',
  },
  winnerScore: {
    color: '#FF8F00',
  },
  vsContainer: {
    alignItems: 'center',
    paddingHorizontal: 12,
  },
  vsText: {
    fontSize: 9,
    fontFamily: 'PoppinsMedium',
    color: 'rgba(255, 255, 255, 0.4)',
    marginTop: 4,
  },

  // TABS - DARK, COMPACT, MODERN
  tabContainer: {
    flexDirection: 'row',
    paddingHorizontal: 10,
    marginBottom: 10,
  },
  tabButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 7,
    marginHorizontal: 2,
    borderRadius: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    borderWidth: 1,
    borderColor: 'rgba(255, 143, 0, 0.2)',
  },
  tabButtonActive: {
    backgroundColor: 'rgba(255, 143, 0, 0.25)',
    borderColor: 'rgba(255, 143, 0, 0.5)',
  },
  tabText: {
    fontSize: 10,
    fontFamily: 'PoppinsMedium',
    color: 'rgba(255, 255, 255, 0.5)',
    marginLeft: 3,
  },
  tabTextActive: {
    color: '#FF8F00',
    fontFamily: 'PoppinsSemiBold',
  },

  // CONTENT CONTAINER
  contentContainer: {
    flex: 1,
    paddingHorizontal: 10,
  },

  // STATUS CARD - DARK, COMPACT
  statusCard: {
    padding: 10,
    marginBottom: 8,
    marginHorizontal: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 143, 0, 0.25)',
  },
  statusHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  statusTitle: {
    fontSize: 12,
    fontFamily: 'PoppinsSemiBold',
    color: 'rgba(255, 255, 255, 0.85)',
  },
  statusText: {
    fontSize: 11,
    fontFamily: 'PoppinsRegular',
    color: 'rgba(255, 255, 255, 0.65)',
    marginBottom: 6,
  },

  // INFO CARD - DARK, EASY TO READ
  infoCard: {
    padding: 10,
    marginBottom: 8,
    marginHorizontal: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 143, 0, 0.25)',
  },
  infoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 7,
  },
  infoTitle: {
    fontSize: 11,
    fontFamily: 'PoppinsSemiBold',
    color: 'rgba(255, 255, 255, 0.85)',
    marginLeft: 5,
  },
  infoText: {
    fontSize: 11,
    fontFamily: 'PoppinsRegular',
    color: 'rgba(255, 255, 255, 0.7)',
    lineHeight: 17,
  },
  sessionText: {
    fontSize: 10,
    fontFamily: 'PoppinsRegular',
    color: 'rgba(255, 255, 255, 0.65)',
    marginBottom: 3,
  },

  // FRAMES - DARK, COMPACT GRID
  framesContainer: {
    flex: 1,
  },
  framesTitle: {
    fontSize: 12,
    fontFamily: 'PoppinsSemiBold',
    color: 'rgba(255, 255, 255, 0.85)',
    marginBottom: 8,
    textAlign: 'center',
  },
  framesGrid: {
    paddingBottom: 10,
  },
  frameCard: {
    margin: 3,
    padding: 8,
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 143, 0, 0.25)',
  },
  frameHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  frameNumber: {
    fontSize: 11,
    fontFamily: 'PoppinsSemiBold',
    color: 'rgba(255, 255, 255, 0.85)',
  },
  frameScores: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  frameScore: {
    fontSize: 14,
    fontFamily: 'PoppinsBold',
    color: 'rgba(255, 255, 255, 0.85)',
  },
  winningScore: {
    color: '#FF8F00',
  },
  frameSeparator: {
    fontSize: 11,
    fontFamily: 'PoppinsMedium',
    color: 'rgba(255, 255, 255, 0.4)',
    marginHorizontal: 5,
  },
  frameIncomplete: {
    fontSize: 10,
    fontFamily: 'PoppinsRegular',
    color: 'rgba(255, 255, 255, 0.6)',
    textAlign: 'center',
    fontStyle: 'italic',
  },
  frameWinnerContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 3,
  },
  frameWinnerLabel: {
    fontSize: 9,
    fontFamily: 'PoppinsRegular',
    color: 'rgba(255, 255, 255, 0.5)',
    marginBottom: 2,
  },
  frameWinnerName: {
    fontSize: 11,
    fontFamily: 'PoppinsSemiBold',
    color: '#FF8F00',
    textAlign: 'center',
  },
  frameBreaks: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 3,
  },
  frameBreak: {
    fontSize: 9,
    fontFamily: 'PoppinsMedium',
    color: 'rgba(255, 255, 255, 0.65)',
    marginHorizontal: 2,
  },
  winningBreak: {
    color: '#FF8F00',
    fontFamily: 'PoppinsBold',
  },

  // STATS CARD - DARK AND COMPACT
  statsCard: {
    padding: 10,
    marginBottom: 8,
    marginHorizontal: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 143, 0, 0.25)',
  },
  statsTitle: {
    fontSize: 12,
    fontFamily: 'PoppinsSemiBold',
    color: 'rgba(255, 255, 255, 0.85)',
    marginBottom: 8,
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 7,
  },
  statLabel: {
    fontSize: 11,
    fontFamily: 'PoppinsRegular',
    color: 'rgba(255, 255, 255, 0.7)',
  },
  statValue: {
    fontSize: 12,
    fontFamily: 'PoppinsSemiBold',
    color: '#FF8F00',
  },

  // PREDICTION CARD - DARK AND INTERACTIVE
  predictionCard: {
    padding: 10,
    marginBottom: 8,
    marginHorizontal: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 143, 0, 0.25)',
  },
  predictionTitle: {
    fontSize: 12,
    fontFamily: 'PoppinsSemiBold',
    color: 'rgba(255, 255, 255, 0.85)',
    textAlign: 'center',
    marginBottom: 10,
  },
  predictionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  predictionButton: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 8,
    marginHorizontal: 4,
    borderRadius: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    borderWidth: 1,
    borderColor: 'rgba(255, 143, 0, 0.2)',
  },
  predictionButtonSelected: {
    backgroundColor: 'rgba(255, 143, 0, 0.3)',
    borderColor: 'rgba(255, 143, 0, 0.6)',
  },
  predictionButtonText: {
    fontSize: 11,
    fontFamily: 'PoppinsMedium',
    color: 'rgba(255, 255, 255, 0.7)',
    textAlign: 'center',
  },
  predictionButtonTextSelected: {
    color: '#FF8F00',
    fontFamily: 'PoppinsSemiBold',
  },

  // H2H CARD - DARK HEAD TO HEAD
  h2hCard: {
    padding: 10,
    marginBottom: 8,
    marginHorizontal: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 143, 0, 0.25)',
  },
  h2hTitle: {
    fontSize: 12,
    fontFamily: 'PoppinsSemiBold',
    color: 'rgba(255, 255, 255, 0.85)',
    textAlign: 'center',
    marginBottom: 6,
  },
  h2hSubtitle: {
    fontSize: 10,
    fontFamily: 'PoppinsRegular',
    color: 'rgba(255, 255, 255, 0.65)',
    textAlign: 'center',
    marginBottom: 10,
  },
  h2hStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 10,
  },
  h2hStatItem: {
    alignItems: 'center',
  },
  h2hStatNumber: {
    fontSize: 16,
    fontFamily: 'PoppinsBold',
    color: '#FF8F00',
    marginBottom: 3,
  },
  h2hStatLabel: {
    fontSize: 10,
    fontFamily: 'PoppinsRegular',
    color: 'rgba(255, 255, 255, 0.7)',
    textAlign: 'center',
  },
  h2hLoading: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  h2hLoadingText: {
    fontSize: 11,
    fontFamily: 'PoppinsRegular',
    color: 'rgba(255, 255, 255, 0.65)',
    marginTop: 6,
  },
  h2hDetails: {
    marginTop: 10,
  },
  h2hDetailsTitle: {
    fontSize: 11,
    fontFamily: 'PoppinsSemiBold',
    color: 'rgba(255, 255, 255, 0.85)',
    marginBottom: 8,
    textAlign: 'center',
  },
  h2hPlayersContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  h2hPlayerStat: {
    flex: 1,
    alignItems: 'center',
  },
  h2hPlayerName: {
    fontSize: 11,
    fontFamily: 'PoppinsSemiBold',
    color: 'rgba(255, 255, 255, 0.85)',
    textAlign: 'center',
    marginBottom: 5,
  },
  h2hPlayerWins: {
    fontSize: 14,
    fontFamily: 'PoppinsBold',
    color: '#FF8F00',
    marginBottom: 3,
  },
  h2hPlayerPercentage: {
    fontSize: 10,
    fontFamily: 'PoppinsRegular',
    color: 'rgba(255, 255, 255, 0.7)',
  },
  h2hVs: {
    paddingHorizontal: 12,
  },
  h2hVsText: {
    fontSize: 10,
    fontFamily: 'PoppinsMedium',
    color: 'rgba(255, 255, 255, 0.4)',
  },
  h2hEmpty: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  h2hEmptyText: {
    fontSize: 11,
    fontFamily: 'PoppinsRegular',
    color: 'rgba(255, 255, 255, 0.7)',
    textAlign: 'center',
    marginTop: 6,
  },
  h2hEmptySubtext: {
    fontSize: 10,
    fontFamily: 'PoppinsRegular',
    color: 'rgba(255, 255, 255, 0.6)',
    textAlign: 'center',
    marginTop: 4,
    fontStyle: 'italic',
  },

  // FRAME STATS - DARK, COMPACT SUMMARY
  frameStatsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
  },
  frameStatColumn: {
    flex: 1,
    alignItems: 'center',
  },
  frameStatDivider: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  frameStatTitle: {
    fontSize: 10,
    fontFamily: 'PoppinsSemiBold',
    color: 'rgba(255, 255, 255, 0.85)',
    marginBottom: 6,
  },
  frameStatNumber: {
    fontSize: 20,
    fontFamily: 'PoppinsBold',
    color: '#FF8F00',
    marginBottom: 3,
  },
  frameStatLabel: {
    fontSize: 10,
    fontFamily: 'PoppinsRegular',
    color: 'rgba(255, 255, 255, 0.7)',
  },
  frameStatVs: {
    fontSize: 13,
    fontFamily: 'PoppinsMedium',
    color: 'rgba(255, 255, 255, 0.4)',
  },

  // EMPTY STATES - DARK AND COMFORTABLE
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
  },
  emptyText: {
    fontSize: 11,
    fontFamily: 'PoppinsRegular',
    color: 'rgba(255, 255, 255, 0.7)',
    textAlign: 'center',
    marginTop: 6,
  },
  emptySubtext: {
    fontSize: 10,
    fontFamily: 'PoppinsRegular',
    color: 'rgba(255, 255, 255, 0.6)',
    textAlign: 'center',
    marginTop: 4,
    fontStyle: 'italic',
  },
});
