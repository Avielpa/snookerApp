// app/match/components/TopActionRow.tsx
// Custom top row replacing the native Stack header entirely (headerShown:
// false on this screen) — a plain View gives full control over height/
// spacing, unlike the native header which reserved unpredictable vertical
// space for the back-title text on iOS.
import React from 'react';
import { View, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface TopActionRowProps {
  colors: any;
  styles: any;
  onBack: () => void;
  onShare?: () => void;
  showMute?: boolean;
  isMuted?: boolean;
  onToggleMute?: () => void;
  // Manual safe-area top inset (from useSafeAreaInsets in the parent screen,
  // which uses a plain View instead of SafeAreaView to avoid double-applying
  // the top inset on iOS native-stack screens).
  topInset: number;
}

export function TopActionRow({
  colors,
  styles,
  onBack,
  onShare,
  showMute,
  isMuted,
  onToggleMute,
  topInset,
}: TopActionRowProps) {
  return (
    <View style={[styles.topActionRow, { paddingTop: topInset, paddingBottom: 0, marginBottom: 0 }]}>
      <TouchableOpacity onPress={onBack} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
        <Ionicons name="chevron-back" size={26} color={colors.primary} />
      </TouchableOpacity>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
        {showMute && (
          <TouchableOpacity onPress={onToggleMute} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons
              name={isMuted ? 'notifications-off' : 'notifications'}
              size={22}
              color={colors.primary}
            />
          </TouchableOpacity>
        )}
        {onShare && (
          <TouchableOpacity onPress={onShare} style={styles.shareButton}>
            <Ionicons name="share-outline" size={24} color={colors.primary} />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}
