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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';

// Import services
import { getRanking, RANKING_TYPES } from '../services/matchServices';
import { useRouter } from 'expo-router';
import { logger } from '../utils/logger';
import { useColors } from '../contexts/ThemeContext';

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

  // Tab options for ranking types (using all available API endpoints)
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
  ], [colors]);

  // Load ranking data with caching to prevent unnecessary reloads
  const loadRankingData = useCallback(async (rankingType: string, isRefresh = false) => {
    logger.log(`[RankingEnhanced] Loading ${rankingType} rankings...`);
    
    // Check cache first (unless refreshing)
    if (!isRefresh && rankingCache[rankingType]) {
      logger.log(`[RankingEnhanced] Using cached data for ${rankingType}: ${rankingCache[rankingType].length} items`);
      setRankingData(rankingCache[rankingType]);
      setLoading(false);
      setError(null); // Clear any previous errors when using cache
      return;
    }
    
    if (!isRefresh) setLoading(true);
    setRefreshing(isRefresh);
    setError(null);

    try {
      const response = await getRanking(rankingType);
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
      
      // Cache the data
      setRankingCache(prev => ({
        ...prev,
        [rankingType]: rankings
      }));
      
      setRankingData(rankings);
      logger.log(`[RankingEnhanced] Successfully loaded ${rankings.length} ${rankingType} rankings`);
      
      // Clear any previous errors on successful load
      if (rankings.length > 0) {
        setError(null);
      } else {
        logger.warn(`[RankingEnhanced] No rankings returned for ${rankingType}`);
        setError(`No ${rankingType} rankings available for the current season`);
      }
    } catch (error: any) {
      logger.error(`[RankingEnhanced] Error loading ${rankingType} rankings:`, error);
      const errorMessage = error.message || `Failed to load ${rankingType} rankings`;
      setError(errorMessage);
      setRankingData([]);
    } finally {
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
    let filtered = [...rankingData];

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      filtered = filtered.filter(item =>
        item.player_name?.toLowerCase().includes(query) ||
        (item.country && item.country.toLowerCase().includes(query)) ||
        item.Position.toString().includes(query)
      );
    }

    setFilteredData(filtered);
  }, [rankingData, searchQuery]);

  // Initial data load on component mount
  useEffect(() => {
    loadRankingData('MoneyRankings'); // Load default data immediately
  }, []); // Only run once on mount

  // Load data when filter changes
  useEffect(() => {
    const selectedOption = filterOptions.find(option => option.id === selectedFilter);
    if (selectedOption) {
      loadRankingData(selectedOption.value);
    }
  }, [selectedFilter, loadRankingData, filterOptions]);

  // Handle filter selection
  const handleFilterPress = (filterId: string) => {
    if (filterId !== selectedFilter) {
      setSelectedFilter(filterId);
      setError(null); // Clear any previous errors
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
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
    if (player.Player) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      router.push(`/player/${player.Player}`);
    }
  };

  // Render filter button
  const renderFilterButton = (option: FilterOption) => {
    const isSelected = selectedFilter === option.id;
    
    return (
      <TouchableOpacity
        key={option.id}
        style={[
          styles.filterButton,
          {
            backgroundColor: isSelected ? option.color : colors.cardBackground,
            borderColor: isSelected ? option.color : colors.cardBorder,
            borderWidth: 1,
          }
        ]}
        onPress={() => {
          console.log(`[RankingTab] Pressed: ${option.id}`);
          handleFilterPress(option.id);
        }}
        activeOpacity={0.6}
        hitSlop={{ top: 35, bottom: 35, left: 35, right: 35 }}
        delayPressIn={0}
        delayPressOut={0}
        pressRetentionOffset={{ top: 40, bottom: 40, left: 40, right: 40 }}
      >
        <Ionicons 
          name={option.icon} 
          size={20} 
          color={isSelected ? '#FFFFFF' : colors.textPrimary} 
        />
        <Text style={[
          styles.filterText, 
          { color: isSelected ? '#FFFFFF' : colors.textPrimary }
        ]}>
          {option.label}
        </Text>
      </TouchableOpacity>
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
                    size={12} 
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

  // Loading state
  if (loading && !refreshing) {
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

  // Dynamic gradient colors based on theme
  const backgroundGradient = colors.cardBackground === 'rgba(255, 255, 255, 0.95)'
    ? ['#F8F9FA', '#E9ECEF', '#DEE2E6'] as const // Light mode gradient
    : ['#1a1a2e', '#16213e', '#0f3460'] as const; // Dark mode gradient

  return (
    <LinearGradient
      colors={backgroundGradient}
      style={styles.gradientBackground}
    >
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

        {/* Filter Buttons */}
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filtersContainer}
          style={styles.filtersScrollView}
          scrollEventThrottle={16}
          decelerationRate="fast"
          bounces={false}
        >
          {filterOptions.map(renderFilterButton)}
        </ScrollView>

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
    </LinearGradient>
  );
}

// Dynamic styles function
const createRankingStyles = (colors: any) => StyleSheet.create({
  gradientBackground: {
    flex: 1,
  },
  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  title: {
    fontSize: 28,
    fontFamily: 'PoppinsBold',
    textAlign: 'center',
    marginVertical: 16,
    color: colors.textHeader,
  },
  headerContainer: {
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  searchContainer: {
    marginBottom: 12,
  },
  searchInput: {
    height: 44,
    backgroundColor: colors.cardBackground,
    borderRadius: 22,
    paddingHorizontal: 16,
    fontSize: 16,
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
    marginRight: 12,
    borderRadius: 20,
    minHeight: 52,
    minWidth: 110,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    elevation: 4,
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
  },
  filterText: {
    marginLeft: 8,
    fontSize: 14,
    fontFamily: 'PoppinsMedium',
    color: colors.textSecondary,
  },
  filterTextActive: {
    color: colors.textPrimary,
    fontFamily: 'PoppinsSemiBold',
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
    marginVertical: 6,
    marginHorizontal: 16,
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 6,
  },
  rankingContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  positionContainer: {
    alignItems: 'center',
    minWidth: 60,
  },
  position: {
    fontSize: 18,
    fontFamily: 'PoppinsBold',
    color: colors.primary,
  },
  changeIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    marginTop: 4,
  },
  changeText: {
    fontSize: 10,
    fontFamily: 'PoppinsBold',
    color: colors.textPrimary,
    marginLeft: 2,
  },
  playerInfo: {
    flex: 1,
    marginLeft: 16,
  },
  playerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  playerName: {
    fontSize: 16,
    fontFamily: 'PoppinsSemiBold',
    color: colors.textPrimary,
    flex: 1,
  },
  country: {
    fontSize: 12,
    fontFamily: 'PoppinsRegular',
    color: colors.textSecondary,
  },
  prize: {
    fontSize: 14,
    fontFamily: 'PoppinsBold',
    color: colors.success,
    marginBottom: 8,
  },
  miniProgressTrack: {
    width: '100%',
    height: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  miniProgressFill: {
    height: '100%',
    borderRadius: 2,
  },
  actionArrow: {
    marginLeft: 12,
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