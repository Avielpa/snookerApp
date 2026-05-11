// screens/CalendarEnhanced.tsx
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

import { getCalendarByTab } from '../services/matchServices';
import { logger } from '../utils/logger';
import { useColors } from '../contexts/ThemeContext';

interface Tournament {
  ID: number;
  Name: string;
  StartDate: string | null;
  EndDate: string | null;
  Venue?: string | null;
  City?: string | null;
  Country?: string | null;
  Type?: string | null;
  prizeMoney?: string;
  prize_money?: any;
  status?: 'active' | 'upcoming' | 'past';
  daysRemaining?: number;
  duration?: number;
  isLive?: boolean;
  progress?: number;
}

interface FilterOption {
  id: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  count?: number;
}

// ─── Tournament card (extracted to avoid re-creation on every render) ───────

const formatDateRange = (start: string | null, end: string | null): string => {
  if (!start || !end) return 'Dates TBD';
  try {
    const s = new Date(start).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
    const e = new Date(end).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
    return `${s} – ${e}`;
  } catch { return 'TBD'; }
};

const getPrizeDisplay = (item: Tournament): string | null => {
  const prize = item.prizeMoney || item.prize_money;
  if (!prize) return null;
  if (typeof prize === 'string' && prize.trim()) return prize;
  if (typeof prize === 'object' && prize !== null) {
    if (prize.winner?.formatted) return prize.winner.formatted;
    if (prize.winner?.amount) {
      return `${prize.winner.currency || 'GBP'} ${prize.winner.amount.toLocaleString()}`;
    }
  }
  return null;
};

const TournamentCard = React.memo(({
  item,
  onPress,
  colors,
}: {
  item: Tournament;
  onPress: () => void;
  colors: any;
}) => {
  const isLive = item.status === 'active';
  const isPast = item.status === 'past';
  const accentColor = isLive ? colors.success : isPast ? colors.textMuted : colors.primary;

  const statusLabel = isLive
    ? 'LIVE'
    : isPast
    ? 'Done'
    : item.daysRemaining === 1
    ? 'Tomorrow'
    : item.daysRemaining
    ? `in ${item.daysRemaining}d`
    : '';

  const prizeDisplay = getPrizeDisplay(item);
  const location = [item.City, item.Country].filter(Boolean).join(', ');

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.72}
      style={[
        cardStyles.container,
        { backgroundColor: colors.backgroundSecondary, borderColor: colors.cardBorder },
      ]}
    >
      {/* Left accent bar — color signals status at a glance */}
      <View style={[cardStyles.accentBar, { backgroundColor: accentColor }]} />

      <View style={cardStyles.body}>
        {/* Name + status pill */}
        <View style={cardStyles.nameRow}>
          <Text style={[cardStyles.name, { color: colors.textPrimary }]} numberOfLines={2}>
            {item.Name}
          </Text>
          {statusLabel !== '' && (
            <View style={[cardStyles.statusPill, { borderColor: accentColor + '55' }]}>
              {isLive && <View style={[cardStyles.liveDot, { backgroundColor: accentColor }]} />}
              <Text style={[cardStyles.statusText, { color: accentColor }]}>{statusLabel}</Text>
            </View>
          )}
        </View>

        {/* Dates */}
        <View style={cardStyles.metaRow}>
          <Ionicons name="calendar-outline" size={12} color={colors.textMuted} />
          <Text style={[cardStyles.metaText, { color: colors.textSecondary }]}>
            {formatDateRange(item.StartDate, item.EndDate)}
          </Text>
        </View>

        {/* Location */}
        {location.length > 0 && (
          <View style={cardStyles.metaRow}>
            <Ionicons name="location-outline" size={12} color={colors.textMuted} />
            <Text style={[cardStyles.metaText, { color: colors.textMuted }]} numberOfLines={1}>
              {location}
            </Text>
          </View>
        )}

        {/* Prize */}
        {prizeDisplay && (
          <View style={cardStyles.metaRow}>
            <Ionicons name="trophy-outline" size={12} color={colors.warning} />
            <Text style={[cardStyles.metaText, { color: colors.warning }]}>
              {prizeDisplay} winner
            </Text>
          </View>
        )}

        {/* Progress bar — only shown during active tournament */}
        {isLive && item.progress !== undefined && item.progress > 0 && (
          <View style={[cardStyles.progressTrack, { backgroundColor: colors.cardBorder }]}>
            <View
              style={[
                cardStyles.progressFill,
                { width: `${Math.round(item.progress * 100)}%`, backgroundColor: accentColor },
              ]}
            />
          </View>
        )}
      </View>

      <Ionicons name="chevron-forward" size={16} color={colors.textMuted} style={cardStyles.chevron} />
    </TouchableOpacity>
  );
});
TournamentCard.displayName = 'TournamentCard';

const cardStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginVertical: 5,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  accentBar: {
    width: 4,
  },
  body: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 5,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 2,
  },
  name: {
    fontSize: 14,
    fontFamily: 'PoppinsSemiBold',
    flex: 1,
    lineHeight: 20,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 20,
    borderWidth: 1,
    gap: 4,
    flexShrink: 0,
  },
  liveDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
  },
  statusText: {
    fontSize: 10,
    fontFamily: 'PoppinsBold',
    letterSpacing: 0.3,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  metaText: {
    fontSize: 12,
    fontFamily: 'PoppinsRegular',
    flex: 1,
  },
  progressTrack: {
    height: 3,
    borderRadius: 2,
    marginTop: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
  },
  chevron: {
    alignSelf: 'center',
    marginRight: 10,
  },
});

// ─── Main screen ─────────────────────────────────────────────────────────────

export default function CalendarEnhanced() {
  const [allTournaments, setAllTournaments] = useState<Tournament[]>([]);
  const [filteredTournaments, setFilteredTournaments] = useState<Tournament[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchVisible, setSearchVisible] = useState(false);
  const [selectedTab, setSelectedTab] = useState<string>('main');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const router = useRouter();
  const colors = useColors();

  const enhanceTournamentData = useCallback((tournaments: Tournament[]): Tournament[] => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);

    return tournaments.map(tournament => {
      let status: 'active' | 'upcoming' | 'past' = 'upcoming';
      let daysRemaining = 0;
      let duration = 0;
      let progress = 0;
      let isLive = false;

      if (tournament.StartDate && tournament.EndDate) {
        const start = new Date(tournament.StartDate);
        const end = new Date(tournament.EndDate);
        start.setHours(0, 0, 0, 0);
        end.setHours(23, 59, 59, 999);
        duration = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));

        if (end < now) {
          status = 'past';
        } else if (start <= now && now <= end) {
          status = 'active';
          isLive = true;
          const totalDuration = end.getTime() - start.getTime();
          const elapsedTime = now.getTime() - start.getTime();
          progress = Math.max(0, Math.min(1, elapsedTime / totalDuration));
        } else {
          status = 'upcoming';
          daysRemaining = Math.ceil((start.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        }
      }

      return { ...tournament, status, daysRemaining, duration, progress, isLive };
    });
  }, []);

  const fetchTournaments = useCallback(async (tabType: string = 'main', isRefresh = false) => {
    if (!isRefresh) setLoading(true);
    setRefreshing(isRefresh);
    setError(null);

    try {
      const response = await getCalendarByTab(tabType);
      if (!response) throw new Error(`Failed to load ${tabType} tournaments`);

      const combined = [
        ...(response.active || []),
        ...(response.upcoming || []),
        ...(response.recent || []),
      ].map(t => ({
        ...t,
        ID: t.id,
        Name: t.name,
        StartDate: t.start_date,
        EndDate: t.end_date,
        Venue: t.venue,
        City: t.city,
        Country: t.country,
        prize_money: t.prize_money,
      }));

      const sorted = combined.sort((a, b) => {
        const dateA = a.StartDate ? new Date(a.StartDate).getTime() : 0;
        const dateB = b.StartDate ? new Date(b.StartDate).getTime() : 0;
        return dateB - dateA;
      });

      setAllTournaments(enhanceTournamentData(sorted));
    } catch (err: any) {
      logger.error(`[Calendar] Error: ${err.message}`);
      setError(err.message || 'Failed to load tournaments');
      setAllTournaments([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [enhanceTournamentData]);

  useEffect(() => { fetchTournaments(selectedTab); }, [selectedTab, fetchTournaments]);

  const tabOptions: FilterOption[] = useMemo(() => [
    { id: 'main', label: 'Main Tours', icon: 'trophy-outline', color: colors.primary },
    { id: 'others', label: 'Others', icon: 'star-outline', color: colors.primary },
  ], [colors]);

  const statusOptions: FilterOption[] = useMemo(() => {
    const live = allTournaments.filter(t => t.isLive).length;
    const upcoming = allTournaments.filter(t => t.status === 'upcoming').length;
    const past = allTournaments.filter(t => t.status === 'past').length;
    const all = allTournaments.length;
    return [
      { id: 'all', label: 'All', icon: 'apps-outline', count: all },
      { id: 'active', label: 'Live', icon: 'radio-outline', count: live },
      { id: 'upcoming', label: 'Upcoming', icon: 'calendar-outline', count: upcoming },
      { id: 'past', label: 'Past', icon: 'checkmark-done-outline', count: past },
    ];
  }, [allTournaments]);

  useEffect(() => {
    let filtered = [...allTournaments];

    if (selectedStatus !== 'all') {
      filtered = selectedStatus === 'active'
        ? filtered.filter(t => t.isLive)
        : filtered.filter(t => t.status === selectedStatus);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      filtered = filtered.filter(t =>
        t.Name?.toLowerCase().includes(q) ||
        t.Venue?.toLowerCase().includes(q) ||
        t.City?.toLowerCase().includes(q) ||
        t.Country?.toLowerCase().includes(q)
      );
    }

    filtered.sort((a, b) => {
      const priority = { active: 0, upcoming: 1, past: 2 };
      const ap = priority[a.status || 'past'];
      const bp = priority[b.status || 'past'];
      if (ap !== bp) return ap - bp;
      const aDate = a.StartDate ? new Date(a.StartDate).getTime() : 0;
      const bDate = b.StartDate ? new Date(b.StartDate).getTime() : 0;
      return a.status === 'upcoming' ? aDate - bDate : bDate - aDate;
    });

    setFilteredTournaments(filtered);
  }, [allTournaments, selectedStatus, searchQuery]);

  const handleTabPress = (tabId: string) => {
    if (tabId !== selectedTab) setSelectedTab(tabId);
  };

  const handleStatusPress = (statusId: string) => {
    if (statusId !== selectedStatus) setSelectedStatus(statusId);
  };

  const handleTournamentPress = (tournament: Tournament) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push(`/tour/${tournament.ID}`);
  };

  // ─── Loading ───────────────────────────────────────────────────────────────
  if (loading && !refreshing) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  // ─── Error ─────────────────────────────────────────────────────────────────
  if (error && !refreshing) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.centerContent}>
          <Ionicons name="alert-circle-outline" size={48} color="#F87171" />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity
            style={[styles.retryButton, { backgroundColor: colors.primary }]}
            onPress={() => fetchTournaments(selectedTab)}
          >
            <Text style={styles.retryText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // ─── Main render ───────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>

      {/* Header */}
      <View style={styles.header}>
        <Text style={[styles.screenTitle, { color: colors.textHeader }]}>Calendar</Text>
        <TouchableOpacity
          onPress={() => {
            setSearchVisible(v => !v);
            if (searchVisible) setSearchQuery('');
          }}
          style={styles.searchToggle}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons
            name={searchVisible ? 'close-outline' : 'search-outline'}
            size={22}
            color={colors.textPrimary}
          />
        </TouchableOpacity>
      </View>

      {/* Collapsible search bar */}
      {searchVisible && (
        <View style={[styles.searchRow, { backgroundColor: colors.backgroundSecondary, borderBottomColor: colors.cardBorder }]}>
          <Ionicons name="search-outline" size={15} color={colors.textMuted} />
          <TextInput
            style={[styles.searchInput, { color: colors.textPrimary }]}
            placeholder="Search tournaments, venues, countries..."
            placeholderTextColor={colors.textMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoFocus
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={16} color={colors.textMuted} />
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Tour type segment: MAIN TOURS | OTHERS */}
      <View style={[styles.segmentRow, { backgroundColor: colors.backgroundSecondary, borderBottomColor: colors.cardBorder }]}>
        {tabOptions.map(tab => {
          const isSelected = selectedTab === tab.id;
          return (
            <TouchableOpacity
              key={tab.id}
              style={[styles.segmentBtn, isSelected && { borderBottomColor: colors.primary }]}
              onPress={() => handleTabPress(tab.id)}
              activeOpacity={0.7}
            >
              <Text style={[
                styles.segmentText,
                { color: isSelected ? colors.primary : colors.textMuted },
                isSelected && styles.segmentTextActive,
              ]}>
                {tab.label.toUpperCase()}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Status filter pills */}
      <View style={[styles.pillRow, { borderBottomColor: colors.cardBorder }]}>
        {statusOptions.map(opt => {
          const isSelected = selectedStatus === opt.id;
          return (
            <TouchableOpacity
              key={opt.id}
              onPress={() => handleStatusPress(opt.id)}
              activeOpacity={0.7}
              style={[
                styles.pill,
                { borderColor: isSelected ? colors.primary : colors.cardBorder },
                isSelected && { backgroundColor: colors.primary },
              ]}
            >
              {opt.id === 'active' && (
                <View style={[styles.liveDot, { backgroundColor: isSelected ? '#fff' : colors.success }]} />
              )}
              <Text style={[styles.pillText, { color: isSelected ? '#fff' : colors.textMuted }]}>
                {opt.label}
              </Text>
              {opt.count !== undefined && opt.count > 0 && (
                <Text style={[styles.pillCount, { color: isSelected ? 'rgba(255,255,255,0.75)' : colors.textMuted }]}>
                  {opt.count}
                </Text>
              )}
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Tournament list */}
      {filteredTournaments.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="calendar-outline" size={48} color={colors.textMuted} />
          <Text style={[styles.emptyText, { color: colors.textMuted }]}>
            {searchQuery ? 'No tournaments match your search.' : 'No tournaments available.'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={filteredTournaments}
          renderItem={({ item }) => (
            <TournamentCard
              item={item}
              onPress={() => handleTournamentPress(item)}
              colors={colors}
            />
          )}
          keyExtractor={(item, index) => `tournament-${item.ID}-${index}`}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => fetchTournaments(selectedTab, true)}
              tintColor={colors.primary}
              colors={[colors.primary]}
            />
          }
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContent}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  screenTitle: {
    fontSize: 22,
    fontFamily: 'PoppinsBold',
  },
  searchToggle: {
    padding: 4,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    fontFamily: 'PoppinsRegular',
    paddingVertical: 0,
  },
  segmentRow: {
    flexDirection: 'row',
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  segmentBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 13,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  segmentText: {
    fontSize: 12,
    fontFamily: 'PoppinsMedium',
    letterSpacing: 0.8,
  },
  segmentTextActive: {
    fontFamily: 'PoppinsBold',
  },
  pillRow: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  pill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
    gap: 6,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  pillText: {
    fontSize: 13,
    fontFamily: 'PoppinsMedium',
  },
  pillCount: {
    fontSize: 11,
    fontFamily: 'PoppinsMedium',
    opacity: 0.7,
  },
  listContent: {
    paddingTop: 8,
    paddingBottom: 16,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
    gap: 12,
  },
  emptyText: {
    fontSize: 14,
    fontFamily: 'PoppinsRegular',
    textAlign: 'center',
    paddingHorizontal: 32,
  },
  errorText: {
    marginTop: 12,
    fontSize: 14,
    fontFamily: 'PoppinsRegular',
    color: '#F87171',
    textAlign: 'center',
  },
  retryButton: {
    marginTop: 20,
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 8,
  },
  retryText: {
    fontSize: 14,
    fontFamily: 'PoppinsSemiBold',
    color: '#fff',
  },
});
