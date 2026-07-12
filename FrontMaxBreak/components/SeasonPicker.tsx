import React, { useState } from 'react';
import {
  View,
  Text,
  Pressable,
  Modal,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { useColors } from '../contexts/ThemeContext';
import { seasonDisplayLabel, getCurrentSeasonYear } from '../hooks/useSeasonSelector';

interface SeasonPickerProps {
  seasons: number[];
  selected: number;
  onSelect: (year: number) => void;
}

export default function SeasonPicker({ seasons, selected, onSelect }: SeasonPickerProps) {
  const colors = useColors();
  const [open, setOpen] = useState(false);

  const displayYear = seasons.length > 0 ? selected : getCurrentSeasonYear();
  const canOpen = seasons.length > 0;

  const handleSelect = (year: number) => {
    setOpen(false);
    onSelect(year);
  };

  return (
    <>
      <Pressable
        onPress={() => canOpen && setOpen(true)}
        style={[styles.chip, { backgroundColor: colors.cardBackground, borderColor: colors.cardBorder }]}
        accessibilityRole="button"
        accessibilityLabel={`Season ${seasonDisplayLabel(displayYear)}, tap to change`}
      >
        <Text style={[styles.chipText, { color: colors.textPrimary }]}>
          {seasonDisplayLabel(displayYear)}
        </Text>
        <Text style={[styles.chevron, { color: colors.textSecondary }]}>{' ▾'}</Text>
      </Pressable>

      <Modal
        visible={open}
        transparent
        animationType="fade"
        onRequestClose={() => setOpen(false)}
      >
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <View style={[styles.sheet, { backgroundColor: colors.cardBackground, borderColor: colors.cardBorder }]}>
            <Text style={[styles.sheetTitle, { color: colors.textSecondary }]}>Select Season</Text>
            <ScrollView bounces={false} showsVerticalScrollIndicator={false}>
              {seasons.map((year) => {
                const isSelected = year === selected;
                return (
                  <Pressable
                    key={year}
                    onPress={() => handleSelect(year)}
                    style={[
                      styles.row,
                      isSelected && { backgroundColor: colors.accent + '22' },
                    ]}
                  >
                    <Text style={[
                      styles.rowText,
                      { color: isSelected ? colors.accent : colors.textPrimary },
                    ]}>
                      {seasonDisplayLabel(year)}
                    </Text>
                    {isSelected && (
                      <Text style={[styles.check, { color: colors.accent }]}>✓</Text>
                    )}
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
  },
  chipText: {
    fontSize: 14,
    fontWeight: '600',
  },
  chevron: {
    fontSize: 12,
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sheet: {
    width: 220,
    maxHeight: 360,
    borderRadius: 14,
    borderWidth: 1,
    overflow: 'hidden',
    paddingTop: 4,
  },
  sheetTitle: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 13,
  },
  rowText: {
    fontSize: 15,
    fontWeight: '500',
  },
  check: {
    fontSize: 16,
    fontWeight: '700',
  },
});
