import React from 'react';
import { View, Text, Modal, TouchableOpacity, StyleSheet } from 'react-native';
import { scoreboardColors } from '../../../constants/scoreboardTheme';

interface Props {
  visible: boolean;
  playerNames: [string, string];
  onChoose: (player: 0 | 1) => void;
}

// Shown when the frame is tied after the last black is potted (respotted-black rule).
// The players/referee decide who breaks (e.g. by a coin toss) — the app just records the choice.
export default function RespotBreakerModal({ visible, playerNames, onChoose }: Props) {
  const c = scoreboardColors;

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.overlay}>
        <View style={[styles.card, { backgroundColor: c.backgroundSecondary, borderColor: c.primary }]}>
          <Text style={[styles.title, { color: c.primary }]}>Black Re-spotted</Text>
          <Text style={[styles.subtitle, { color: c.textSecondary }]}>
            Frame is level — who breaks?
          </Text>

          <TouchableOpacity
            style={[styles.btn, { backgroundColor: c.primary }]}
            onPress={() => onChoose(0)}
          >
            <Text style={[styles.btnText, { color: '#121212' }]}>{playerNames[0]} breaks</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.btn, { backgroundColor: c.primary, marginTop: 10 }]}
            onPress={() => onChoose(1)}
          >
            <Text style={[styles.btnText, { color: '#121212' }]}>{playerNames[1]} breaks</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  card: {
    width: '100%',
    maxWidth: 380,
    borderRadius: 20,
    borderWidth: 1,
    padding: 24,
    alignItems: 'center',
  },
  title: {
    fontSize: 20,
    fontFamily: 'PoppinsBold',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 13,
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 18,
  },
  btn: {
    width: '100%',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  btnText: {
    fontFamily: 'PoppinsBold',
    fontSize: 15,
  },
});
