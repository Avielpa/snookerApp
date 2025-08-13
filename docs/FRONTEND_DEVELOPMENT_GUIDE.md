# 📱 MaxBreak Frontend Development Guide

This comprehensive guide shows you how to connect new server functionality to your React Native frontend, from API services to UI components.

## 🏗️ **Frontend Architecture Overview**

### **Directory Structure**
```
FrontMaxBreak/
├── app/                          # Main screens (Expo Router)
│   ├── index.tsx                # Home screen
│   ├── CalendarEnhanced.tsx     # Calendar screen
│   ├── RankingEnhanced.tsx      # Rankings screen
│   ├── match/                   # Match screen components
│   └── components/              # Reusable components
├── services/                    # API layer
│   ├── api.ts                  # Axios configuration
│   ├── tourServices.ts         # Tournament data
│   └── matchServices.ts        # Match data
├── utils/                       # Utilities
│   ├── logger.ts               # Logging system
│   └── formatters.ts           # Data formatting
└── contexts/                    # React contexts
    └── ThemeContext.tsx        # App theming
```

### **Data Flow**
```
Server API → Services Layer → React Components → User Interface
```

---

## 🚀 **Step-by-Step: Connecting Server to Frontend**

### **STEP 1: Open Your Development Environment**

1. **Open VS Code**
   ```bash
   # Navigate to frontend directory
   cd C:\Users\Aviel\vsprojects\snookerApp\FrontMaxBreak
   
   # Open in VS Code
   code .
   ```

2. **Install Dependencies** (if needed)
   ```bash
   npm install
   ```

3. **Start Development Server**
   ```bash
   npx expo start
   ```

---

### **STEP 2: Creating API Service Functions**

When you add a new server endpoint, you need to create a corresponding service function.

**Example: You added player statistics endpoint to server**
**Server endpoint**: `GET /oneFourSeven/players/{player_id}/stats/`

**📝 Step 2.1: Add Service Function**

**File: `services/tourServices.ts` (or create `services/playerServices.ts`)**

```typescript
// Import the configured API instance
import { api } from './api';
import { logger } from '../utils/logger';

// Define TypeScript interface for the data structure
export interface PlayerStatistics {
  ID: number;
  totalMatches: number;
  wins: number;
  losses: number;
  winPercentage: number;
  centuryBreaks: number;
  highestBreak: number;
  averageBreak: number;
}

/**
 * Fetches detailed statistics for a specific player
 * @param playerId - The player's ID
 * @returns Promise<PlayerStatistics | null>
 */
export const getPlayerStatistics = async (playerId: number): Promise<PlayerStatistics | null> => {
  // Validate input
  if (!playerId || playerId <= 0) {
    logger.error('[PlayerService] Invalid player ID provided:', playerId);
    return null;
  }

  const urlPath = `players/${playerId}/stats/`;
  logger.debug(`[PlayerService] Fetching player stats from: ${urlPath}`);

  try {
    const response = await api.get<PlayerStatistics>(urlPath);

    if (response.data && typeof response.data === 'object') {
      logger.debug(`[PlayerService] Successfully fetched stats for player ${playerId}`);
      return response.data;
    } else {
      logger.warn(`[PlayerService] Invalid data format for player ${playerId}:`, response.data);
      return null;
    }
  } catch (error: any) {
    const status = error.response?.status;
    const errorData = error.response?.data;

    if (status === 404) {
      logger.log(`[PlayerService] Player statistics not found for ID ${playerId}`);
    } else {
      logger.error(`[PlayerService] Error fetching player stats (Status: ${status}):`, errorData || error.message);
    }

    return null;
  }
};
```

---

### **STEP 3: Creating React Hook for Data Management**

Create a custom hook to manage the data fetching and state.

**📝 Step 3.1: Create Custom Hook**

**File: `hooks/usePlayerStats.ts` (create this file)**

```typescript
import { useState, useEffect, useCallback } from 'react';
import { getPlayerStatistics, PlayerStatistics } from '../services/tourServices';
import { logger } from '../utils/logger';

interface UsePlayerStatsReturn {
  stats: PlayerStatistics | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

export const usePlayerStats = (playerId: number): UsePlayerStatsReturn => {
  const [stats, setStats] = useState<PlayerStatistics | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = useCallback(async () => {
    if (!playerId) return;

    setLoading(true);
    setError(null);

    try {
      logger.log(`[usePlayerStats] Fetching stats for player ${playerId}`);
      const data = await getPlayerStatistics(playerId);

      if (data) {
        setStats(data);
        logger.log(`[usePlayerStats] Successfully loaded stats for player ${playerId}`);
      } else {
        setError('Player statistics not available');
        logger.warn(`[usePlayerStats] No stats available for player ${playerId}`);
      }
    } catch (error: any) {
      const errorMessage = 'Failed to load player statistics';
      setError(errorMessage);
      logger.error(`[usePlayerStats] Error loading stats:`, error);
    } finally {
      setLoading(false);
    }
  }, [playerId]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  const refetch = useCallback(() => {
    fetchStats();
  }, [fetchStats]);

  return {
    stats,
    loading,
    error,
    refetch,
  };
};
```

---

### **STEP 4: Creating UI Components**

Now create React components to display the data.

**📝 Step 4.1: Create Statistics Component**

**File: `components/PlayerStatistics.tsx` (create this file)**

```typescript
import React from 'react';
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useColors } from '../contexts/ThemeContext';
import { usePlayerStats } from '../hooks/usePlayerStats';

interface PlayerStatisticsProps {
  playerId: number;
  playerName?: string;
}

export const PlayerStatistics: React.FC<PlayerStatisticsProps> = ({ playerId, playerName }) => {
  const colors = useColors();
  const { stats, loading, error, refetch } = usePlayerStats(playerId);

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
          Loading statistics...
        </Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.container}>
        <Ionicons name="warning-outline" size={48} color={colors.error} />
        <Text style={[styles.errorText, { color: colors.error }]}>{error}</Text>
        <TouchableOpacity
          style={[styles.retryButton, { backgroundColor: colors.primary }]}
          onPress={refetch}
        >
          <Text style={styles.retryButtonText}>Try Again</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!stats) {
    return (
      <View style={styles.container}>
        <Text style={[styles.noDataText, { color: colors.textSecondary }]}>
          No statistics available for {playerName || 'this player'}
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {playerName && (
        <Text style={[styles.playerName, { color: colors.textPrimary }]}>
          {playerName} Statistics
        </Text>
      )}

      <View style={styles.statsGrid}>
        <StatCard 
          title="Total Matches" 
          value={stats.totalMatches.toString()} 
          icon="trophy-outline" 
          colors={colors}
        />
        <StatCard 
          title="Win Rate" 
          value={`${stats.winPercentage}%`} 
          icon="trending-up-outline" 
          colors={colors}
        />
        <StatCard 
          title="Century Breaks" 
          value={stats.centuryBreaks.toString()} 
          icon="star-outline" 
          colors={colors}
        />
        <StatCard 
          title="Highest Break" 
          value={stats.highestBreak.toString()} 
          icon="arrow-up-outline" 
          colors={colors}
        />
      </View>
    </View>
  );
};

// Helper component for individual stat cards
interface StatCardProps {
  title: string;
  value: string;
  icon: keyof typeof Ionicons.glyphMap;
  colors: any;
}

const StatCard: React.FC<StatCardProps> = ({ title, value, icon, colors }) => (
  <LinearGradient
    colors={[colors.cardBackground, colors.cardBackgroundSecondary]}
    style={styles.statCard}
  >
    <Ionicons name={icon} size={24} color={colors.primary} />
    <Text style={[styles.statValue, { color: colors.textPrimary }]}>{value}</Text>
    <Text style={[styles.statTitle, { color: colors.textSecondary }]}>{title}</Text>
  </LinearGradient>
);

const styles = StyleSheet.create({
  container: {
    padding: 16,
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    fontFamily: 'PoppinsRegular',
  },
  errorText: {
    marginTop: 12,
    fontSize: 14,
    fontFamily: 'PoppinsRegular',
    textAlign: 'center',
  },
  retryButton: {
    marginTop: 16,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontFamily: 'PoppinsSemiBold',
  },
  noDataText: {
    fontSize: 14,
    fontFamily: 'PoppinsRegular',
    textAlign: 'center',
  },
  playerName: {
    fontSize: 18,
    fontFamily: 'PoppinsBold',
    marginBottom: 16,
    textAlign: 'center',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  statCard: {
    width: '48%',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 12,
  },
  statValue: {
    fontSize: 24,
    fontFamily: 'PoppinsBold',
    marginTop: 8,
  },
  statTitle: {
    fontSize: 12,
    fontFamily: 'PoppinsRegular',
    marginTop: 4,
    textAlign: 'center',
  },
});
```

---

### **STEP 5: Integrating Components into Screens**

Now add your new component to existing screens.

**📝 Step 5.1: Add to Player Details Screen**

**File: `app/player/[id].tsx`**

```typescript
import React from 'react';
import { ScrollView } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { PlayerStatistics } from '../../components/PlayerStatistics';

export default function PlayerDetailsScreen() {
  const { id } = useLocalSearchParams();
  const playerId = parseInt(id as string);

  return (
    <ScrollView style={{ flex: 1 }}>
      {/* Existing player info components */}
      
      {/* Add your new statistics component */}
      <PlayerStatistics playerId={playerId} />
      
      {/* Other existing components */}
    </ScrollView>
  );
}
```

**📝 Step 5.2: Add to Match Screen Tabs**

**File: `app/match/MatchEnhanced.tsx`**

```typescript
// Import your component
import { PlayerStatistics } from '../../components/PlayerStatistics';

// Add it to the appropriate tab content
const renderStatsTab = () => (
  <ScrollView style={styles.tabContent}>
    <PlayerStatistics playerId={matchData.Player1ID} playerName={matchData.player1_name} />
    <PlayerStatistics playerId={matchData.Player2ID} playerName={matchData.player2_name} />
  </ScrollView>
);
```

---

### **STEP 6: Testing Your Implementation**

**📝 Step 6.1: Test in Development**

```bash
# Start Expo development server
npx expo start

# Test in simulator/device
# Navigate to player details screen
# Verify data loads correctly
```

**📝 Step 6.2: Debug Common Issues**

```typescript
// Add debugging to your service function
console.log('[DEBUG] API Response:', response.data);

// Add debugging to your hook
console.log('[DEBUG] Stats loaded:', stats);

// Add debugging to your component
console.log('[DEBUG] Component props:', { playerId, playerName });
```

---

## 🎨 **UI/UX Best Practices**

### **Loading States**
Always show loading indicators:
```typescript
if (loading) {
  return <ActivityIndicator size="large" color={colors.primary} />;
}
```

### **Error Handling**
Provide user-friendly error messages:
```typescript
if (error) {
  return (
    <View>
      <Text>Something went wrong</Text>
      <TouchableOpacity onPress={refetch}>
        <Text>Try Again</Text>
      </TouchableOpacity>
    </View>
  );
}
```

### **Empty States**
Handle cases where no data exists:
```typescript
if (!data || data.length === 0) {
  return <Text>No data available</Text>;
}
```

---

## 🔧 **Common Development Patterns**

### **Data Transformation**
Transform server data to match UI needs:

```typescript
const formatPlayerStats = (rawStats: any): PlayerStatistics => ({
  ID: rawStats.ID,
  totalMatches: rawStats.wins + rawStats.losses,
  wins: rawStats.wins,
  losses: rawStats.losses,
  winPercentage: Math.round((rawStats.wins / (rawStats.wins + rawStats.losses)) * 100),
  centuryBreaks: rawStats.centuryBreaks || 0,
  highestBreak: rawStats.highestBreak || 0,
  averageBreak: rawStats.averageBreak || 0,
});
```

### **Caching Data**
Use React Query or SWR for advanced caching:

```typescript
import { useQuery } from '@tanstack/react-query';

export const usePlayerStats = (playerId: number) => {
  return useQuery({
    queryKey: ['playerStats', playerId],
    queryFn: () => getPlayerStatistics(playerId),
    staleTime: 5 * 60 * 1000, // 5 minutes
    enabled: !!playerId,
  });
};
```

### **Optimistic Updates**
Update UI immediately, then sync with server:

```typescript
const handleLike = async (playerId: number) => {
  // Update UI immediately
  setLiked(true);
  
  try {
    // Sync with server
    await likePlayer(playerId);
  } catch (error) {
    // Revert on error
    setLiked(false);
    showError('Failed to like player');
  }
};
```

---

## 📱 **Mobile-Specific Considerations**

### **Performance**
- Use `React.memo` for expensive components
- Implement lazy loading for lists
- Optimize images with proper sizing

### **Touch Targets**
- Minimum 44px touch targets
- Add proper `hitSlop` for small buttons
- Use appropriate `activeOpacity` values

### **Accessibility**
- Add `accessibilityLabel` to components
- Support screen readers
- Provide alternative text for images

---

## 🧪 **Testing Your Components**

### **Unit Testing**
```typescript
// Test your service functions
describe('getPlayerStatistics', () => {
  it('should fetch player statistics successfully', async () => {
    const stats = await getPlayerStatistics(5);
    expect(stats).toBeDefined();
    expect(stats.ID).toBe(5);
  });
});

// Test your components
import { render, screen } from '@testing-library/react-native';

describe('PlayerStatistics', () => {
  it('should display loading state', () => {
    render(<PlayerStatistics playerId={5} />);
    expect(screen.getByText('Loading statistics...')).toBeTruthy();
  });
});
```

---

## 🔄 **Complete Integration Checklist**

### **Server Side** ✅
- [ ] API endpoint created
- [ ] Data scraping implemented
- [ ] URL routing configured
- [ ] Error handling added

### **Frontend Side** 📱
- [ ] TypeScript interfaces defined
- [ ] Service function created
- [ ] Custom hook implemented  
- [ ] UI component built
- [ ] Error handling added
- [ ] Loading states implemented
- [ ] Component integrated into screens
- [ ] Testing completed

---

## 🆘 **Troubleshooting Common Issues**

### **API Not Responding**
1. Check server is running: `python manage.py runserver`
2. Verify API URL in `services/api.ts`
3. Check network connectivity
4. Review server logs for errors

### **TypeScript Errors**
1. Define proper interfaces for all data structures
2. Use optional properties (`?`) for nullable fields
3. Add proper type assertions where needed

### **Component Not Updating**
1. Check if data is being fetched correctly
2. Verify state updates in hooks
3. Ensure proper dependency arrays in `useEffect`

---

## 🎯 **Next Steps & Advanced Topics**

1. **State Management**: Learn Redux Toolkit or Zustand for complex state
2. **Navigation**: Master Expo Router for advanced navigation patterns  
3. **Animations**: Add Reanimated 2 for smooth animations
4. **Offline Support**: Implement data persistence with AsyncStorage
5. **Push Notifications**: Add real-time updates with Expo Notifications

---

*This guide provides a complete workflow for connecting your server functionality to the frontend. Follow these patterns for consistent, maintainable code.*