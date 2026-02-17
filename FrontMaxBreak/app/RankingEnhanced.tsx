// screens/RankingEnhanced.tsx
import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  RefreshControl,
  FlatList,
  ImageBackground,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';

// Import services
import { getRanking, RANKING_TYPES } from '../services/matchServices';
import { api } from '../services/api';
import { useRouter } from 'expo-router';
import { logger } from '../utils/logger';
import { useColors } from '../contexts/ThemeContext';
import { getDeviceTabConfig } from '../config/deviceTabConfig';
import { DeviceAwareFilterScrollView } from '../components/DeviceAwareFilterScrollView';
import { DeviceAwareFilterButton } from '../components/DeviceAwareFilterButton';

// Import modern components - simplified to avoid crashes
// Removed ProgressBar to prevent crashes - using simple native views instead

// Enhanced interface with additional fields
interface RankingItem {
  ID: number;
  Position: number;
  Player: number | null;
  Season: number;
  Sum: number;
  Type: string;
  player_name?: string;
  // Additional computed fields
  positionChange?: number; // +1, -2, etc.
  isRising?: boolean;
  country?: string;
  flag?: string;
}

interface FilterOption {
  id: string;
  label: string;
  value: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
}

/**
 * Enhanced Ranking Screen with modern UI, filters, search, and interactive features
 * Features:
 * - Real-time search
 * - Multiple ranking types (Money, Women's, Seniors)
 * - Interactive filters with haptic feedback
 * - Smooth animations and modern design
 * - Performance optimized with FlashList
 */
export default function RankingEnhanced() {
  // State management
  const [rankingData, setRankingData] = useState<RankingItem[]>([]);
  const [filteredData, setFilteredData] = useState<RankingItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedFilter, setSelectedFilter] = useState<string>('MoneyRankings');
  // Cache to prevent unnecessary reloads
  const [rankingCache, setRankingCache] = useState<Record<string, RankingItem[]>>({});

  const router = useRouter();
  const colors = useColors();

  // Tab options for ranking types - using all 5 available ranking types in database
  const filterOptions: FilterOption[] = useMemo(() => [
    {
      id: 'MoneyRankings',
      label: 'Money Rankings',
      value: 'MoneyRankings',
      icon: 'trophy-outline',
      color: colors.primary,
    },
    {
      id: 'MoneySeedings',
      label: 'Money Seedings',
      value: 'MoneySeedings',
      icon: 'medal-outline',
      color: '#FF9800',
    },
    {
      id: 'OneYearMoneyRankings',
      label: 'One Year Money',
      value: 'OneYearMoneyRankings',
      icon: 'calendar-outline',
      color: '#9C27B0',
    },
    {
      id: 'QTRankings',
      label: 'Q-School',
      value: 'QTRankings',
      icon: 'school-outline',
      color: '#607D8B',
    },
    {
      id: 'WomensRankings',
      label: 'Womens',
      value: 'WomensRankings',
      icon: 'ribbon-outline',
      color: '#E91E63',
    },
    {
      id: 'AmateurRankings',
      label: 'Amateur',
      value: 'AmateurRankings',
      icon: 'people-outline',
      color: '#795548',
    },
  ], [colors]);

  // Load ranking data with caching to prevent unnecessary reloads
  const loadRankingData = useCallback(async (rankingType: string, isRefresh = false) => {
    logger.log(`[RankingEnhanced] === LOADING ${rankingType} RANKINGS ===`);
    logger.log(`[RankingEnhanced] isRefresh: ${isRefresh}, cached: ${!!rankingCache[rankingType]}`);
    logger.log(`[RankingEnhanced] Loading ${rankingType} rankings...`);
    
    // Check cache first (unless refreshing)
    if (!isRefresh && rankingCache[rankingType]) {
      logger.log(`[RankingEnhanced] USING CACHE for ${rankingType}: ${rankingCache[rankingType].length} items`);
      logger.log(`[RankingEnhanced] Using cached data for ${rankingType}: ${rankingCache[rankingType].length} items`);
      setRankingData(rankingCache[rankingType]);
      setLoading(false);
      setError(null); // Clear any previous errors when using cache
      return;
    }
    
    logger.log(`[RankingEnhanced] MAKING API CALL for ${rankingType}...`);
    if (!isRefresh) setLoading(true);
    setRefreshing(isRefresh);
    setError(null);

    try {
      logger.log(`[RankingEnhanced] Calling getRanking(${rankingType})...`);
      const response = await getRanking(rankingType);
      logger.log(`[RankingEnhanced] getRanking response:`, {
        hasResponse: !!response,
        hasRankings: !!response?.rankings,
        rankingsLength: response?.rankings?.length || 0,
        tabName: response?.tab_name,
        responseKeys: response ? Object.keys(response) : 'NO RESPONSE',
        firstRanking: response?.rankings?.[0] || 'NO FIRST RANKING'
      });
      
      logger.log(`[RankingEnhanced] API response for ${rankingType}:`, {
        hasRankings: !!response.rankings,
        rankingsLength: response.rankings?.length || 0,
        tabName: response.tab_name,
        hasData: !!response
      });
      
      const rankings: RankingItem[] = (response.rankings || []).map((item: any) => ({
        ...item,
        Position: typeof item.Position === 'number' && item.Position !== null ? item.Position : 0,
      }));
      
      logger.log(`[RankingEnhanced] Processed ${rankings.length} rankings`);
      if (rankings.length > 0) {
        logger.log(`[RankingEnhanced] First ranking:`, rankings[0]);
      }
      
      // Cache the data
      setRankingCache(prev => ({
        ...prev,
        [rankingType]: rankings
      }));
      
      setRankingData(rankings);
      logger.log(`[RankingEnhanced] SUCCESS: Set ranking data with ${rankings.length} items`);
      logger.log(`[RankingEnhanced] Successfully loaded ${rankings.length} ${rankingType} rankings`);
      
      // Clear any previous errors on successful load
      if (rankings.length > 0) {
        setError(null);
      } else {
        logger.log(`[RankingEnhanced] WARNING: No rankings returned for ${rankingType}`);
        logger.warn(`[RankingEnhanced] No rankings returned for ${rankingType}`);
        setError(`No ${rankingType} rankings available. Data may need to be updated by running management commands.`);
      }
    } catch (error: any) {
      logger.error(`[RankingEnhanced] ERROR loading ${rankingType}:`, {
        errorMessage: error.message,
        errorStatus: error.response?.status,
        errorData: error.response?.data,
        fullError: error
      });
      logger.error(`[RankingEnhanced] Error loading ${rankingType} rankings:`, error);
      const errorMessage = error.message || `Failed to load ${rankingType} rankings`;
      setError(`${errorMessage}. Please check if ranking data has been populated in the database.`);
      setRankingData([]);
    } finally {
      logger.log(`[RankingEnhanced] FINALLY: Setting loading=false, refreshing=false`);
      setLoading(false);
      setRefreshing(false);
    }
  }, [rankingCache]);


  // Filter and search logic
  const handleSearch = useCallback((query: string) => {
    setSearchQuery(query);
  }, []);

  // Apply filters and search
  useEffect(() => {
    logger.log(`[RankingEnhanced] === FILTERING DATA ===`);
    logger.log(`[RankingEnhanced] rankingData length: ${rankingData.length}`);
    logger.log(`[RankingEnhanced] searchQuery: "${searchQuery}"`);
    
    let filtered = [...rankingData];

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      filtered = filtered.filter(item =>
        item.player_name?.toLowerCase().includes(query) ||
        (item.country && item.country.toLowerCase().includes(query)) ||
        item.Position.toString().includes(query)
      );
      logger.log(`[RankingEnhanced] After search filter: ${filtered.length} items`);
    }

    logger.log(`[RankingEnhanced] Final filtered data: ${filtered.length} items`);
    setFilteredData(filtered);
  }, [rankingData, searchQuery]);

  // Direct API test function - bypass all complex logic
  const testDirectAPI = async () => {
    logger.log('[RankingEnhanced] === TESTING DIRECT API ===');
    try {
      // Test direct API call to ranking-types/MoneyRankings/
      const response = await api.get('ranking-types/MoneyRankings/');
      logger.log('[RankingEnhanced] Direct API SUCCESS:', {
        status: response.status,
        hasData: !!response.data,
        dataKeys: response.data ? Object.keys(response.data) : 'NO DATA',
        hasRankings: !!response.data?.rankings,
        rankingsLength: response.data?.rankings?.length || 0
      });

      if (response.data?.rankings && response.data.rankings.length > 0) {
        logger.log('[RankingEnhanced] DIRECT API WORKS - Setting data directly');
        setRankingData(response.data.rankings);
        setError(null);
        setLoading(false);
      }
    } catch (error: any) {
      logger.error('[RankingEnhanced] Direct API ERROR:', {
        message: error.message,
        status: error.response?.status,
        data: error.response?.data
      });
    }
  };

  // Initial data load on component mount
  useEffect(() => {
    logger.log('[RankingEnhanced] Component mounted, loading default data...');
    logger.log('[RankingEnhanced] API Base URL:', process.env.EXPO_PUBLIC_API_BASE_URL);
    logger.log('[RankingEnhanced] Environment:', process.env.NODE_ENV);
    
    // Try direct API first as fallback
    testDirectAPI();
    
    // Also try normal flow
    loadRankingData('MoneyRankings'); // Load default data immediately
  }, []); // Only run once on mount

  // Load data when filter changes
  useEffect(() => {
    const selectedOption = filterOptions.find(option => option.id === selectedFilter);
    if (selectedOption) {
      loadRankingData(selectedOption.value);
    }
  }, [selectedFilter, filterOptions]); // CRASH FIX: Remove loadRankingData dependency to prevent infinite loop

  // Handle filter selection with enhanced Galaxy S24 debugging
  const handleFilterPress = (filterId: string) => {
    logger.log(`[RankingEnhanced] === TAB PRESSED: ${filterId} ===`);
    logger.log(`[RankingEnhanced] Current filter: ${selectedFilter}`);
    logger.log(`[RankingEnhanced] TouchableOpacity successfully triggered`);
    logger.log(`[RankingEnhanced] Filter pressed: ${filterId}, current: ${selectedFilter}`);
    logger.log(`[RankingEnhanced] Galaxy S24 Debug - Event received for filter: ${filterId}`);
    
    if (filterId !== selectedFilter) {
      logger.log(`[RankingEnhanced] CHANGING FILTER from ${selectedFilter} to ${filterId}`);
      logger.log(`[RankingEnhanced] SUCCESS: Changing filter from ${selectedFilter} to ${filterId}`);
      setSelectedFilter(filterId);
      setError(null); // Clear any previous errors
    } else {
      logger.log(`[RankingEnhanced] Filter already selected: ${filterId}`);
      logger.log(`[RankingEnhanced] INFO: Filter already selected: ${filterId}`);
    }
  };

  // Handle refresh
  const handleRefresh = () => {
    const selectedOption = filterOptions.find(option => option.id === selectedFilter);
    if (selectedOption) {
      loadRankingData(selectedOption.value, true);
    }
  };

  // Navigation to player details
  const handlePlayerPress = (player: RankingItem) => {
    if (player.Player && typeof player.Player === 'number' && player.Player > 0 && player.Player !== 376) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      router.push(`/player/${player.Player}`);
    }
  };

  // Use device-aware filter button component for consistency
  const renderFilterButton = (option: FilterOption) => {
    const isSelected = selectedFilter === option.id;
    
    return (
      <DeviceAwareFilterButton
        key={option.id}
        option={{
          id: option.id,
          label: option.label,
          icon: option.icon
        }}
        isSelected={isSelected}
        onPress={handleFilterPress}
        colors={colors}
      />
    );
  };

  // Render ranking item
  const renderRankingItem = ({ item }: { item: RankingItem }): React.JSX.Element => {
    const playerName = item.player_name || `Player ${item.Player}` || 'Unknown Player';
    const positionChange = item.positionChange;
    const isRising = positionChange && positionChange > 0;
    const isFalling = positionChange && positionChange < 0;

    // Dynamic card colors based on theme
    const cardGradient = colors.cardBackground === 'rgba(255, 255, 255, 0.95)'
      ? ['rgba(255, 255, 255, 0.98)', 'rgba(248, 249, 250, 0.95)'] as const // Light mode
      : ['rgba(0, 0, 0, 0.8)', 'rgba(0, 0, 0, 0.6)'] as const; // Dark mode

    return (
      <TouchableOpacity
        onPress={() => handlePlayerPress(item)}
        activeOpacity={0.6}
        hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
        delayPressIn={0}
        delayPressOut={0}
        pressRetentionOffset={{ top: 20, bottom: 20, left: 20, right: 20 }}
        disabled={!item.Player}
      >
        <LinearGradient
          colors={cardGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.rankingCard}
        >
          <View style={styles.rankingContent}>
            {/* Position and Change Indicator */}
            <View style={styles.positionContainer}>
              <Text style={styles.position}>{item.Position}</Text>
              {positionChange !== undefined && positionChange !== 0 && (
                <View style={[styles.changeIndicator,
                  { backgroundColor: isRising ? colors.success : isFalling ? colors.error : colors.textSecondary }
                ]}>
                  <Ionicons
                    name={isRising ? 'arrow-up' : isFalling ? 'arrow-down' : 'remove'}
                    size={8}
                    color={colors.textPrimary}
                  />
                  <Text style={styles.changeText}>
                    {Math.abs(positionChange || 0)}
                  </Text>
                </View>
              )}
            </View>

            {/* Player Info */}
            <View style={styles.playerInfo}>
              <View style={styles.playerHeader}>
                <Text style={styles.playerName} numberOfLines={1}>
                  {playerName}
                </Text>
                {item.country && <Text style={styles.country}>{item.country}</Text>}
              </View>
              
              {/* Prize Money with Progress Bar */}
              <Text style={styles.prize}>£{item.Sum?.toLocaleString() || 'N/A'}</Text>
              
              {/* Mini progress bar showing relative performance */}
              <View style={styles.miniProgressTrack}>
                <View style={[
                  styles.miniProgressFill,
                  {
                    width: `${Math.min(Math.round((item.Sum / 1000000) * 100), 100)}%`,
                    backgroundColor: colors.primary
                  }
                ]} />
              </View>
            </View>

            {/* Action Arrow */}
            <Ionicons 
              name="chevron-forward" 
              size={20} 
              color={colors.textSecondary} 
              style={styles.actionArrow}
            />
          </View>
        </LinearGradient>
      </TouchableOpacity>
    );
  };

  // Create styles with dynamic colors
  const styles = useMemo(() => createRankingStyles(colors), [colors]);
  const deviceConfig = useMemo(() => getDeviceTabConfig(), []);
  const deviceStyles = useMemo(() => deviceConfig.createDynamicStyles(colors), [colors, deviceConfig]);

  // Debug current state before rendering
  logger.log(`[RankingEnhanced] === RENDER STATE CHECK ===`);
  logger.log(`[RankingEnhanced] loading: ${loading}, refreshing: ${refreshing}`);
  logger.log(`[RankingEnhanced] error: ${error}`);
  logger.log(`[RankingEnhanced] rankingData length: ${rankingData.length}`);
  logger.log(`[RankingEnhanced] filteredData length: ${filteredData.length}`);
  logger.log(`[RankingEnhanced] selectedFilter: ${selectedFilter}`);

  // Loading state
  if (loading && !refreshing) {
    logger.log(`[RankingEnhanced] SHOWING LOADING STATE`);
    return (
      <SafeAreaView style={styles.container}>
        <Text style={styles.title}>Player Rankings</Text>
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading Rankings...</Text>
        </View>
      </SafeAreaView>
    );
  }

  // Error state
  if (error && !refreshing) {
    logger.log(`[RankingEnhanced] SHOWING ERROR STATE: ${error}`);
    return (
      <SafeAreaView style={styles.container}>
        <Text style={styles.title}>Player Rankings</Text>
        <View style={styles.centerContent}>
          <Ionicons name="alert-circle-outline" size={48} color={colors.error} />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity 
            style={styles.retryButton} 
            onPress={handleRefresh}
            activeOpacity={0.6}
            hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
            delayPressIn={0}
            delayPressOut={0}
            pressRetentionOffset={{ top: 20, bottom: 20, left: 20, right: 20 }}
          >
            <Text style={styles.retryText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  logger.log(`[RankingEnhanced] SHOWING MAIN UI - filteredData: ${filteredData.length} items`);

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
      <Text style={styles.title}>Player Rankings</Text>
      
      {/* Search and Filters Container */}
      <View style={styles.headerContainer}>
        {/* Simple search input to avoid crashes */}
        <View style={styles.searchContainer}>
          <TextInput
            style={styles.searchInput}
            placeholder="Search players, countries..."
            value={searchQuery}
            onChangeText={handleSearch}
            placeholderTextColor={colors.textSecondary}
          />
        </View>

        {/* Filter Buttons - Device Aware */}
        <DeviceAwareFilterScrollView
          options={filterOptions.map(option => ({
            id: option.id,
            label: option.label,
            icon: option.icon
          }))}
          selectedValue={selectedFilter}
          onSelectionChange={(value) => {
            logger.log(`[RankingFilter] Device-Aware: ${value}`);
            handleFilterPress(value);
          }}
          colors={colors}
          containerStyle={{ marginVertical: 8 }}
        />

        {/* Results Count */}
        <Text style={styles.resultsText}>
          {`${filteredData.length} ${filteredData.length === 1 ? 'player' : 'players'}`}
        </Text>
      </View>

      {/* Rankings List */}
      <View style={styles.listContainer}>
        {filteredData.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="search-outline" size={48} color={colors.textSecondary} />
            <Text style={styles.emptyText}>
              {searchQuery 
                ? 'No players match your search.' 
                : selectedFilter === 'qt_rankings' || selectedFilter === 'womens'
                  ? 'No rankings available for this type in the current season.' 
                  : 'No rankings available.'}
            </Text>
          </View>
        ) : (
          <FlatList
            data={filteredData}
            renderItem={renderRankingItem}
            keyExtractor={(item, index) => `ranking-${item.ID}-${item.Position}-${index}`}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={handleRefresh}
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
const createRankingStyles = (colors: any) => StyleSheet.create({
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
    fontSize: 20,
    fontFamily: 'PoppinsBold',
    textAlign: 'center',
    marginVertical: 10,
    color: colors.textHeader,
  },
  headerContainer: {
    paddingHorizontal: 12,
    marginBottom: 5,
  },
  searchContainer: {
    marginBottom: 8,
  },
  searchInput: {
    height: 36,
    backgroundColor: colors.cardBackground,
    borderRadius: 18,
    paddingHorizontal: 12,
    fontSize: 13,
    color: colors.textPrimary,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  filtersScrollView: {
    marginVertical: 8,
  },
  filtersContainer: {
    paddingRight: 16,
  },
  filterButton: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    backgroundColor: colors.cardBackground, 
    paddingVertical: 6, 
    paddingHorizontal: 10, 
    borderRadius: 16, 
    marginRight: 6,
    borderWidth: 1,
    borderColor: 'rgba(255, 167, 38, 0.25)',
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  filterButtonActive: { 
    backgroundColor: colors.primary,
    borderColor: colors.primary,
    elevation: 2,
    shadowOpacity: 0.15,
  },
  filterText: { 
    color: colors.textSecondary, 
    fontSize: 12, 
    fontFamily: 'PoppinsMedium', 
    marginLeft: 4,
    letterSpacing: 0.1,
  },
  filterTextActive: { 
    color: '#FFFFFF', 
    fontFamily: 'PoppinsBold',
  },
  resultsText: {
    fontSize: 12,
    fontFamily: 'PoppinsRegular',
    color: colors.textSecondary,
    marginTop: 8,
    textAlign: 'center',
  },
  listContainer: {
    flex: 1,
  },
  listContent: {
    paddingBottom: 20,
  },
  rankingCard: {
    marginVertical: 2,
    marginHorizontal: 10,
    borderRadius: 6,
    padding: 8,
    borderWidth: 0.5,
    borderColor: colors.cardBorder,
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1,
  },
  rankingContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  positionContainer: {
    alignItems: 'center',
    minWidth: 38,
  },
  position: {
    fontSize: 13,
    fontFamily: 'PoppinsBold',
    color: colors.primary,
  },
  changeIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 3,
    paddingVertical: 1,
    borderRadius: 4,
    marginTop: 2,
  },
  changeText: {
    fontSize: 7,
    fontFamily: 'PoppinsBold',
    color: colors.textPrimary,
    marginLeft: 1,
  },
  playerInfo: {
    flex: 1,
    marginLeft: 10,
  },
  playerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  playerName: {
    fontSize: 12,
    fontFamily: 'PoppinsSemiBold',
    color: colors.textPrimary,
    flex: 1,
  },
  country: {
    fontSize: 9,
    fontFamily: 'PoppinsRegular',
    color: colors.textSecondary,
  },
  prize: {
    fontSize: 10,
    fontFamily: 'PoppinsBold',
    color: colors.success,
    marginBottom: 3,
  },
  miniProgressTrack: {
    width: '100%',
    height: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 1,
    overflow: 'hidden',
  },
  miniProgressFill: {
    height: '100%',
    borderRadius: 1,
  },
  actionArrow: {
    marginLeft: 8,
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    fontFamily: 'PoppinsRegular',
    color: colors.textSecondary,
  },
  errorText: {
    marginTop: 12,
    fontSize: 16,
    fontFamily: 'PoppinsRegular',
    color: colors.error,
    textAlign: 'center',
  },
  retryButton: {
    marginTop: 16,
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: colors.primary,
    borderRadius: 8,
  },
  retryText: {
    fontSize: 14,
    fontFamily: 'PoppinsSemiBold',
    color: colors.textPrimary,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    marginTop: 12,
    fontSize: 16,
    fontFamily: 'PoppinsRegular',
    color: colors.textSecondary,
    textAlign: 'center',
  },
});