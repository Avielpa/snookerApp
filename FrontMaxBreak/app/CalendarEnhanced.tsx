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
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';

import { getCalendarByTab } from '../services/matchServices';
import { logger } from '../utils/logger';
import { useColors } from '../contexts/ThemeContext';
import { useSeasonSelector, dateToSeasonYear, seasonDisplayLabel } from '../hooks/useSeasonSelector';
import SeasonPicker from '../components/SeasonPicker';
import { groupChampionshipLeague, CHAMPIONSHIP_LEAGUE_GROUP_ID } from '../utils/championshipLeagueGroup';

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
  isGroup?: boolean;
  isGroupChild?: boolean;
  children?: Tournament[];
  legCount?: number;
}

interface FilterOption {
  id: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  count?: number;
}

interface TourGroupHeader {
  __header: true;
  id: string;
  label: string;
  color: string;
}

// Reuses the app's existing Other-Tours color mapping (Home screen's
// OtherToursTab.TOUR_COLOR) — no new colors invented for this grouping.
const TOUR_TYPE_COLORS: Record<string, string> = {
  'Q Tour': '#5AA9E6',
  "Women's": '#F0648C',
  'Seniors': '#FF9F45',
  'Other': '#9E9E9E',
};

// ─── Tournament card (extracted to avoid re-creation on every render) ───────

export const formatDateRange = (start: string | null, end: string | null): string => {
  if (!start || !end) return 'Dates TBD';
  try {
    const s = new Date(start).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
    const e = new Date(end).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
    return `${s} – ${e}`;
  } catch { return 'TBD'; }
};

export const getPrizeDisplay = (item: Tournament): string | null => {
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

export const filterAndSortTournaments = (
  tournaments: Tournament[],
  opts: { season: number; status: string; query: string }
): Tournament[] => {
  let filtered = [...tournaments];

  // Season filter — events with null StartDate pass through (never hidden)
  filtered = filtered.filter(t => !t.StartDate || dateToSeasonYear(t.StartDate) === opts.season);

  if (opts.status !== 'all') {
    filtered = opts.status === 'active'
      ? filtered.filter(t => t.isLive)
      : filtered.filter(t => t.status === opts.status);
  }

  if (opts.query.trim()) {
    const q = opts.query.toLowerCase().trim();
    filtered = filtered.filter(t =>
      t.Name?.toLowerCase().includes(q) ||
      t.Venue?.toLowerCase().includes(q) ||
      t.City?.toLowerCase().includes(q) ||
      t.Country?.toLowerCase().includes(q)
    );
  }

  filtered = groupChampionshipLeague(filtered) as Tournament[];

  filtered.sort((a, b) => {
    const priority = { active: 0, upcoming: 1, past: 2 };
    const ap = priority[a.status || 'past'];
    const bp = priority[b.status || 'past'];
    if (ap !== bp) return ap - bp;
    const aDate = a.StartDate ? new Date(a.StartDate).getTime() : 0;
    const bDate = b.StartDate ? new Date(b.StartDate).getTime() : 0;
    return a.status === 'upcoming' ? aDate - bDate : bDate - aDate;
  });

  return filtered;
};

export const computeTournamentStatus = (tournament: Tournament, now: Date): Tournament => {
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
};

const TournamentCard = React.memo(({
  item,
  onPress,
  colors,
  expanded,
}: {
  item: Tournament;
  onPress: () => void;
  colors: any;
  expanded?: boolean;
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
  const groupCount = item.isGroup ? item.children?.length ?? 0 : 0;

  // Featured "hero" treatment for the live tournament — bigger, gradient-tinted
  // card with a visible progress bar. Everything else uses the compact row.
  // Purely a style/JSX branch keyed off the already-computed isLive/progress
  // fields — no new data, same accentColor/statusLabel logic as the compact card.
  const isHero = isLive && !item.isGroupChild;

  const groupNote = item.isGroup
    ? `${groupCount} groups${item.legCount && item.legCount > 1 ? ` · ${item.legCount} runs this season` : ''} · ${expanded ? 'tap to collapse' : 'tap to view'}`
    : null;

  // Bolder visual treatment: gradient background for the hero card (real
  // expo-linear-gradient, already a project dependency) and a colored icon
  // tile per card (replacing the thin flat accent bar) so status reads at a
  // glance even without live data. Same accentColor/status logic as before,
  // just a stronger visual expression of it.
  const cardInner = (
    <>
      {/* Icon tile — colored per status, replaces the old thin flat bar */}
      <View style={[cardStyles.iconTile, isHero && cardStyles.heroIconTile, { backgroundColor: accentColor + '26' }]}>
        <Ionicons name={isLive ? 'radio' : item.isGroup ? 'layers' : 'trophy'} size={isHero ? 20 : 15} color={accentColor} />
      </View>

      <View style={[cardStyles.body, isHero && cardStyles.heroBody]}>
        {/* Name + status pill */}
        <View style={cardStyles.nameRow}>
          <Text
            style={[cardStyles.name, isHero && cardStyles.heroName, { color: colors.textPrimary }]}
            numberOfLines={isHero ? 2 : 1}
          >
            {item.Name}
          </Text>
          {statusLabel !== '' && (
            <View style={[cardStyles.statusPill, { borderColor: accentColor + '55' }]}>
              {isLive && <View style={[cardStyles.liveDot, { backgroundColor: accentColor }]} />}
              <Text style={[cardStyles.statusText, { color: accentColor }]}>{statusLabel}</Text>
            </View>
          )}
        </View>

        {/* Single compact meta line: dates · location · prize — was 3 stacked rows */}
        <View style={cardStyles.metaRow}>
          <Ionicons name="calendar-outline" size={11} color={colors.textMuted} />
          <Text style={[cardStyles.metaText, { color: colors.textSecondary }]} numberOfLines={1}>
            {formatDateRange(item.StartDate, item.EndDate)}
            {location.length > 0 ? `  ·  ${location}` : ''}
          </Text>
        </View>

        {prizeDisplay && (
          <View style={cardStyles.metaRow}>
            <Ionicons name="trophy-outline" size={11} color={colors.warning} />
            <Text style={[cardStyles.metaText, { color: colors.warning }]} numberOfLines={1}>
              {prizeDisplay} winner
            </Text>
          </View>
        )}

        {/* Group badge — Championship League collapses its ~40 groups here.
            legCount > 1 means it's played in separate runs this season (e.g.
            June and again in January) — the dates above show only the
            current/next run, not a misleading full-season span. */}
        {groupNote && (
          <View style={cardStyles.metaRow}>
            <Ionicons name="layers-outline" size={11} color={colors.primary} />
            <Text style={[cardStyles.metaText, { color: colors.primary }]} numberOfLines={1}>
              {groupNote}
            </Text>
          </View>
        )}

        {/* Progress bar — only shown during active tournament */}
        {isLive && item.progress !== undefined && item.progress > 0 && (
          <View style={[cardStyles.progressTrack, isHero && cardStyles.heroProgressTrack, { backgroundColor: colors.cardBorder }]}>
            <View
              style={[
                cardStyles.progressFill,
                { width: `${Math.round(item.progress * 100)}%`, backgroundColor: accentColor },
              ]}
            />
          </View>
        )}
      </View>

      <Ionicons
        name={item.isGroup ? (expanded ? 'chevron-down' : 'chevron-forward') : 'chevron-forward'}
        size={16}
        color={colors.textMuted}
        style={cardStyles.chevron}
      />
    </>
  );

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.72}
      style={[
        cardStyles.container,
        isHero && cardStyles.heroContainer,
        item.isGroupChild && cardStyles.childContainer,
        { borderColor: isHero ? accentColor + '80' : colors.cardBorder },
      ]}
    >
      {isHero ? (
        <LinearGradient
          colors={[accentColor + '2E', colors.backgroundSecondary, colors.backgroundSecondary]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={cardStyles.cardRow}
        >
          {cardInner}
        </LinearGradient>
      ) : (
        <View style={[cardStyles.cardRow, { backgroundColor: colors.backgroundSecondary }]}>
          {cardInner}
        </View>
      )}
    </TouchableOpacity>
  );
});
TournamentCard.displayName = 'TournamentCard';

const cardStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginVertical: 3,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  heroContainer: {
    marginVertical: 6,
    borderRadius: 14,
    borderWidth: 1.5,
  },
  cardRow: {
    flexDirection: 'row',
    flex: 1,
  },
  iconTile: {
    width: 30,
    height: 30,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 10,
    marginVertical: 8,
  },
  heroIconTile: {
    width: 40,
    height: 40,
    borderRadius: 12,
    marginLeft: 13,
    marginVertical: 11,
  },
  childContainer: {
    marginLeft: 28,
  },
  body: {
    flex: 1,
    paddingHorizontal: 10,
    paddingVertical: 7,
    gap: 2,
  },
  heroBody: {
    paddingHorizontal: 13,
    paddingVertical: 11,
    gap: 4,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 1,
  },
  name: {
    fontSize: 12.5,
    fontFamily: 'PoppinsSemiBold',
    flex: 1,
    lineHeight: 17,
  },
  heroName: {
    fontSize: 15,
    lineHeight: 20,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 7,
    paddingVertical: 2,
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
    fontSize: 9,
    fontFamily: 'PoppinsBold',
    letterSpacing: 0.3,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    fontSize: 10.5,
    fontFamily: 'PoppinsRegular',
    flex: 1,
  },
  progressTrack: {
    height: 3,
    borderRadius: 2,
    marginTop: 3,
    overflow: 'hidden',
  },
  heroProgressTrack: {
    height: 4,
    marginTop: 6,
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
  const [expandedGroupId, setExpandedGroupId] = useState<string | null>(null);

  const router = useRouter();
  const colors = useColors();

  const [availableSeasons, setAvailableSeasons] = useState<number[]>([]);

  const { selectedSeason, setSelectedSeason } = useSeasonSelector(availableSeasons);

  const enhanceTournamentData = useCallback((tournaments: Tournament[]): Tournament[] => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    return tournaments.map(tournament => computeTournamentStatus(tournament, now));
  }, []);

  const fetchTournaments = useCallback(async (tabType: string = 'main', season?: number, isRefresh = false) => {
    if (!isRefresh) setLoading(true);
    setRefreshing(isRefresh);
    setError(null);

    try {
      const response = await getCalendarByTab(tabType, season);
      if (!response) throw new Error(`Failed to load ${tabType} tournaments`);

      if (Array.isArray(response.available_seasons) && response.available_seasons.length > 0) {
        setAvailableSeasons(response.available_seasons);
      }

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

  useEffect(() => { fetchTournaments(selectedTab, selectedSeason); }, [selectedTab, selectedSeason, fetchTournaments]);

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
    setFilteredTournaments(
      filterAndSortTournaments(allTournaments, {
        season: selectedSeason,
        status: selectedStatus,
        query: searchQuery,
      })
    );
  }, [allTournaments, selectedStatus, searchQuery, selectedSeason]);

  // Flatten the expanded group's children into the list right after its card.
  const displayTournaments = useMemo(() => {
    if (!expandedGroupId) return filteredTournaments;
    const result: Tournament[] = [];
    for (const item of filteredTournaments) {
      result.push(item);
      if (item.isGroup && String(item.ID) === expandedGroupId && item.children) {
        result.push(...item.children.map(c => ({ ...c, isGroupChild: true })));
      }
    }
    return result;
  }, [filteredTournaments, expandedGroupId]);

  // Display-only grouping by tour type, ONLY for the "Others" tab — Main Tours
  // passes `displayTournaments` straight through unchanged (identity, same
  // reference, zero behavior change). Groups by the already-fetched `Type`
  // field; unknown/missing types fall into a single "Other" group rather
  // than being hidden. This is a presentational grouping transform, same
  // pattern as the existing `groupChampionshipLeague`, not new data fetching.
  const othersGroupedData = useMemo((): (Tournament | TourGroupHeader)[] => {
    if (selectedTab !== 'others') return displayTournaments;
    const seen: string[] = [];
    const buckets = new Map<string, Tournament[]>();
    for (const item of displayTournaments) {
      const key = item.Type || 'Other';
      if (!buckets.has(key)) { buckets.set(key, []); seen.push(key); }
      buckets.get(key)!.push(item);
    }
    const out: (Tournament | TourGroupHeader)[] = [];
    for (const key of seen) {
      out.push({ __header: true, id: `header-${key}`, label: key, color: TOUR_TYPE_COLORS[key] || colors.primary });
      out.push(...buckets.get(key)!);
    }
    return out;
  }, [displayTournaments, selectedTab, colors.primary]);

  const handleTabPress = (tabId: string) => {
    if (tabId !== selectedTab) setSelectedTab(tabId);
  };

  const handleStatusPress = (statusId: string) => {
    if (statusId !== selectedStatus) setSelectedStatus(statusId);
  };

  const handleTournamentPress = (tournament: Tournament) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (tournament.isGroup) {
      setExpandedGroupId(prev => (prev === String(tournament.ID) ? null : String(tournament.ID)));
      return;
    }
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
            onPress={() => fetchTournaments(selectedTab, selectedSeason)}
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

      {/* Season selector */}
      <View style={[styles.seasonRow, { borderBottomColor: colors.cardBorder }]}>
        <SeasonPicker
          seasons={availableSeasons}
          selected={selectedSeason}
          onSelect={setSelectedSeason}
        />
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
            {searchQuery
              ? 'No tournaments match your search.'
              : `No tournaments found for ${seasonDisplayLabel(selectedSeason)}.\nTry selecting a different season.`}
          </Text>
        </View>
      ) : (
        <FlatList
          data={othersGroupedData}
          renderItem={({ item }) => {
            if ('__header' in item) {
              return (
                <View style={styles.tourGroupHeader}>
                  <View style={[styles.tourGroupDot, { backgroundColor: item.color }]} />
                  <Text style={[styles.tourGroupLabel, { color: item.color }]}>{item.label}</Text>
                </View>
              );
            }
            return (
              <TournamentCard
                item={item}
                onPress={() => handleTournamentPress(item)}
                colors={colors}
                expanded={item.isGroup ? String(item.ID) === expandedGroupId : undefined}
              />
            );
          }}
          keyExtractor={(item, index) => '__header' in item ? item.id : `tournament-${item.ID}-${index}`}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => fetchTournaments(selectedTab, selectedSeason, true)}
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
    paddingHorizontal: 18,
    paddingVertical: 8,
  },
  screenTitle: {
    fontSize: 19,
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
    paddingVertical: 9,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  segmentText: {
    fontSize: 11.5,
    fontFamily: 'PoppinsMedium',
    letterSpacing: 0.8,
  },
  segmentTextActive: {
    fontFamily: 'PoppinsBold',
  },
  seasonRow: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  pillRow: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingVertical: 7,
    gap: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  pill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    gap: 5,
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
  tourGroupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 4,
  },
  tourGroupDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  tourGroupLabel: {
    fontSize: 10,
    fontFamily: 'PoppinsBold',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
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
