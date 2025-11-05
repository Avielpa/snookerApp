// screens/CalendarEnhanced.tsx
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
  FlatList,
  ImageBackground,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';

// Import services
import { getCalendarByTab } from '../services/matchServices';
import { logger } from '../utils/logger';
import { useColors } from '../contexts/ThemeContext';
import { logDeviceCompatibility } from '../utils/deviceCompatibility';
import { getDeviceTabConfig } from '../config/deviceTabConfig';
import { DeviceAwareFilterScrollView } from '../components/DeviceAwareFilterScrollView';
import { DeviceAwareFilterButton } from '../components/DeviceAwareFilterButton';

// Removed all modern component imports to prevent crashes

// Enhanced interface with additional computed fields
interface Tournament {
  ID: number;
  Name: string;
  StartDate: string | null;
  EndDate: string | null;
  Venue?: string | null;
  City?: string | null;
  Country?: string | null;
  Type?: string | null;
  // Prize money fields (API might return either format)
  prizeMoney?: string;
  prize_money?: any;
  // Computed fields
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
  color: string;
  count?: number;
}

// Removed unused width variable

/**
 * Enhanced Calendar/Tournament Screen with modern UI and interactive features
 * Features:
 * - Live tournament indicators
 * - Interactive timeline view
 * - Smart filtering with haptic feedback
 * - Modern card design with glassmorphism
 * - Progress indicators for ongoing tournaments
 * - Real-time search functionality
 */
export default function CalendarEnhanced() {
  // State management
  const [allTournaments, setAllTournaments] = useState<Tournament[]>([]);
  const [filteredTournaments, setFilteredTournaments] = useState<Tournament[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTab, setSelectedTab] = useState<string>('main');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const router = useRouter();
  const colors = useColors();

  // Create styles with dynamic colors
  const styles = useMemo(() => createCalendarStyles(colors), [colors]);
  const deviceConfig = useMemo(() => getDeviceTabConfig(), []);
  const deviceStyles = useMemo(() => deviceConfig.createDynamicStyles(colors), [colors, deviceConfig]);

  // Enhanced tournament processing with computed fields
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

      return {
        ...tournament,
        status,
        daysRemaining,
        duration,
        progress,
        isLive,
      };
    });
  }, []);



  // Fetch tournaments by tab
  const fetchTournaments = useCallback(async (tabType: string = 'main', isRefresh = false) => {
    logger.log(`[CalendarEnhanced] Fetching ${tabType} tournaments...`);
    
    if (!isRefresh) setLoading(true);
    setRefreshing(isRefresh);
    setError(null);

    try {
      const response = await getCalendarByTab(tabType);
      if (!response) {
        throw new Error(`Failed to load ${tabType} tournaments`);
      }

      // Combine all tournament statuses into one array and normalize field names
      const allTournaments = [
        ...(response.active || []),
        ...(response.upcoming || []),
        ...(response.recent || [])
      ].map(tournament => ({
        ...tournament,
        ID: tournament.id,
        Name: tournament.name,
        StartDate: tournament.start_date,
        EndDate: tournament.end_date,
        Venue: tournament.venue,
        City: tournament.city,
        Country: tournament.country,
        prize_money: tournament.prize_money
      }));

      // Sort tournaments by start date descending
      const sortedData = allTournaments.sort((a, b) => {
        const dateA = a.StartDate ? new Date(a.StartDate).getTime() : 0;
        const dateB = b.StartDate ? new Date(b.StartDate).getTime() : 0;
        return dateB - dateA;
      });

      const enhancedData = enhanceTournamentData(sortedData);
      setAllTournaments(enhancedData);
      logger.log(`[CalendarEnhanced] Loaded ${enhancedData.length} ${tabType} tournaments`);
    } catch (err: any) {
      logger.error(`[CalendarEnhanced] Error fetching ${tabType} tournaments:`, err);
      
      // Enhanced error handling with network-specific messages
      let errorMessage = `Failed to load ${tabType} tournaments`;
      
      if (err.message.includes('Network Error') || err.message.includes('ERR_NETWORK')) {
        errorMessage = 'Network connection failed. Please check your internet connection and try again.';
      } else if (err.message.includes('timeout')) {
        errorMessage = 'Request timed out. Please check your connection and try again.';
      } else if (err.message.includes('Server')) {
        errorMessage = 'Server is temporarily unavailable. Please try again in a moment.';
      } else if (err.message) {
        errorMessage = err.message;
      }
      
      setError(errorMessage);
      setAllTournaments([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [enhanceTournamentData]);

  useEffect(() => {
    // Log device compatibility info for debugging tab issues
    logDeviceCompatibility();
    fetchTournaments(selectedTab);
  }, [selectedTab, fetchTournaments]);

  // Tab options for tour type separation
  const tabOptions: FilterOption[] = useMemo(() => [
    { id: 'main', label: 'Main Tours', icon: 'trophy-outline', color: colors.primary },
    { id: 'others', label: 'Others', icon: 'star-outline', color: colors.secondary },
  ], [colors]);

  // Status filter options
  const statusOptions: FilterOption[] = useMemo(() => {
    const live = allTournaments.filter(t => t.isLive).length;
    const upcoming = allTournaments.filter(t => t.status === 'upcoming').length;
    const past = allTournaments.filter(t => t.status === 'past').length;
    const all = allTournaments.length;

    return [
      { id: 'all', label: 'All', icon: 'apps-outline', color: colors.primary, count: all },
      { id: 'active', label: 'Live', icon: 'radio-outline', color: colors.success, count: live },
      { id: 'upcoming', label: 'Upcoming', icon: 'calendar-outline', color: colors.primary, count: upcoming },
      { id: 'past', label: 'Past', icon: 'checkmark-done-outline', color: colors.textSecondary, count: past },
    ];
  }, [allTournaments, colors]);

  // Apply status and search filters (tab filtering is done server-side)
  useEffect(() => {
    let filtered = [...allTournaments];

    // Apply status filter
    if (selectedStatus !== 'all') {
      if (selectedStatus === 'active') {
        filtered = filtered.filter(t => t.isLive);
      } else {
        filtered = filtered.filter(t => t.status === selectedStatus);
      }
    }

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      filtered = filtered.filter(t =>
        t.Name?.toLowerCase().includes(query) ||
        t.Venue?.toLowerCase().includes(query) ||
        t.City?.toLowerCase().includes(query) ||
        t.Country?.toLowerCase().includes(query)
      );
    }

    // Sort: active tournaments first, then upcoming by date, then past
    filtered.sort((a, b) => {
      // Priority order: active > upcoming > past
      const statusPriority = { active: 0, upcoming: 1, past: 2 };
      const aPriority = statusPriority[a.status || 'past'];
      const bPriority = statusPriority[b.status || 'past'];
      
      if (aPriority !== bPriority) {
        return aPriority - bPriority;
      }
      
      // Within same status, sort by date
      const aDate = a.StartDate ? new Date(a.StartDate).getTime() : 0;
      const bDate = b.StartDate ? new Date(b.StartDate).getTime() : 0;
      
      if (a.status === 'upcoming') {
        return aDate - bDate; // Upcoming: earliest first
      } else {
        return bDate - aDate; // Active/Past: latest first
      }
    });

    setFilteredTournaments(filtered);
  }, [allTournaments, selectedStatus, searchQuery]);

  // Handle tab selection with enhanced logging
  const handleTabPress = (tabId: string) => {
    logger.log(`[CalendarEnhanced] Tab pressed: ${tabId}, current: ${selectedTab}`);
    if (tabId !== selectedTab) {
      logger.log(`[CalendarEnhanced] Changing tab from ${selectedTab} to ${tabId}`);
      setSelectedTab(tabId);
      setError(null); // Clear any previous errors
    } else {
      logger.log(`[CalendarEnhanced] Tab already selected: ${tabId}`);
    }
  };

  // Handle status filter selection with enhanced logging
  const handleStatusPress = (statusId: string) => {
    logger.log(`[CalendarEnhanced] Status pressed: ${statusId}, current: ${selectedStatus}`);
    if (statusId !== selectedStatus) {
      logger.log(`[CalendarEnhanced] Changing status from ${selectedStatus} to ${statusId}`);
      setSelectedStatus(statusId);
    } else {
      logger.log(`[CalendarEnhanced] Status already selected: ${statusId}`);
    }
  };

  // Handle tournament press
  const handleTournamentPress = (tournament: Tournament) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push(`/tour/${tournament.ID}`);
  };

  // Use device-aware filter button component for consistency
  const renderTabButton = (option: FilterOption) => {
    const isSelected = selectedTab === option.id;
    
    return (
      <DeviceAwareFilterButton
        key={option.id}
        option={option}
        isSelected={isSelected}
        onPress={handleTabPress}
        colors={colors}
      />
    );
  };

  // Render tournament card
  const renderTournamentCard = ({ item }: { item: Tournament }): React.JSX.Element => {
    const formatDate = (dateString: string | null): string => {
      if (!dateString) return 'TBD';
      try {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-GB', { 
          day: 'numeric', 
          month: 'short', 
          year: 'numeric' 
        });
      } catch {
        return 'Invalid Date';
      }
    };

    const getStatusIcon = () => {
      switch (item.status) {
        case 'active': return '●'; // Bullet point
        case 'upcoming': return '○'; // Hollow bullet
        case 'past': return '✓'; // Checkmark
        default: return '★'; // Star
      }
    };

    const getStatusColor = () => {
      switch (item.status) {
        case 'active': return colors.warning;
        case 'upcoming': return colors.primary;
        case 'past': return colors.textSecondary;
        default: return colors.primary;
      }
    };

    return (
      <TouchableOpacity
        onPress={() => handleTournamentPress(item)}
        activeOpacity={0.8}
        style={styles.tournamentCard}
        hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
        delayPressIn={0}
      >
        <LinearGradient
          colors={colors.cardBackground === 'rgba(255, 255, 255, 0.95)'
            ? ['rgba(255, 255, 255, 0.98)', 'rgba(248, 250, 252, 0.95)'] // Light mode
            : ['rgba(30, 41, 59, 0.9)', 'rgba(15, 23, 42, 0.8)']} // Dark mode
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.cardContent}
        >

          {/* Tournament Header */}
          <View style={styles.tournamentHeader}>
            <View style={styles.tournamentTitle}>
              <Text style={styles.statusIcon}>{getStatusIcon()}</Text>
              <Text style={styles.tournamentName} numberOfLines={2}>
                {item.Name || 'Tournament'}
              </Text>
              {/* Simple Live Indicator */}
              {item.isLive && (
                <View style={styles.liveIndicatorInline}>
                  <Text style={{ color: '#4CAF50', fontSize: 10, fontFamily: 'PoppinsBold' }}>● LIVE</Text>
                </View>
              )}
            </View>
            
            {/* Prize Money - Safe rendering */}
            {(() => {
              const prizeData = item.prizeMoney || item.prize_money;
              if (!prizeData) return null;
              
              let displayText = 'Prize Money';
              if (typeof prizeData === 'string' && prizeData.trim()) {
                displayText = prizeData;
              } else if (typeof prizeData === 'object' && prizeData !== null) {
                if (prizeData.winner && prizeData.winner.formatted) {
                  displayText = prizeData.winner.formatted;
                } else if (prizeData.winner && prizeData.winner.amount) {
                  const currency = prizeData.winner.currency || 'GBP';
                  const amount = prizeData.winner.amount;
                  displayText = `${currency} ${amount.toLocaleString()}`;
                } else {
                  displayText = 'Prize Money';
                }
              }
              
              return (
                <View style={styles.prizeContainer}>
                  <Text style={styles.prizeMoney}>
                    {displayText}
                  </Text>
                </View>
              );
            })()}
          </View>

          {/* Tournament Dates */}
          <View style={styles.datesContainer}>
            <View style={styles.dateItem}>
              <Ionicons name="calendar-outline" size={14} color="#9CA3AF" />
              <Text style={styles.dateText}>
                {formatDate(item.StartDate)} - {formatDate(item.EndDate)}
              </Text>
            </View>
            
            {(item.daysRemaining && item.daysRemaining > 0) ? (
              <Text style={styles.daysRemaining}>
                {`in ${item.daysRemaining} ${item.daysRemaining === 1 ? 'day' : 'days'}`}
              </Text>
            ) : null}
          </View>

          {/* Venue Information */}
          {(item.Venue || item.City) ? (
            <View style={styles.venueContainer}>
              <Ionicons name="location-outline" size={14} color="#9CA3AF" />
              <Text style={styles.venueText} numberOfLines={1}>
                {(() => {
                  const venue = typeof item.Venue === 'string' ? item.Venue : '';
                  const city = typeof item.City === 'string' ? item.City : '';
                  const country = typeof item.Country === 'string' ? item.Country : '';
                  return `${venue}${city ? `, ${city}` : ''}${country ? ` (${country})` : ''}`.trim() || 'Venue TBD';
                })()}
              </Text>
            </View>
          ) : null}

          {/* Progress Bar for Active Tournaments - Simplified to prevent crashes */}
          {(item.status === 'active' && item.progress !== undefined) ? (
            <View style={styles.progressContainer}>
              <View style={[styles.simpleProgressTrack]}>
                <View style={[
                  styles.simpleProgressFill, 
                  { 
                    width: `${Math.round(item.progress * 100)}%`,
                    backgroundColor: getStatusColor()
                  }
                ]} />
              </View>
              <Text style={styles.progressText}>
                Tournament Progress: {Math.round(item.progress * 100)}%
              </Text>
            </View>
          ) : null}

          {/* Tournament Stats */}
          <View style={styles.statsContainer}>
            <View style={styles.statItem}>
              <Ionicons name="time-outline" size={16} color="#9CA3AF" />
              <Text style={styles.statText}>
                {(() => {
                  const duration = typeof item.duration === 'number' ? item.duration : 0;
                  return `${duration} ${duration === 1 ? 'day' : 'days'}`;
                })()}
              </Text>
            </View>
            
            <View style={styles.statItem}>
              <Ionicons name="trophy-outline" size={16} color="#FFA726" />
              <Text style={styles.statText}>{item.Type || 'Tournament'}</Text>
            </View>
          </View>
        </LinearGradient>
      </TouchableOpacity>
    );
  };

  // Loading state
  if (loading && !refreshing) {
    return (
      <SafeAreaView style={styles.container}>
        <Text style={styles.title}>Tournament Calendar</Text>
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading Tournaments...</Text>
        </View>
      </SafeAreaView>
    );
  }

  // Error state
  if (error && !refreshing) {
    return (
      <SafeAreaView style={styles.container}>
        <Text style={styles.title}>Tournament Calendar</Text>
        <View style={styles.centerContent}>
          <Ionicons name="alert-circle-outline" size={48} color="#F87171" />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={() => fetchTournaments()}>
            <Text style={styles.retryText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <ImageBackground
      source={require('../assets/snooker_background.jpg')}
      style={styles.backgroundImage}
      resizeMode="cover"
    >
      {/* Semi-transparent overlay for readability */}
      <View style={styles.overlay} />
      <SafeAreaView style={styles.container}>
      {/* Header */}
      <Text style={styles.title}>Tournament Calendar</Text>
      
      {/* Search and Filters Container */}
      <View style={styles.headerContainer}>
        {/* Simple search input to avoid crashes */}
        <View style={styles.searchContainer}>
          <TextInput
            style={styles.searchInput}
            placeholder="Search tournaments, venues..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholderTextColor={colors.textSecondary}
          />
        </View>

        {/* Tab Buttons - Device Aware */}
        <DeviceAwareFilterScrollView
          options={tabOptions.map(option => ({
            id: option.id,
            label: option.label,
            icon: option.icon
          }))}
          selectedValue={selectedTab}
          onSelectionChange={(value) => {
            console.log(`[CalendarFilter] Device-Aware Tab: ${value}`);
            handleTabPress(value);
          }}
          colors={colors}
        />

        {/* Status Filter Buttons - Device Aware */}
        <DeviceAwareFilterScrollView
          options={statusOptions.map(option => ({
            id: option.id,
            label: option.label,
            icon: option.icon,
            count: option.count
          }))}
          selectedValue={selectedStatus}
          onSelectionChange={(value) => {
            console.log(`[CalendarStatusFilter] Device-Aware: ${value}`);
            handleStatusPress(value);
          }}
          colors={colors}
          containerStyle={{ marginTop: 4 }}
        />

        {/* Results Count */}
        <Text style={styles.resultsText}>
          {`${filteredTournaments.length} ${filteredTournaments.length === 1 ? 'tournament' : 'tournaments'}`}
        </Text>
      </View>

      {/* Tournaments List */}
      <View style={styles.listContainer}>
        {filteredTournaments.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="calendar-outline" size={48} color="#9CA3AF" />
            <Text style={styles.emptyText}>
              {searchQuery ? 'No tournaments match your search.' : 'No tournaments available.'}
            </Text>
          </View>
        ) : (
          <FlatList
            data={filteredTournaments}
            renderItem={renderTournamentCard}
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
      </View>
    </SafeAreaView>
    </ImageBackground>
  );
}

// Dynamic styles function
const createCalendarStyles = (colors: any) => StyleSheet.create({
  backgroundImage: {
    flex: 1,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.cardBackground === 'rgba(255, 255, 255, 0.95)'
      ? 'rgba(255, 255, 255, 0.75)' // Light semi-transparent overlay
      : 'rgba(0, 0, 0, 0.6)', // Dark semi-transparent overlay
  },
  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  title: {
    fontSize: 24,
    fontFamily: 'PoppinsBold',
    textAlign: 'center',
    marginVertical: 12,
    color: colors.textHeader,
  },
  headerContainer: {
    paddingHorizontal: 14,
    marginBottom: 6,
  },
  searchContainer: {
    marginBottom: 10,
  },
  searchInput: {
    height: 40,
    backgroundColor: colors.cardBackground,
    borderRadius: 20,
    paddingHorizontal: 14,
    fontSize: 15,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.border,
  },
  filtersScrollView: {
    marginVertical: 6,
  },
  filtersContainer: {
    paddingRight: 14,
  },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.cardBackground,
    paddingVertical: 5,
    paddingHorizontal: 9,
    borderRadius: 14,
    marginRight: 5,
    borderWidth: 1,
    borderColor: 'rgba(255, 167, 38, 0.25)',
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
  },
  filterButtonActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
    elevation: 2,
    shadowOpacity: 0.12,
  },
  filterText: {
    color: colors.textSecondary,
    fontSize: 11,
    fontFamily: 'PoppinsMedium',
    marginLeft: 3,
    letterSpacing: 0.1,
  },
  filterTextActive: {
    color: '#FFFFFF',
    fontFamily: 'PoppinsBold',
  },
  countBadge: {
    marginLeft: 6,
    paddingHorizontal: 7,
    paddingVertical: 1,
    borderRadius: 10,
  },
  countText: {
    fontSize: 11,
    fontFamily: 'PoppinsBold',
  },
  resultsText: {
    fontSize: 11,
    fontFamily: 'PoppinsRegular',
    color: colors.textSecondary,
    marginTop: 6,
    textAlign: 'center',
  },
  listContainer: {
    flex: 1,
  },
  listContent: {
    paddingBottom: 16,
  },
  tournamentCard: {
    marginVertical: 6,
    marginHorizontal: 14,
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
  },
  cardContent: {
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: 12,
    padding: 14,
    position: 'relative',
  },
  tournamentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  tournamentTitle: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    flex: 1,
    marginRight: 12,
  },
  statusIcon: {
    fontSize: 20,
    marginRight: 10,
  },
  tournamentName: {
    fontSize: 16,
    fontFamily: 'PoppinsBold',
    color: colors.textPrimary,
    flex: 1,
    lineHeight: 22,
  },
  prizeContainer: {
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  prizeMoney: {
    fontSize: 11,
    fontFamily: 'PoppinsBold',
    color: '#FFD700',
    textAlign: 'right',
  },
  runnerUpPrize: {
    fontSize: 10,
    fontFamily: 'PoppinsMedium',
    color: colors.textSecondary,
    textAlign: 'right',
    marginTop: 2,
  },
  liveIndicatorInline: {
    marginLeft: 8,
    alignSelf: 'flex-start',
  },
  datesContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  dateItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dateText: {
    fontSize: 13,
    fontFamily: 'PoppinsRegular',
    color: colors.textSecondary,
    marginLeft: 5,
  },
  daysRemaining: {
    fontSize: 11,
    fontFamily: 'PoppinsBold',
    color: '#2196F3',
    backgroundColor: 'rgba(33, 150, 243, 0.15)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 3,
  },
  venueContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  venueText: {
    fontSize: 12,
    fontFamily: 'PoppinsRegular',
    color: '#999',
    marginLeft: 5,
    flex: 1,
  },
  progressContainer: {
    marginBottom: 10,
  },
  simpleProgressTrack: {
    width: '100%',
    height: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 2,
    overflow: 'hidden',
    marginBottom: 3,
  },
  simpleProgressFill: {
    height: '100%',
    borderRadius: 2,
  },
  progressText: {
    fontSize: 10,
    fontFamily: 'PoppinsRegular',
    color: colors.textSecondary,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statText: {
    fontSize: 11,
    fontFamily: 'PoppinsRegular',
    color: colors.textSecondary,
    marginLeft: 5,
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 15,
    fontFamily: 'PoppinsRegular',
    color: '#9CA3AF',
  },
  errorText: {
    marginTop: 10,
    fontSize: 15,
    fontFamily: 'PoppinsRegular',
    color: '#F87171',
    textAlign: 'center',
  },
  retryButton: {
    marginTop: 14,
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: '#FFA726',
    borderRadius: 8,
  },
  retryText: {
    fontSize: 13,
    fontFamily: 'PoppinsSemiBold',
    color: '#FFFFFF',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 50,
  },
  emptyText: {
    marginTop: 10,
    fontSize: 15,
    fontFamily: 'PoppinsRegular',
    color: '#9CA3AF',
    textAlign: 'center',
  },
});