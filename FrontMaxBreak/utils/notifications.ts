// utils/notifications.ts
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { logger } from './logger';
import { getOrCreateDeviceId } from './deviceIdentity';
import { api } from '../services/api';

// Configure notification behavior
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

interface MatchNotificationOptions {
  matchId: string;
  player1: string;
  player2: string;
  minutesUntilStart: number;
  tournamentName?: string;
}

export class NotificationManager {
  private static instance: NotificationManager;
  private notificationPermission: boolean = false;
  private scheduledNotifications: Map<string, string> = new Map(); // matchId -> notificationId

  public static getInstance(): NotificationManager {
    if (!NotificationManager.instance) {
      NotificationManager.instance = new NotificationManager();
    }
    return NotificationManager.instance;
  }

  // Request notification permissions
  async requestPermissions(): Promise<boolean> {
    try {
      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('match-updates', {
          name: 'Match Updates',
          importance: Notifications.AndroidImportance.HIGH,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#FFA726',
        });
      }

      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;
      
      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }
      
      this.notificationPermission = finalStatus === 'granted';
      logger.log(`[Notifications] Permission status: ${finalStatus}`);
      
      return this.notificationPermission;
    } catch (error) {
      logger.error('[Notifications] Error requesting permissions:', error);
      return false;
    }
  }

  // Schedule notification for match starting soon
  async scheduleMatchStartingSoon(options: MatchNotificationOptions): Promise<void> {
    if (!this.notificationPermission) {
      logger.warn('[Notifications] No permission to send notifications');
      return;
    }

    const { matchId, player1, player2, minutesUntilStart, tournamentName } = options;
    
    // Cancel existing notification for this match
    await this.cancelMatchNotification(matchId);
    
    const notificationContent = {
      title: `🔥 Match Starting ${minutesUntilStart <= 1 ? 'Now!' : `in ${minutesUntilStart} min`}`,
      body: `${player1} vs ${player2}${tournamentName ? ` • ${tournamentName}` : ''}`,
      data: { 
        matchId, 
        type: 'match_starting',
        player1,
        player2,
        tournamentName 
      },
    };

    try {
      if (minutesUntilStart <= 1) {
        // Send immediate notification
        const notificationId = await Notifications.scheduleNotificationAsync({
          content: notificationContent,
          trigger: null, // Immediate
        });
        
        this.scheduledNotifications.set(matchId, notificationId);
        logger.log(`[Notifications] Sent immediate notification for match ${matchId}`);
      } else {
        // Schedule for future
        const triggerSeconds = Math.max(1, minutesUntilStart * 60); // At least 1 second
        
        const notificationId = await Notifications.scheduleNotificationAsync({
          content: notificationContent,
          trigger: { 
            type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
            seconds: triggerSeconds 
          },
        });
        
        this.scheduledNotifications.set(matchId, notificationId);
        logger.log(`[Notifications] Scheduled notification for match ${matchId} in ${triggerSeconds} seconds`);
      }
    } catch (error) {
      logger.error('[Notifications] Error scheduling match notification:', error);
    }
  }

  // Send immediate live match notification
  async sendLiveMatchUpdate(options: {
    player1: string;
    player2: string;
    score1: number;
    score2: number;
    tournamentName?: string;
  }): Promise<void> {
    if (!this.notificationPermission) return;

    const { player1, player2, score1, score2, tournamentName } = options;
    
    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: '🔴 Live Match Update',
          body: `${player1} ${score1}-${score2} ${player2}${tournamentName ? ` • ${tournamentName}` : ''}`,
          data: { 
            type: 'live_update',
            player1,
            player2,
            score1,
            score2,
            tournamentName 
          },
        },
        trigger: null, // Immediate
      });
      
      logger.log(`[Notifications] Sent live update: ${player1} ${score1}-${score2} ${player2}`);
    } catch (error) {
      logger.error('[Notifications] Error sending live update notification:', error);
    }
  }

  // Cancel notification for specific match
  async cancelMatchNotification(matchId: string): Promise<void> {
    const existingNotificationId = this.scheduledNotifications.get(matchId);
    if (existingNotificationId) {
      try {
        await Notifications.cancelScheduledNotificationAsync(existingNotificationId);
        this.scheduledNotifications.delete(matchId);
        logger.log(`[Notifications] Cancelled notification for match ${matchId}`);
      } catch (error) {
        logger.error('[Notifications] Error cancelling notification:', error);
      }
    }
  }

  // Cancel all scheduled notifications
  async cancelAllNotifications(): Promise<void> {
    try {
      await Notifications.cancelAllScheduledNotificationsAsync();
      this.scheduledNotifications.clear();
      logger.log('[Notifications] Cancelled all scheduled notifications');
    } catch (error) {
      logger.error('[Notifications] Error cancelling all notifications:', error);
    }
  }

  // Get scheduled notifications count
  getScheduledNotificationsCount(): number {
    return this.scheduledNotifications.size;
  }
}

// Export singleton instance
export const notificationManager = NotificationManager.getInstance();

// ---- Push notification registration (for server-sent notifications) ----

/**
 * Request push permission and return the Expo push token string, or null on failure.
 */
export async function requestPushPermissionAndGetToken(): Promise<string | null> {
    if (!Device.isDevice) {
        logger.warn('[Push] Push notifications only work on physical devices');
        return null;
    }

    try {
        if (Platform.OS === 'android') {
            await Notifications.setNotificationChannelAsync('match-updates', {
                name: 'Match Updates',
                importance: Notifications.AndroidImportance.HIGH,
                vibrationPattern: [0, 250, 250, 250],
                lightColor: '#FFA726',
            });
        }

        const { status: existingStatus } = await Notifications.getPermissionsAsync();
        let finalStatus = existingStatus;

        if (existingStatus !== 'granted') {
            const { status } = await Notifications.requestPermissionsAsync();
            finalStatus = status;
        }

        if (finalStatus !== 'granted') {
            logger.warn('[Push] Permission not granted');
            return null;
        }

        const tokenData = await Notifications.getExpoPushTokenAsync({
            projectId: 'f7e50a46-3a59-4341-af3c-06828f5eb7bd',
        });
        logger.log('[Push] Got push token');
        return tokenData.data;
    } catch (error) {
        logger.error('[Push] Error getting push token:', error);
        return null;
    }
}

/**
 * Initialize push notifications: get device ID + push token, register with backend.
 * Called once on app startup. Never throws.
 */
export async function initPushNotifications(): Promise<void> {
    try {
        const deviceId = await getOrCreateDeviceId();
        const pushToken = await requestPushPermissionAndGetToken();

        if (!pushToken) return;

        await api.post('device/register/', { device_id: deviceId, push_token: pushToken });
        logger.log('[Push] Device registered successfully');
    } catch (error) {
        logger.error('[Push] Failed to initialize push notifications:', error);
    }
}