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

  if (!ADS_ENABLED || failed) {
    return null;
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <BannerAd
        unitId={BANNER_AD_UNIT_ID}
        size={BannerAdSize.BANNER}
        onAdFailedToLoad={() => setFailed(true)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    alignItems: 'center',
    paddingVertical: 4,
  },
});
