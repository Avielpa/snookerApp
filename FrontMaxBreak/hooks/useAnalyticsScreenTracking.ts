// hooks/useAnalyticsScreenTracking.ts
import { useEffect } from 'react';
import { usePathname } from 'expo-router';
import { logScreenView } from '../services/analyticsService';

export function useAnalyticsScreenTracking(): void {
    const pathname = usePathname();

    useEffect(() => {
        if (!pathname) return;
        logScreenView(pathname);
    }, [pathname]);
}
