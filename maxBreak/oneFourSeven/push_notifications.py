# oneFourSeven/push_notifications.py
"""
Expo Push Notification helper.
Batches messages to Expo's push API in groups of 100.
Never raises — all errors are caught and logged.
"""

import logging
import requests

logger = logging.getLogger(__name__)

EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send'


def send_expo_push(tokens, title, body, data=None):
    """
    Send Expo push notifications to a list of push tokens.

    Args:
        tokens: list of Expo push token strings
        title: notification title
        body: notification body text
        data: optional dict of extra data sent to the app
    """
    if not tokens:
        return
    if data is None:
        data = {}

    try:
        for i in range(0, len(tokens), 100):
            batch = tokens[i:i + 100]
            messages = [
                {
                    'to': token,
                    'title': title,
                    'body': body,
                    'data': data,
                    'sound': 'default',
                }
                for token in batch
            ]
            response = requests.post(
                EXPO_PUSH_URL,
                json=messages,
                headers={
                    'Accept': 'application/json',
                    'Accept-Encoding': 'gzip, deflate',
                    'Content-Type': 'application/json',
                },
                timeout=10,
            )
            response.raise_for_status()
            logger.info(f'[PUSH] Sent {len(batch)} push notifications: "{title}"')
    except Exception as e:
        logger.error(f'[PUSH] Failed to send push notifications: {e}')
