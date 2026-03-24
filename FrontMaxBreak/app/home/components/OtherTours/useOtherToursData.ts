// useOtherToursData.ts — fetch once, filter client-side when pill changes

import { useState, useEffect, useCallback, useRef } from 'react';
import { api } from '../../../../services/api';
import { categorize, TourFilter, OtherTourEvent, CategorizedEvents } from './groupUtils';

const EMPTY: CategorizedEvents = { live: [], upcoming: [], recent: [], earlier: [] };

export function useOtherToursData(tour: TourFilter) {
    const [allEvents, setAllEvents] = useState<OtherTourEvent[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const fetchedRef = useRef(false);

    const fetchData = useCallback(async (isRefresh = false) => {
        if (isRefresh) setRefreshing(true);
        else setLoading(true);
        setError(null);
        try {
            const response = await api.get<OtherTourEvent[]>('other-tours/');
            setAllEvents(Array.isArray(response.data) ? response.data : []);
        } catch {
            setError('Could not load other tours. Pull down to retry.');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    useEffect(() => {
        if (!fetchedRef.current) {
            fetchedRef.current = true;
            fetchData();
        }
    }, [fetchData]);

    const categorized = allEvents.length > 0 ? categorize(allEvents, tour) : EMPTY;

    return {
        ...categorized,
        loading,
        refreshing,
        error,
        refresh: () => fetchData(true),
    };
}
