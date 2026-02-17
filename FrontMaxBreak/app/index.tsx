import React, { useState, useMemo } from 'react';
import {
    View, 
    Text, 
    FlatList, 
    TouchableOpacity,
    RefreshControl, 
    ScrollView,
    ImageBackground
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { TOUCH_SLOP } from '../utils/constants';
import { logger } from '../utils/logger';
import { forceCacheRefresh } from '../services/api';

// --- Imports ---
import { ListItem, ActiveFilterType, FilterButton } from './home/types';
import { useHomeColors } from './home/hooks/useHomeColors';
import { useHomeData } from './home/hooks/useHomeData';
import { createStyles } from './home/styles/homeStyles';
import { MatchItem } from './home/components/MatchItem';
import { StatusHeaderItem } from './home/components/StatusHeaderItem';
import { RoundHeaderItem } from './home/components/RoundHeaderItem';
import { LoadingComponent, ErrorComponent, EmptyComponent } from './home/components/StateComponents';
import { ICONS } from './home/utils/icons';
import { getDeviceTabConfig } from '../config/deviceTabConfig';
import { DeviceAwareFilterScrollView } from '../components/DeviceAwareFilterScrollView';

const HomeScreen = (): React.ReactElement | null => {
    const [activeFilter, setActiveFilter] = useState<ActiveFilterType>('all');
    const navigation = useRouter();
    const COLORS = useHomeColors();
    
    // Use the extracted hook for data management
    const {
        processedListData,
        tourName,
        tournamentPrize,
        loading,
        refreshing,
        error,
        activeOtherTours,
        selectedOtherTour,
        loadTournamentInfo,
        handleOtherTourSelection
    } = useHomeData();
    
    // AGGRESSIVE DEVICE FIX: Always refresh data when screen regains focus
    // This ensures scores are correct when returning from match details
    useFocusEffect(
        React.useCallback(() => {
            // Small delay to ensure navigation is complete, then force refresh
            const timeoutId = setTimeout(() => {
                logger.log('[HomeScreen] 🎯 FOCUS EFFECT: Force refreshing tournament data');
                // Clear API cache to ensure fresh data after navigation
                forceCacheRefresh();
                loadTournamentInfo(true, selectedOtherTour);
            }, 100); // 100ms delay
            
            return () => clearTimeout(timeoutId);
        }, [selectedOtherTour]) // CRASH FIX: Remove loadTournamentInfo dependency to prevent infinite loop
    );




    // Filtering logic
    const filteredListData = useMemo(() => {
        if (activeFilter === 'all') return processedListData;
        
        const filtered: ListItem[] = [];
        let includeItems = false;
        let currentStatusHeader: ListItem | null = null;
        
        for (const item of processedListData) {
            if (item.type === 'statusHeader') {
                includeItems = (item.id === `statusHeader-${activeFilter}`);
                
                if (includeItems) {
                    currentStatusHeader = item;
                    filtered.push(item);
                } else {
                    currentStatusHeader = null;
                }
            } else if (includeItems && currentStatusHeader) {
                filtered.push(item);
            }
        }
        
        return filtered;
    }, [processedListData, activeFilter]);

    // Create styles with dynamic colors
    const styles = createStyles(COLORS);
    const deviceConfig = getDeviceTabConfig();
    const deviceStyles = deviceConfig.createDynamicStyles(COLORS);

    // Render list item function
    const renderListItem = ({ item }: { item: ListItem }): React.ReactElement | null => {
        if (item.type === 'statusHeader') {
            return <StatusHeaderItem title={item.title} iconName={item.iconName} colors={COLORS} styles={styles} />;
        }
        if (item.type === 'roundHeader') {
            return <RoundHeaderItem roundName={item.roundName} styles={styles} />;
        }
        if (item.type === 'match') {
            return <MatchItem item={item} tourName={tourName} navigation={navigation} />;
        }
        return null;
    };

    const filterButtons: FilterButton[] = [
        { label: 'All', value: 'all', icon: ICONS.all },
        { label: 'Live', value: 'livePlaying', icon: ICONS.livePlaying },
        { label: 'Break', value: 'onBreak', icon: ICONS.onBreak },
        { label: 'Upcoming', value: 'upcoming', icon: ICONS.upcoming },
        { label: 'Results', value: 'finished', icon: ICONS.finished },
    ];

    // Main Render structure
    return (
        <ImageBackground source={require('../assets/snooker_background.jpg')} style={styles.backgroundImage}>
            <SafeAreaView style={styles.container}>
                <View style={styles.headerContainer}>
                    <Text style={styles.screenTitle}>Snooker.org</Text>
                    {tourName && <Text style={styles.tourTitle}>{tourName}</Text>}
                    {tournamentPrize && (
                        <View style={styles.prizeContainer}>
                            <Ionicons name="diamond-outline" size={14} color={COLORS.accentLight} />
                            <Text style={styles.prizeText}>Winner: {tournamentPrize}</Text>
                        </View>
                    )}
                </View>
                
                <DeviceAwareFilterScrollView
                    options={filterButtons.map(filter => ({
                        id: filter.value,
                        label: filter.label,
                        icon: filter.icon
                    }))}
                    selectedValue={activeFilter}
                    onSelectionChange={(value) => {
                        logger.debug(`[HomeFilter] Device-Aware Pressed: ${value}`);
                        setActiveFilter(value as ActiveFilterType);
                    }}
                    colors={COLORS}
                    style={styles.filterScrollView}
                    containerStyle={styles.filterContainer}
                />
                
                {/* Other Tours Toolbar */}
                {activeOtherTours.length > 0 && (
                    <View style={styles.otherToursContainer}>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.otherToursScrollView}>
                            {activeOtherTours.map((tour) => (
                                <TouchableOpacity
                                    key={tour.ID}
                                    style={[
                                        styles.otherTourChip,
                                        selectedOtherTour === tour.ID && styles.otherTourChipActive
                                    ]}
                                    onPress={() => {
                                        logger.debug(`[OtherTour] Pressed: ${tour.ID}`);
                                        handleOtherTourSelection(tour.ID);
                                    }}
                                    activeOpacity={0.6}
                                    hitSlop={{ top: 35, bottom: 35, left: 35, right: 35 }}
                                    delayPressIn={0}
                                    delayPressOut={0}
                                    pressRetentionOffset={{ top: 40, bottom: 40, left: 40, right: 40 }}
                                >
                                    <Text style={[
                                        styles.otherTourText,
                                        selectedOtherTour === tour.ID && styles.otherTourTextActive
                                    ]} numberOfLines={1}>
                                        {tour.Name || `${tour.Tour?.toUpperCase()} Tour`}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                    </View>
                )}
                
                <View style={styles.listArea}>
                    {loading && filteredListData.length === 0 ? (
                        <LoadingComponent COLORS={COLORS} styles={styles} />
                    ) : error ? (
                        <ErrorComponent 
                            COLORS={COLORS} 
                            styles={styles} 
                            error={error} 
                            onRetry={() => loadTournamentInfo()} 
                        />
                    ) : (
                        <FlatList
                            data={filteredListData}
                            renderItem={renderListItem}
                            keyExtractor={(item: ListItem) => {
                                if (item.type === 'match') {
                                    // ENHANCED KEY: Include ALL critical data to force re-render when any relevant data changes
                                    // This fixes the emulator vs physical device score display inconsistency
                                    const scoreKey = `${item.score1 || 'null'}-${item.score2 || 'null'}`;
                                    const statusKey = `${item.status_code || 'null'}`;
                                    const winnerKey = `${item.winner_id || 'null'}`;
                                    const nameKey = `${item.player1_name || 'null'}_${item.player2_name || 'null'}`;
                                    const combinedKey = `${scoreKey}-${statusKey}-${winnerKey}-${nameKey}`;
                                    return `match-${item.id}-${item.api_match_id}-${combinedKey}`;
                                }
                                return item.id;
                            }}
                            ListEmptyComponent={!loading ? (
                                <EmptyComponent COLORS={COLORS} styles={styles} tourName={tourName} />
                            ) : null}
                            contentContainerStyle={styles.listContentContainer}
                            refreshControl={
                                <RefreshControl
                                    refreshing={refreshing}
                                    onRefresh={() => loadTournamentInfo(true, selectedOtherTour)}
                                    tintColor={COLORS.accentLight}
                                    colors={[COLORS.accentLight]}
                                />
                            }
                            initialNumToRender={15}
                            maxToRenderPerBatch={10}
                            windowSize={11}
                        />
                    )}
                </View>
            </SafeAreaView>
        </ImageBackground>
    );
};

HomeScreen.displayName = 'HomeScreen';

export default HomeScreen;