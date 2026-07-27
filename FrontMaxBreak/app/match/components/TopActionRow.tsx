// app/match/components/TopActionRow.tsx
// Custom top row replacing the native Stack header entirely (headerShown:
// false on this screen) — a plain View gives full control over height/
// spacing, unlike the native header which reserved unpredictable vertical
// space for the back-title text on iOS. No top safe-area inset here: the
// global app Header (rendered above the routed screen in _layout.tsx)
// already sits below the notch, so adding insets.top on top of that was
// double-counting the inset a second time.
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
}

export function TopActionRow({
  colors,
  styles,
  onBack,
  onShare,
  showMute,
  isMuted,
  onToggleMute,
}: TopActionRowProps) {
  return (
    <View style={[styles.topActionRow, { paddingTop: 0, paddingBottom: 0, marginTop: 0, marginBottom: 0 }]}>
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
