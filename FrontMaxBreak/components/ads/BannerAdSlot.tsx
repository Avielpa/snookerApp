// components/ads/BannerAdSlot.tsx
import React, { useEffect, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { BannerAd, BannerAdSize } from 'react-native-google-mobile-ads';
import { useColors } from '../../contexts/ThemeContext';
import { ADS_ENABLED, BANNER_AD_UNIT_ID, initAds } from '../../services/adsService';

export default function BannerAdSlot() {
  const colors = useColors();
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (ADS_ENABLED) initAds();
  }, []);

  if (!ADS_ENABLED || failed || !BANNER_AD_UNIT_ID) {
    return null;
  }

  return (
    // DEBUG: precision test — remove after confirming ad vs container position
    <View style={[styles.container, { backgroundColor: 'cyan' }]}>
      <View style={[styles.frame, { borderColor: colors.cardBorder }]}>
        <BannerAd
          unitId={BANNER_AD_UNIT_ID}
          size={BannerAdSize.BANNER}
          onAdFailedToLoad={() => setFailed(true)}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    alignItems: 'center',
    paddingVertical: 4,
    // Strict sizing so the layout engine can never collapse/squash this
    // slot — it sits in a flex column next to a flex:1 sibling on Home.
    minHeight: 60,
    flexShrink: 0,
  },
  // Frames the (usually white/bright) ad creative so it reads as a
  // deliberate "picture" against the dark theme instead of a jarring flash.
  frame: {
    borderRadius: 10,
    borderWidth: 1,
    padding: 3,
    overflow: 'hidden',
  },
});
