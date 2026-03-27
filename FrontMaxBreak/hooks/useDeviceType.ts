import { Platform, useWindowDimensions } from 'react-native';

export type DeviceType = 'phone' | 'tablet' | 'tv';

export function useDeviceType(): DeviceType {
  const { width } = useWindowDimensions();
  if (Platform.isTV) return 'tv';
  if (width >= 768) return 'tablet';
  return 'phone';
}
