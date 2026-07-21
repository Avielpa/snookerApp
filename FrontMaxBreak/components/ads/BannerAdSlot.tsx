import React, { useEffect, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { ADS_ENABLED, BANNER_AD_UNIT_ID, initAds } from '../../services/adsService';

export default function BannerAdSlot() {
  const [AdComponent, setAdComponent] = useState<any>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    // Initialize ads (no-op unless a native SDK is installed)
    initAds().catch(() => {});

    // Try to dynamically require `expo-ads-admob` if it's available in the project.
    // This avoids runtime crashes when the dependency isn't installed.
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const admob = require('expo-ads-admob');
      if (admob && admob.AdMobBanner) {
        setAdComponent(() => admob.AdMobBanner);
      }
    } catch (e) {
      // Not installed — render nothing.
      setFailed(true);
    }
  }, []);

  if (!ADS_ENABLED || failed || !AdComponent || !BANNER_AD_UNIT_ID) return null;

  // Render the AdMob banner component from expo-ads-admob if available.
  // If you prefer another SDK, replace this component with the appropriate one.
  const AdMobBanner = AdComponent;

  return (
    <View style={styles.container} pointerEvents="box-none">
      {/* @ts-ignore - dynamic component */}
      <AdMobBanner
        bannerSize="smartBannerPortrait"
        adUnitID={BANNER_AD_UNIT_ID as string}
        servePersonalizedAds={true}
        onDidFailToReceiveAdWithError={() => setFailed(true)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
