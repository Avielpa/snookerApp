# 🎓 Complete Junior Developer Guide: Adding Features to the Snooker App

## **THE ULTIMATE STEP-BY-STEP GUIDE FOR BEGINNERS**

This guide will teach you how to add any feature to the snooker app from scratch. It covers the complete journey from having an idea to implementing it in both backend and frontend.

**📚 Prerequisites:** Basic programming knowledge (variables, functions, if statements, loops)

**🎯 Learning Goals:** By the end of this guide, you'll understand:
- How to design a new feature
- Backend development (API, database, data processing)
- Frontend development (UI, services, state management)
- How all the pieces connect together

---

## 📋 Table of Contents

1. [Understanding the App Architecture](#understanding-the-app-architecture)
2. [Step-by-Step Feature Development Process](#step-by-step-feature-development-process)
3. [Backend Development Deep Dive](#backend-development-deep-dive)
4. [Frontend Development Deep Dive](#frontend-development-deep-dive)
5. [Real Example: Adding Player Statistics Feature](#real-example-adding-player-statistics-feature)
6. [Testing Your Feature](#testing-your-feature)
7. [Common Patterns and Best Practices](#common-patterns-and-best-practices)
8. [Troubleshooting Guide](#troubleshooting-guide)

---

## 🏗️ Understanding the App Architecture

### **The Big Picture: How Everything Connects**

```
[External API] → [Backend] → [Frontend] → [User]
   snooker.org     Django    React Native   Mobile App
```

**Think of it like a restaurant:**
- **External API (snooker.org)** = The food supplier (provides raw data)
- **Backend (Django)** = The kitchen (processes and cooks the data)
- **Frontend (React Native)** = The waiter (presents data nicely to users)
- **User** = The customer (sees the final result)

### **Backend Components (Django Kitchen)**

```
📁 maxBreak/oneFourSeven/
├── 📄 models.py          # Database tables (where data is stored)
├── 📄 views.py           # API endpoints (what frontend can request)
├── 📄 serializers.py     # Data formatters (how data is sent to frontend)
├── 📄 urls.py            # URL routing (which endpoint does what)
├── 📄 api_client.py      # External API calls (gets data from snooker.org)
├── 📄 data_mappers.py    # Data transformers (cleans and organizes data)
├── 📄 data_savers.py     # Database operations (saves data to database)
├── 📄 scraper.py         # Data fetchers (gets specific data from API)
└── 📄 constants.py       # Configuration values (settings and constants)
```

### **Frontend Components (React Native Waiter)**

```
📁 FrontMaxBreak/
├── 📁 app/               # Screens (what user sees)
├── 📁 services/          # API calls (talks to backend)
├── 📁 utils/             # Helper functions (reusable code)
├── 📁 contexts/          # Global state (app-wide data)
└── 📁 components/        # Reusable UI pieces (buttons, cards, etc.)
```

---

## 🔧 Step-by-Step Feature Development Process

### **The Universal Process (Use This for Any Feature)**

```
1. 💡 IDEA → What do you want to build?
2. 📝 DESIGN → Plan how it will work
3. 🗄️ DATABASE → Design data storage
4. 🔌 API → Create backend endpoints
5. 🎨 FRONTEND → Build user interface
6. 🔗 CONNECT → Link frontend to backend
7. 🧪 TEST → Make sure everything works
8. 🚀 DEPLOY → Make it available to users
```

---

## 🗄️ Backend Development Deep Dive

### **Step 1: Define Your Data (models.py)**

**What models.py does:** Defines what data you want to store in the database.

**Think of it as:** Creating filing cabinets with labeled drawers.

**Example: Adding a "Player Statistics" model**

```python
# In maxBreak/oneFourSeven/models.py

class PlayerStatistics(models.Model):
    """
    Stores calculated statistics for each player.
    Like a report card for each player's performance.
    """
    # Link to the player this statistic belongs to
    Player = models.ForeignKey(
        Player,                    # Which table to link to
        on_delete=models.CASCADE,  # If player is deleted, delete their stats
        related_name='statistics', # Access stats via player.statistics.all()
        help_text="The player these statistics belong to"
    )
    
    # What season these stats are for
    Season = models.IntegerField(
        help_text="Which season (year) these stats are for"
    )
    
    # Various statistics
    TotalMatches = models.IntegerField(
        default=0,
        help_text="Total number of matches played"
    )
    
    MatchesWon = models.IntegerField(
        default=0,
        help_text="Number of matches won"
    )
    
    MatchesLost = models.IntegerField(
        default=0,
        help_text="Number of matches lost"
    )
    
    WinPercentage = models.FloatField(
        default=0.0,
        help_text="Percentage of matches won (0.0 to 100.0)"
    )
    
    AverageScore = models.FloatField(
        default=0.0,
        help_text="Average score per match"
    )
    
    # Timestamps (Django adds these automatically)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    def calculate_win_percentage(self):
        """
        Helper method to calculate win percentage.
        This is a function that belongs to this model.
        """
        if self.TotalMatches == 0:
            return 0.0
        return (self.MatchesWon / self.TotalMatches) * 100
    
    def __str__(self):
        """
        What to show when this object is printed.
        Useful for debugging and admin interface.
        """
        player_name = str(self.Player) if self.Player else "Unknown Player"
        return f"{player_name} - Season {self.Season} Stats"
    
    class Meta:
        verbose_name = "Player Statistics"
        verbose_name_plural = "Player Statistics"
        # Make sure each player can only have one stats record per season
        unique_together = ('Player', 'Season')
        ordering = ['Season', 'Player__LastName']
```

**Key Concepts Explained:**

- **models.Model**: Base class that gives you database powers
- **ForeignKey**: Links to another table (like saying "this belongs to that player")
- **IntegerField**: Stores whole numbers (1, 2, 100, etc.)
- **FloatField**: Stores decimal numbers (3.14, 67.8, etc.)
- **auto_now_add**: Automatically sets timestamp when record is created
- **auto_now**: Automatically updates timestamp when record is modified

### **Step 2: Create Database Migration**

**What migrations do:** Tell Django to create the actual database table.

```bash
# Run this command to create migration file
python manage.py makemigrations oneFourSeven

# Run this command to apply migration to database
python manage.py migrate
```

### **Step 3: Create Data Processor (data_mappers.py)**

**What data_mappers.py does:** Cleans and transforms raw data from external APIs.

**Think of it as:** A translator that converts messy external data into clean, organized data for your app.

```python
# In maxBreak/oneFourSeven/data_mappers.py

def map_player_statistics_data(raw_matches_data, player_id, season):
    """
    Takes raw match data and calculates player statistics.
    
    Args:
        raw_matches_data: List of match dictionaries from API
        player_id: The player we're calculating stats for
        season: Which season to calculate stats for
    
    Returns:
        Dictionary with calculated statistics
    """
    # Initialize counters
    total_matches = 0
    matches_won = 0
    matches_lost = 0
    total_score = 0
    
    # Process each match
    for match in raw_matches_data:
        # Skip if this player isn't in this match
        if not (match.get('Player1ID') == player_id or match.get('Player2ID') == player_id):
            continue
            
        # Skip if match isn't finished
        if match.get('Status') != 2:  # 2 = Finished
            continue
            
        # Count this match
        total_matches += 1
        
        # Determine if player won or lost
        winner_id = match.get('WinnerID')
        if winner_id == player_id:
            matches_won += 1
        else:
            matches_lost += 1
        
        # Add player's score to total
        if match.get('Player1ID') == player_id:
            total_score += match.get('Score1', 0)
        else:
            total_score += match.get('Score2', 0)
    
    # Calculate averages
    average_score = total_score / total_matches if total_matches > 0 else 0
    win_percentage = (matches_won / total_matches * 100) if total_matches > 0 else 0
    
    # Return organized data
    return {
        'Player': player_id,
        'Season': season,
        'TotalMatches': total_matches,
        'MatchesWon': matches_won,
        'MatchesLost': matches_lost,
        'AverageScore': round(average_score, 2),
        'WinPercentage': round(win_percentage, 2),
    }
```

**Key Concepts Explained:**

- **Function parameters**: Data the function needs to work
- **Dictionary.get()**: Safe way to get values from dictionaries (won't crash if key doesn't exist)
- **List comprehension**: Fast way to process lists
- **Round()**: Makes decimal numbers shorter (3.14159 → 3.14)

### **Step 4: Create Data Saver (data_savers.py)**

**What data_savers.py does:** Saves processed data to the database safely.

```python
# In maxBreak/oneFourSeven/data_savers.py

def save_player_statistics(statistics_data):
    """
    Saves player statistics to database.
    Uses get_or_create to avoid duplicates.
    
    Args:
        statistics_data: Dictionary with player statistics
    
    Returns:
        Tuple: (PlayerStatistics object, True if created new)
    """
    try:
        # Import the model
        from .models import PlayerStatistics, Player
        
        # Get the player object
        try:
            player = Player.objects.get(ID=statistics_data['Player'])
        except Player.DoesNotExist:
            logger.warning(f"Player {statistics_data['Player']} not found, skipping statistics")
            return None, False
        
        # Create or update statistics
        statistics, created = PlayerStatistics.objects.get_or_create(
            Player=player,
            Season=statistics_data['Season'],
            defaults={
                'TotalMatches': statistics_data['TotalMatches'],
                'MatchesWon': statistics_data['MatchesWon'],
                'MatchesLost': statistics_data['MatchesLost'],
                'AverageScore': statistics_data['AverageScore'],
                'WinPercentage': statistics_data['WinPercentage'],
            }
        )
        
        # If it already existed, update it
        if not created:
            statistics.TotalMatches = statistics_data['TotalMatches']
            statistics.MatchesWon = statistics_data['MatchesWon']
            statistics.MatchesLost = statistics_data['MatchesLost']
            statistics.AverageScore = statistics_data['AverageScore']
            statistics.WinPercentage = statistics_data['WinPercentage']
            statistics.save()
        
        logger.info(f"{'Created' if created else 'Updated'} statistics for player {player}")
        return statistics, created
        
    except Exception as e:
        logger.error(f"Error saving player statistics: {e}")
        return None, False
```

**Key Concepts Explained:**

- **get_or_create()**: Gets existing record or creates new one (prevents duplicates)
- **try/except**: Handles errors gracefully (won't crash if something goes wrong)
- **defaults**: Values to use when creating new record
- **logger**: Records what happened (useful for debugging)

### **Step 5: Create Serializer (serializers.py)**

**What serializers.py does:** Converts database objects to JSON for the frontend.

**Think of it as:** A translator that converts database language to website language.

```python
# In maxBreak/oneFourSeven/serializers.py

class PlayerStatisticsSerializer(serializers.ModelSerializer):
    """
    Converts PlayerStatistics objects to JSON for frontend.
    Also adds extra calculated fields.
    """
    
    # Add player name (not stored in statistics table)
    player_name = serializers.SerializerMethodField()
    
    # Add player ID for easy reference
    player_id = serializers.IntegerField(source='Player.ID', read_only=True)
    
    # Add loss percentage (calculated field)
    loss_percentage = serializers.SerializerMethodField()
    
    class Meta:
        model = PlayerStatistics
        fields = [
            'id',              # Django's auto-generated ID
            'player_id',       # Player's ID
            'player_name',     # Player's full name
            'Season',          # Which season
            'TotalMatches',    # Total matches played
            'MatchesWon',      # Matches won
            'MatchesLost',     # Matches lost
            'WinPercentage',   # Win percentage
            'loss_percentage', # Loss percentage (calculated)
            'AverageScore',    # Average score per match
        ]
    
    def get_player_name(self, obj):
        """
        Gets the player's full name.
        Called automatically for player_name field.
        """
        if obj.Player:
            return str(obj.Player)  # Uses Player model's __str__ method
        return "Unknown Player"
    
    def get_loss_percentage(self, obj):
        """
        Calculates loss percentage.
        Called automatically for loss_percentage field.
        """
        return round(100 - obj.WinPercentage, 2)
```

**Key Concepts Explained:**

- **ModelSerializer**: Automatically creates serializer based on model
- **SerializerMethodField**: Adds calculated fields not stored in database
- **source**: Gets value from related object (Player.ID)
- **read_only**: Field is only for output, not input

### **Step 6: Create API View (views.py)**

**What views.py does:** Creates endpoints that frontend can call to get data.

```python
# In maxBreak/oneFourSeven/views.py

@api_view(['GET'])
@permission_classes([AllowAny])
def player_statistics_view(request, player_id):
    """
    API endpoint to get statistics for a specific player.
    
    URL: /oneFourSeven/players/{player_id}/statistics/
    Method: GET
    Returns: Player statistics for all seasons
    """
    try:
        # Get the player
        player = get_object_or_404(Player, ID=player_id)
        
        # Get all statistics for this player
        statistics = PlayerStatistics.objects.filter(Player=player).order_by('-Season')
        
        # Convert to JSON
        serializer = PlayerStatisticsSerializer(statistics, many=True)
        
        # Return response
        return Response({
            'player_id': player_id,
            'player_name': str(player),
            'statistics': serializer.data,
            'total_seasons': statistics.count(),
        })
        
    except Exception as e:
        logger.error(f"Error getting player statistics for player {player_id}: {e}")
        return Response(
            {'error': 'Failed to get player statistics'}, 
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )

@api_view(['GET'])
@permission_classes([AllowAny])
def season_statistics_view(request, season):
    """
    API endpoint to get top players for a specific season.
    
    URL: /oneFourSeven/statistics/season/{season}/
    Method: GET
    Returns: Top players ranked by win percentage
    """
    try:
        # Get statistics for this season
        statistics = PlayerStatistics.objects.filter(
            Season=season,
            TotalMatches__gte=5  # Only players with at least 5 matches
        ).order_by('-WinPercentage')[:50]  # Top 50 players
        
        # Convert to JSON
        serializer = PlayerStatisticsSerializer(statistics, many=True)
        
        # Return response
        return Response({
            'season': season,
            'players': serializer.data,
            'total_players': statistics.count(),
        })
        
    except Exception as e:
        logger.error(f"Error getting season statistics for season {season}: {e}")
        return Response(
            {'error': 'Failed to get season statistics'}, 
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )
```

**Key Concepts Explained:**

- **@api_view**: Decorator that makes function an API endpoint
- **@permission_classes**: Controls who can access this endpoint
- **get_object_or_404**: Gets object or returns 404 error if not found
- **filter()**: Gets multiple objects that match criteria
- **order_by()**: Sorts results
- **Response()**: Sends JSON response to frontend

### **Step 7: Add URL Routes (urls.py)**

**What urls.py does:** Maps URLs to view functions.

```python
# In maxBreak/oneFourSeven/urls.py

# Add these to the urlpatterns list
urlpatterns = [
    # ... existing URLs ...
    
    # Player statistics endpoints
    path('players/<int:player_id>/statistics/', player_statistics_view, name='player-statistics'),
    path('statistics/season/<int:season>/', season_statistics_view, name='season-statistics'),
]
```

---

## 🎨 Frontend Development Deep Dive

### **Step 1: Create Service Function (services/)**

**What services do:** Handle all communication with the backend API.

```typescript
// In FrontMaxBreak/services/playerServices.ts

export interface PlayerStatistics {
  id: number;
  player_id: number;
  player_name: string;
  Season: number;
  TotalMatches: number;
  MatchesWon: number;
  MatchesLost: number;
  WinPercentage: number;
  loss_percentage: number;
  AverageScore: number;
}

/**
 * Gets statistics for a specific player across all seasons
 */
export const getPlayerStatistics = async (playerId: number): Promise<PlayerStatistics[]> => {
  try {
    logger.debug(`[PlayerService] Fetching statistics for player ${playerId}`);
    
    const response = await api.get<{
      player_id: number;
      player_name: string;
      statistics: PlayerStatistics[];
      total_seasons: number;
    }>(`players/${playerId}/statistics/`);
    
    if (response.data && response.data.statistics) {
      logger.debug(`[PlayerService] Successfully fetched statistics for player ${playerId}: ${response.data.statistics.length} seasons`);
      return response.data.statistics;
    } else {
      logger.warn(`[PlayerService] No statistics data in response for player ${playerId}`);
      return [];
    }
    
  } catch (error: any) {
    logger.error(`[PlayerService] Error fetching player statistics for ${playerId}:`, error);
    throw new Error(`Failed to load player statistics: ${error.message}`);
  }
};

/**
 * Gets top players for a specific season
 */
export const getSeasonStatistics = async (season: number): Promise<PlayerStatistics[]> => {
  try {
    logger.debug(`[PlayerService] Fetching season statistics for ${season}`);
    
    const response = await api.get<{
      season: number;
      players: PlayerStatistics[];
      total_players: number;
    }>(`statistics/season/${season}/`);
    
    if (response.data && response.data.players) {
      logger.debug(`[PlayerService] Successfully fetched season statistics for ${season}: ${response.data.players.length} players`);
      return response.data.players;
    } else {
      logger.warn(`[PlayerService] No season statistics data in response for ${season}`);
      return [];
    }
    
  } catch (error: any) {
    logger.error(`[PlayerService] Error fetching season statistics for ${season}:`, error);
    throw new Error(`Failed to load season statistics: ${error.message}`);
  }
};
```

**Key Concepts Explained:**

- **interface**: Defines the shape of data (like a contract)
- **async/await**: Handles asynchronous operations (API calls)
- **try/catch**: Handles errors gracefully
- **Generic types**: `<PlayerStatistics[]>` specifies what type of data to expect
- **logger**: Records what happened for debugging

### **Step 2: Create React Hook (hooks/)**

**What hooks do:** Manage state and data fetching in React components.

```typescript
// In FrontMaxBreak/app/player/hooks/usePlayerStatistics.tsx

import { useState, useEffect, useCallback } from 'react';
import { getPlayerStatistics, PlayerStatistics } from '../../../services/playerServices';
import { logger } from '../../../utils/logger';

interface UsePlayerStatisticsReturn {
  statistics: PlayerStatistics[];
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

export const usePlayerStatistics = (playerId: number): UsePlayerStatisticsReturn => {
  // State management
  const [statistics, setStatistics] = useState<PlayerStatistics[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Function to fetch data
  const fetchStatistics = useCallback(async () => {
    if (!playerId) {
      setError('Invalid player ID');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      
      logger.log(`[usePlayerStatistics] Fetching statistics for player ${playerId}`);
      const data = await getPlayerStatistics(playerId);
      
      setStatistics(data);
      logger.log(`[usePlayerStatistics] Successfully loaded ${data.length} season statistics`);
      
    } catch (err: any) {
      logger.error(`[usePlayerStatistics] Error loading statistics:`, err);
      setError(err.message || 'Failed to load player statistics');
      setStatistics([]);
    } finally {
      setLoading(false);
    }
  }, [playerId]);

  // Fetch data when component mounts or playerId changes
  useEffect(() => {
    fetchStatistics();
  }, [fetchStatistics]);

  // Return data and functions
  return {
    statistics,
    loading,
    error,
    refetch: fetchStatistics, // Allow manual refresh
  };
};
```

**Key Concepts Explained:**

- **useState**: Manages component state (data that can change)
- **useEffect**: Runs code when component mounts or dependencies change
- **useCallback**: Memoizes function to prevent unnecessary re-renders
- **dependency array**: `[playerId]` means effect runs when playerId changes

### **Step 3: Create React Component (components/)**

**What components do:** Display data and handle user interactions.

```typescript
// In FrontMaxBreak/app/player/components/PlayerStatisticsCard.tsx

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { PlayerStatistics } from '../../../services/playerServices';
import { useColors } from '../../../contexts/ThemeContext';

interface PlayerStatisticsCardProps {
  statistics: PlayerStatistics;
  showSeason?: boolean;
}

export const PlayerStatisticsCard: React.FC<PlayerStatisticsCardProps> = ({ 
  statistics, 
  showSeason = true 
}) => {
  const colors = useColors();

  // Calculate win ratio for visual indicator
  const winRatio = statistics.WinPercentage / 100;
  
  // Determine performance level
  const getPerformanceLevel = (winPercentage: number) => {
    if (winPercentage >= 80) return { level: 'Excellent', color: colors.success, icon: 'trophy' };
    if (winPercentage >= 60) return { level: 'Good', color: colors.primary, icon: 'thumbs-up' };
    if (winPercentage >= 40) return { level: 'Average', color: '#FF9800', icon: 'remove-circle' };
    return { level: 'Needs Work', color: colors.error, icon: 'trending-down' };
  };

  const performance = getPerformanceLevel(statistics.WinPercentage);

  const styles = createStyles(colors);

  return (
    <View style={styles.container}>
      {/* Header */}
      {showSeason && (
        <View style={styles.header}>
          <Text style={styles.seasonText}>Season {statistics.Season}</Text>
          <View style={[styles.performanceBadge, { backgroundColor: performance.color }]}>
            <Ionicons name={performance.icon} size={12} color="white" />
            <Text style={styles.performanceText}>{performance.level}</Text>
          </View>
        </View>
      )}

      {/* Statistics Grid */}
      <View style={styles.statsGrid}>
        {/* Total Matches */}
        <View style={styles.statItem}>
          <Text style={styles.statLabel}>Matches</Text>
          <Text style={styles.statValue}>{statistics.TotalMatches}</Text>
        </View>

        {/* Wins */}
        <View style={styles.statItem}>
          <Text style={styles.statLabel}>Wins</Text>
          <Text style={[styles.statValue, { color: colors.success }]}>
            {statistics.MatchesWon}
          </Text>
        </View>

        {/* Losses */}
        <View style={styles.statItem}>
          <Text style={styles.statLabel}>Losses</Text>
          <Text style={[styles.statValue, { color: colors.error }]}>
            {statistics.MatchesLost}
          </Text>
        </View>

        {/* Win Percentage */}
        <View style={styles.statItem}>
          <Text style={styles.statLabel}>Win %</Text>
          <Text style={[styles.statValue, { color: performance.color }]}>
            {statistics.WinPercentage.toFixed(1)}%
          </Text>
        </View>
      </View>

      {/* Win Percentage Bar */}
      <View style={styles.progressContainer}>
        <View style={styles.progressTrack}>
          <View 
            style={[
              styles.progressFill, 
              { 
                width: `${statistics.WinPercentage}%`,
                backgroundColor: performance.color 
              }
            ]} 
          />
        </View>
        <Text style={styles.progressText}>
          {statistics.MatchesWon}/{statistics.TotalMatches} wins
        </Text>
      </View>

      {/* Average Score */}
      <View style={styles.averageScore}>
        <Ionicons name="bar-chart" size={16} color={colors.textSecondary} />
        <Text style={styles.averageScoreText}>
          Avg Score: {statistics.AverageScore.toFixed(1)}
        </Text>
      </View>
    </View>
  );
};

const createStyles = (colors: any) => StyleSheet.create({
  container: {
    backgroundColor: colors.cardBackground,
    borderRadius: 12,
    padding: 16,
    marginVertical: 8,
    marginHorizontal: 16,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  seasonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.textPrimary,
  },
  performanceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  performanceText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
    marginLeft: 4,
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  statLabel: {
    fontSize: 12,
    color: colors.textSecondary,
    marginBottom: 4,
  },
  statValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.textPrimary,
  },
  progressContainer: {
    marginBottom: 12,
  },
  progressTrack: {
    height: 6,
    backgroundColor: colors.cardBorder,
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 4,
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  progressText: {
    fontSize: 12,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  averageScore: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  averageScoreText: {
    fontSize: 14,
    color: colors.textSecondary,
    marginLeft: 4,
  },
});
```

**Key Concepts Explained:**

- **React.FC**: TypeScript type for functional components
- **Props interface**: Defines what data component expects
- **Conditional rendering**: `{showSeason && <View>...}</View>`
- **Dynamic styles**: `{ color: performance.color }`
- **StyleSheet.create**: Creates optimized styles for React Native

### **Step 4: Create Main Screen (screens/)**

```typescript
// In FrontMaxBreak/app/player/PlayerStatisticsScreen.tsx

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { usePlayerStatistics } from './hooks/usePlayerStatistics';
import { PlayerStatisticsCard } from './components/PlayerStatisticsCard';
import { useColors } from '../../contexts/ThemeContext';
import { logger } from '../../utils/logger';

export default function PlayerStatisticsScreen() {
  const { playerId } = useLocalSearchParams<{ playerId: string }>();
  const router = useRouter();
  const colors = useColors();
  
  // Convert playerId to number
  const playerIdNumber = parseInt(playerId || '0', 10);
  
  // Get player statistics using our custom hook
  const { statistics, loading, error, refetch } = usePlayerStatistics(playerIdNumber);
  
  // State for refresh control
  const [refreshing, setRefreshing] = useState(false);

  // Handle refresh
  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await refetch();
    } catch (error) {
      logger.error('[PlayerStatisticsScreen] Refresh failed:', error);
    } finally {
      setRefreshing(false);
    }
  };

  // Handle back navigation
  const handleGoBack = () => {
    router.back();
  };

  const styles = createStyles(colors);

  // Loading state
  if (loading && !refreshing) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={handleGoBack} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.title}>Player Statistics</Text>
        </View>
        
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading Statistics...</Text>
        </View>
      </SafeAreaView>
    );
  }

  // Error state
  if (error && !refreshing) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={handleGoBack} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.title}>Player Statistics</Text>
        </View>
        
        <View style={styles.centerContent}>
          <Ionicons name="alert-circle-outline" size={48} color={colors.error} />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={refetch}>
            <Text style={styles.retryText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleGoBack} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.title}>Player Statistics</Text>
      </View>

      {/* Content */}
      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Statistics Cards */}
        {statistics.length > 0 ? (
          <>
            {/* Summary */}
            <View style={styles.summaryContainer}>
              <Text style={styles.summaryTitle}>Career Overview</Text>
              <Text style={styles.summaryText}>
                {statistics.length} season{statistics.length !== 1 ? 's' : ''} of data
              </Text>
            </View>

            {/* Statistics by Season */}
            {statistics.map((seasonStats) => (
              <PlayerStatisticsCard
                key={`${seasonStats.Season}-${seasonStats.id}`}
                statistics={seasonStats}
                showSeason={true}
              />
            ))}
          </>
        ) : (
          <View style={styles.emptyContainer}>
            <Ionicons name="stats-chart-outline" size={48} color={colors.textSecondary} />
            <Text style={styles.emptyText}>No statistics available</Text>
            <Text style={styles.emptySubtext}>
              Statistics will appear here once this player has completed matches.
            </Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const createStyles = (colors: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.cardBorder,
  },
  backButton: {
    marginRight: 16,
    padding: 8,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.textPrimary,
  },
  scrollView: {
    flex: 1,
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
    color: colors.textSecondary,
  },
  errorText: {
    marginTop: 12,
    fontSize: 16,
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
    fontWeight: 'bold',
    color: 'white',
  },
  summaryContainer: {
    padding: 16,
    backgroundColor: colors.cardBackground,
    margin: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  summaryTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.textPrimary,
    marginBottom: 4,
  },
  summaryText: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    marginTop: 12,
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.textSecondary,
  },
  emptySubtext: {
    marginTop: 8,
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    paddingHorizontal: 40,
  },
});
```

---

## 🧪 Testing Your Feature

### **Backend Testing**

```bash
# Test your API endpoints
python manage.py shell -c "
from django.test import Client
import json

client = Client()

# Test player statistics endpoint
response = client.get('/oneFourSeven/players/5/statistics/')
print(f'Player stats: {response.status_code}')
if response.status_code == 200:
    data = json.loads(response.content.decode('utf-8'))
    print(f'Found {len(data[\"statistics\"])} seasons of data')

# Test season statistics endpoint
response = client.get('/oneFourSeven/statistics/season/2025/')
print(f'Season stats: {response.status_code}')
if response.status_code == 200:
    data = json.loads(response.content.decode('utf-8'))
    print(f'Found {len(data[\"players\"])} players')
"
```

### **Frontend Testing**

1. **Run the app**: `npx expo start`
2. **Navigate to your new screen**
3. **Check for errors in console**
4. **Test different scenarios**: Loading, error states, empty data

---

## 📚 Common Patterns and Best Practices

### **Always Follow This Pattern**

```
1. Model (Database) → 2. Mapper (Process) → 3. Saver (Store) → 
4. Serializer (Format) → 5. View (API) → 6. Service (Frontend API) → 
7. Hook (State) → 8. Component (Display)
```

### **Error Handling Best Practices**

```typescript
// Always wrap API calls in try/catch
try {
  const data = await apiCall();
  return data;
} catch (error) {
  logger.error('API call failed:', error);
  throw new Error('User-friendly error message');
}
```

### **State Management Best Practices**

```typescript
// Always provide loading and error states
const [data, setData] = useState(null);
const [loading, setLoading] = useState(true);
const [error, setError] = useState(null);
```

### **Database Best Practices**

```python
# Always use get_or_create to prevent duplicates
obj, created = Model.objects.get_or_create(
    unique_field=value,
    defaults={'other_field': other_value}
)
```

---

## 🚨 Troubleshooting Guide

### **Common Backend Issues**

1. **Migration Error**: Run `python manage.py makemigrations` then `python manage.py migrate`
2. **Import Error**: Check file paths and make sure all imports are correct
3. **Database Error**: Check model field types and constraints
4. **API 500 Error**: Check Django logs for detailed error message

### **Common Frontend Issues**

1. **Import Error**: Check file paths and export/import statements
2. **Hook Error**: Make sure you're calling hooks inside components
3. **State Error**: Check if you're updating state correctly
4. **Navigation Error**: Verify route names and parameters

### **Debugging Steps**

1. **Check logs**: Always check console/logs for error messages
2. **Use debugger**: Add `console.log()` or `print()` statements
3. **Test endpoints**: Use Django shell or Postman to test APIs
4. **Check data flow**: Verify data is flowing correctly through all layers

---

## 🎯 Summary

You now know how to add any feature to the snooker app! Remember the key steps:

1. **Plan your feature** (what data, what screens)
2. **Backend first** (model → mapper → saver → serializer → view → URL)
3. **Frontend second** (service → hook → component → screen)
4. **Test everything** (API endpoints and UI)
5. **Follow patterns** (consistent structure and error handling)

**Next Steps:**
- Try adding a simple feature using this guide
- Experiment with the existing code
- Read through the actual implementation files
- Ask questions when you get stuck!

Remember: Programming is like building with LEGO blocks. Once you understand the basic pieces (models, views, components), you can build anything! 🎯