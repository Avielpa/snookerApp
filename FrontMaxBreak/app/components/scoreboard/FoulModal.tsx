import React, { useState } from 'react';
import { View, Text, Modal, TouchableOpacity, StyleSheet } from 'react-native';
import { useTheme } from '../../../contexts/ThemeContext';

interface Props {
  visible: boolean;
  foulingPlayer: string;
  opponentName: string;
  phase: 'reds' | 'colors';
  redsRemaining: number;
  onConfirm: (value: number, opponentPlays: boolean, redsAccidentallyPotted: number) => void;
  onCancel: () => void;
}

const FOUL_VALUES = [4, 5, 6, 7] as const;
const FOUL_LABELS: Record<number, string> = {
  4: '4 pts  (min / miss / wrong ball)',
  5: '5 pts  (blue involved)',
  6: '6 pts  (pink involved)',
  7: '7 pts  (black involved)',
};

export default function FoulModal({ visible, foulingPlayer, opponentName, phase, redsRemaining, onConfirm, onCancel }: Props) {
  const { theme } = useTheme();
  const c = theme.colors;
  const [selected, setSelected] = useState<number>(4);
  const [opponentPlays, setOpponentPlays] = useState(true);
  const [redsAccidentallyPotted, setRedsAccidentallyPotted] = useState(0);

  function handleConfirm() {
    onConfirm(selected, opponentPlays, redsAccidentallyPotted);
    setSelected(4);
    setOpponentPlays(true);
    setRedsAccidentallyPotted(0);
  }

  function handleCancel() {
    setSelected(4);
    setOpponentPlays(true);
    setRedsAccidentallyPotted(0);
    onCancel();
  }

  const showRedPicker = phase === 'reds' && redsRemaining > 0;
  const maxRedOptions = Math.min(redsRemaining, 3);
  const redOptions = Array.from({ length: maxRedOptions + 1 }, (_, i) => i); // [0, 1, ..., maxRedOptions]

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.overlay}>
        <View style={[styles.card, { backgroundColor: c.backgroundSecondary, borderColor: c.error }]}>
          <Text style={[styles.title, { color: c.error }]}>Foul</Text>
          <Text style={[styles.subtitle, { color: c.textSecondary }]}>
            {foulingPlayer} commits a foul
          </Text>

          <Text style={[styles.sectionLabel, { color: c.textMuted }]}>Foul value</Text>
          {FOUL_VALUES.map(val => (
            <TouchableOpacity
              key={val}
              style={[
                styles.option,
                { borderColor: selected === val ? c.error : c.cardBorder },
                selected === val && { backgroundColor: 'rgba(248,113,113,0.12)' },
              ]}
              onPress={() => setSelected(val)}
            >
              <Text style={[styles.optionText, { color: selected === val ? c.error : c.textSecondary }]}>
                {FOUL_LABELS[val]}
              </Text>
            </TouchableOpacity>
          ))}

          <Text style={[styles.sectionLabel, { color: c.textMuted, marginTop: 14 }]}>Who plays next?</Text>
          <View style={styles.toggleRow}>
            <TouchableOpacity
              style={[
                styles.toggleBtn,
                { borderColor: opponentPlays ? c.primary : c.cardBorder },
                opponentPlays && { backgroundColor: 'rgba(255,183,77,0.12)' },
              ]}
              onPress={() => setOpponentPlays(true)}
            >
              <Text style={{ color: opponentPlays ? c.primary : c.textSecondary, fontSize: 13 }}>
                {opponentName}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.toggleBtn,
                { borderColor: !opponentPlays ? c.primary : c.cardBorder },
                !opponentPlays && { backgroundColor: 'rgba(255,183,77,0.12)' },
              ]}
              onPress={() => setOpponentPlays(false)}
            >
              <Text style={{ color: !opponentPlays ? c.primary : c.textSecondary, fontSize: 13 }}>
                {foulingPlayer} (again)
              </Text>
            </TouchableOpacity>
          </View>

          {showRedPicker && (
            <View>
              <Text style={[styles.sectionLabel, { color: c.textMuted, marginTop: 14 }]}>
                Reds accidentally potted?
              </Text>
              <View style={styles.redPickerRow}>
                {redOptions.map(n => (
                  <TouchableOpacity
                    key={n}
                    style={[
                      styles.redPickerBtn,
                      { borderColor: redsAccidentallyPotted === n ? c.error : c.cardBorder },
                      redsAccidentallyPotted === n && { backgroundColor: 'rgba(248,113,113,0.12)' },
                    ]}
                    onPress={() => setRedsAccidentallyPotted(n)}
                  >
                    <Text style={[styles.redPickerText, { color: redsAccidentallyPotted === n ? c.error : c.textSecondary }]}>
                      {n}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          <View style={styles.btnRow}>
            <TouchableOpacity
              style={[styles.btn, { backgroundColor: c.backgroundTertiary }]}
              onPress={handleCancel}
            >
              <Text style={{ color: c.textSecondary, fontFamily: 'PoppinsBold' }}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.btn, { backgroundColor: c.error }]}
              onPress={handleConfirm}
            >
              <Text style={{ color: '#fff', fontFamily: 'PoppinsBold' }}>
                +{selected} to {opponentName}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  card: {
    width: '100%',
    maxWidth: 380,
    borderRadius: 16,
    borderWidth: 1,
    padding: 20,
  },
  title: {
    fontSize: 22,
    fontFamily: 'PoppinsBold',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 16,
  },
  sectionLabel: {
    fontSize: 11,
    marginBottom: 6,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  option: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 6,
  },
  optionText: { fontSize: 13 },
  toggleRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  toggleBtn: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
  },
  redPickerRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  redPickerBtn: {
    width: 48,
    height: 40,
    borderWidth: 1,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  redPickerText: {
    fontSize: 16,
    fontFamily: 'PoppinsBold',
  },
  btnRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 20,
  },
  btn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
});
