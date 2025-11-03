// app/match/components/H2HTab.tsx
import React from 'react';
import { View, Text, ScrollView, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ProgressBar } from '../../components/modern';
import { H2HData } from '../types';

interface H2HTabProps {
  h2hData: H2HData | null;
  h2hLoading: boolean;
  p1Name: string;
  p2Name: string;
  styles: any;
}

export function H2HTab({ h2hData, h2hLoading, p1Name, p2Name, styles }: H2HTabProps) {
  return (
    <ScrollView showsVerticalScrollIndicator={false}>
      <View style={styles.h2hCard}>
        <Text style={styles.h2hTitle}>Head to Head</Text>
        <Text style={styles.h2hSubtitle}>
          {`${p1Name} vs ${p2Name} - Historical meetings`}
        </Text>
        
        {h2hLoading ? (
          <View style={styles.h2hLoading}>
            <ActivityIndicator size="large" color="#FFA726" />
            <Text style={styles.h2hLoadingText}>Loading H2H data...</Text>
          </View>
        ) : h2hData ? (
          <>
            <View style={styles.h2hStats}>
              <View style={styles.h2hStatItem}>
                <Text style={styles.h2hStatNumber}>
                  {h2hData.totalMeetings}
                </Text>
                <Text style={styles.h2hStatLabel}>Previous Meetings</Text>
              </View>
              
              <View style={styles.h2hStatItem}>
                <Text style={styles.h2hStatNumber}>
                  {h2hData.totalMeetings > 0 
                    ? `${h2hData.Player1Wins}-${h2hData.Player2Wins}`
                    : '0-0'
                  }
                </Text>
                <Text style={styles.h2hStatLabel}>Head to Head</Text>
              </View>
              
              <View style={styles.h2hStatItem}>
                <Text style={styles.h2hStatNumber}>
                  {h2hData.Player1Wins > h2hData.Player2Wins 
                    ? p1Name.split(' ').pop() || 'P1'
                    : h2hData.Player2Wins > h2hData.Player1Wins
                    ? p2Name.split(' ').pop() || 'P2'
                    : 'Even'
                  }
                </Text>
                <Text style={styles.h2hStatLabel}>Leads</Text>
              </View>
            </View>

            {h2hData.totalMeetings > 0 ? (
              <View style={styles.h2hDetails}>
                <Text style={styles.h2hDetailsTitle}>Recent Meetings</Text>
                
                <View style={styles.h2hPlayersContainer}>
                  <View style={styles.h2hPlayerStat}>
                    <Text style={styles.h2hPlayerName}>{p1Name}</Text>
                    <Text style={styles.h2hPlayerWins}>{h2hData.Player1Wins} wins</Text>
                    <Text style={styles.h2hPlayerPercentage}>
                      {h2hData.totalMeetings > 0 
                        ? `${Math.round((h2hData.Player1Wins / h2hData.totalMeetings) * 100)}%`
                        : '0%'
                      }
                    </Text>
                  </View>
                  
                  <View style={styles.h2hVs}>
                    <Text style={styles.h2hVsText}>VS</Text>
                  </View>
                  
                  <View style={styles.h2hPlayerStat}>
                    <Text style={styles.h2hPlayerName}>{p2Name}</Text>
                    <Text style={styles.h2hPlayerWins}>{h2hData.Player2Wins} wins</Text>
                    <Text style={styles.h2hPlayerPercentage}>
                      {h2hData.totalMeetings > 0 
                        ? `${Math.round((h2hData.Player2Wins / h2hData.totalMeetings) * 100)}%`
                        : '0%'
                      }
                    </Text>
                  </View>
                </View>

                <ProgressBar
                  progress={h2hData.totalMeetings > 0 ? h2hData.Player1Wins / h2hData.totalMeetings : 0.5}
                  height={8}
                  colors={['#4CAF50', '#FFA726']}
                  label={`${p1Name} vs ${p2Name} win percentage`}
                  showPercentage={false}
                />
              </View>
            ) : (
              <View style={styles.h2hEmpty}>
                <Ionicons name="people-outline" size={48} color="#9CA3AF" />
                <Text style={styles.h2hEmptyText}>
                  No previous meetings found between these players
                </Text>
                <Text style={styles.h2hEmptySubtext}>
                  This could be their first encounter!
                </Text>
              </View>
            )}
          </>
        ) : (
          <View style={styles.h2hEmpty}>
            <Ionicons name="alert-circle-outline" size={48} color="#9CA3AF" />
            <Text style={styles.h2hEmptyText}>
              Unable to load H2H data
            </Text>
          </View>
        )}
      </View>
    </ScrollView>
  );
}