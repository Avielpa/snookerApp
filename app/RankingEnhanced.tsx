// screens/RankingEnhanced.tsx
import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
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

// Import modern components
import { SearchBox, ProgressBar } from './components/modern';

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
  const [selectedFilter, setSelectedFilter] = useState<string>('money_rankings');

  const router = useRouter();
  const colors = useColors();

  // Tab options for all 5 ranking types
  const filterOptions: FilterOption[] = useMemo(() => [
    {
      id: 'money_rankings',
      label: 'Money Rankings',
      value: RANKING_TYPES.MONEY_RANKINGS,
      icon: 'trophy-outline',
      color: colors.primary,
    },
    {
      id: 'money_seedings',
      label: 'Money Seedings',
      value: RANKING_TYPES.MONEY_SEEDINGS,
      icon: 'medal-outline',
      color: colors.secondary,
    },
    {
      id: 'one_year_money',
      label: 'One Year Money',
      value: RANKING_TYPES.ONE_YEAR_MONEY_RANKINGS,
      icon: 'calendar-outline',
      color: colors.success,
    },
    {
      id: 'qt_rankings',
      label: 'QT Rankings',
      value: RANKING_TYPES.QT_RANKINGS,
      icon: 'star-outline',
      color: '#FF6B35',
    },
    {
      id: 'womens',
      label: "Women's Rankings",
      value: RANKING_TYPES.WOMENS_RANKINGS,
      icon: 'ribbon-outline',
      color: '#E91E63',
    },
  ], [colors]);

  // Load ranking data using new ranking-types endpoint
  const loadRankingData = useCallback(async (rankingType: string, isRefresh = false) => {
    logger.log(`[RankingEnhanced] Loading ${rankingType} rankings...`);
    
    if (!isRefresh) setLoading(true);
    setRefreshing(isRefresh);
    setError(null);

    try {
      const response = await getRanking(rankingType);
      const rankings: RankingItem[] = (response.rankings || []).map((item: any) => ({
        ...item,
        Position: typeof item.Position === 'number' && item.Position !== null ? item.Position : 0,
      }));
      
      // Use real data from new ranking-types API
      const enhancedRankings = rankings;

      setRankingData(enhancedRankings);
      logger.log(`[RankingEnhanced] Loaded ${enhancedRankings.length} ${rankingType} rankings`);
    } catch (error: any) {
      logger.error('[RankingEnhanced] Error loading rankings:', error);
      setError('Failed to load rankings. Please try again.');
      setRankingData([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);


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
        style={[styles.filterButton, isSelected && styles.filterButtonActive]}
        onPress={() => handleFilterPress(option.id)}
        activeOpacity={0.8}
      >
        <LinearGradient
          colors={isSelected 
            ? [option.color, `${option.color}80`] 
            : ['rgba(255, 255, 255, 0.1)', 'rgba(255, 255, 255, 0.05)']
          }
          style={styles.filterGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <Ionicons 
            name={option.icon} 
            size={20} 
            color={isSelected ? colors.textPrimary : colors.textSecondary} 
          />
          <Text style={[styles.filterText, isSelected && styles.filterTextActive]}>
            {option.label}
          </Text>
        </LinearGradient>
      </TouchableOpacity>
    );
  };

  // Render ranking item
  const renderRankingItem = ({ item }: { item: RankingItem }): React.JSX.Element => {
    const playerName = item.player_name || `Player ${item.Player}` || 'Unknown Player';
    const positionChange = item.positionChange;
    const isRising = positionChange && positionChange > 0;
    const isFalling = positionChange && positionChange < 0;

    return (
      <TouchableOpacity
        onPress={() => handlePlayerPress(item)}
        activeOpacity={0.8}
        disabled={!item.Player}
      >
        <View style={styles.rankingCard}>
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
              <ProgressBar 
                progress={Math.min(item.Sum / 1000000, 1)} // Normalize to max 1M
                height={4}
                colors={[colors.primary, colors.secondary]}
                animated={false}
              />
            </View>

            {/* Action Arrow */}
            <Ionicons 
              name="chevron-forward" 
              size={20} 
              color={colors.textSecondary} 
              style={styles.actionArrow}
            />
          </View>
        </View>
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
          <TouchableOpacity style={styles.retryButton} onPress={handleRefresh}>
            <Text style={styles.retryText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <Text style={styles.title}>Player Rankings</Text>
      
      {/* Search and Filters Container */}
      <View style={styles.headerContainer}>
        <SearchBox
          placeholder="Search players, countries..."
          value={searchQuery}
          onChangeText={handleSearch}
          onClear={() => setSearchQuery('')}
        />

        {/* Filter Buttons */}
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filtersContainer}
          style={styles.filtersScrollView}
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
  );
}

// Dynamic styles function
const createRankingStyles = (colors: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
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
  filtersScrollView: {
    marginVertical: 8,
  },
  filtersContainer: {
    paddingRight: 16,
  },
  filterButton: {
    marginRight: 12,
    borderRadius: 20,
    overflow: 'hidden',
  },
  filterButtonActive: {
    elevation: 4,
    shadowColor: '#FFA726',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  filterGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
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
    marginVertical: 4,
    marginHorizontal: 16,
    backgroundColor: colors.cardBackground,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: 12,
    padding: 16,
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