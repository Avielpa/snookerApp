# oneFourSeven/push_notifications.py
"""
Expo Push Notification helper.
Batches messages to Expo's push API in groups of 100.
Checks push receipts ~30s after send and marks dead tokens with push_error.
Never raises — all errors are caught and logged.
"""

import logging
import threading
import time
import requests

logger = logging.getLogger(__name__)

EXPO_PUSH_URL    = 'https://exp.host/--/api/v2/push/send'
EXPO_RECEIPT_URL = 'https://exp.host/--/api/v2/push/getReceipts'


def get_tokens_for_match(match_id):
    """
    Return a deduplicated list of push tokens for all devices that have
    favorited this match — covers both UUID-only devices and user-linked devices
    whose UserFavorite includes this match.
    """
    from oneFourSeven.models import DeviceToken
    uuid_tokens = set(
        DeviceToken.objects.filter(favorite_match_ids__contains=[match_id])
        .exclude(push_token='').values_list('push_token', flat=True)
    )
    user_tokens = set(
        DeviceToken.objects.filter(
            user__favorites__favorite_match_ids__contains=[match_id]
        ).exclude(push_token='').values_list('push_token', flat=True)
    )
    return list(uuid_tokens | user_tokens)


def get_tokens_for_player(player_id):
    """
    Return a deduplicated list of push tokens for all devices that have
    favorited this player — covers both UUID-only devices and user-linked devices
    whose UserFavorite includes this player.
    """
    from oneFourSeven.models import DeviceToken
    uuid_tokens = set(
        DeviceToken.objects.filter(favorite_player_ids__contains=[player_id])
        .exclude(push_token='').values_list('push_token', flat=True)
    )
    user_tokens = set(
        DeviceToken.objects.filter(
            user__favorites__favorite_player_ids__contains=[player_id]
        ).exclude(push_token='').values_list('push_token', flat=True)
    )
    return list(uuid_tokens | user_tokens)


def send_expo_push(tokens, title, body, data=None):
    if not tokens:
        return
    if data is None:
        data = {}

    all_receipt_ids = []   # collect receipt IDs across all batches

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
                    'channelId': 'match-updates',
                    'android': {
                        'channelId': 'match-updates',
                        'priority': 'high',
                    }
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
            result = response.json()
            # Collect receipt IDs returned by Expo
            for item in result.get('data', []):
                rid = item.get('id')
                if rid:
                    all_receipt_ids.append(rid)
            logger.info(f'[PUSH] Sent {len(batch)} notifications: "{title}"')
    except Exception as e:
        logger.error(f'[PUSH] Failed to send push notifications: {e}')
        return

    # Check receipts in background after 30s — marks dead tokens with push_error
    if all_receipt_ids:
        threading.Thread(
            target=_check_receipts,
            args=(all_receipt_ids,),
            daemon=True,
        ).start()


def _check_receipts(receipt_ids):
    """
    Poll Expo's receipt API 30s after send.
    For any token with status='error', update push_error on the DeviceToken row.
    """
    time.sleep(30)
    try:
        from oneFourSeven.models import DeviceToken

        for i in range(0, len(receipt_ids), 300):
            batch = receipt_ids[i:i + 300]
            response = requests.post(
                EXPO_RECEIPT_URL,
                json={'ids': batch},
                headers={
                    'Accept': 'application/json',
                    'Content-Type': 'application/json',
                },
                timeout=15,
            )
            response.raise_for_status()
            receipts = response.json().get('data', {})

            for receipt_id, receipt in receipts.items():
                if receipt.get('status') == 'error':
                    details = receipt.get('details', {})
                    error   = receipt.get('message', 'unknown error')
                    token   = details.get('expoPushToken', '')
                    if token:
                        DeviceToken.objects.filter(push_token=token).update(
                            push_error=f'receipt:{error}'
                        )
                        logger.warning(f'[PUSH] Dead token marked: {token[:30]}... — {error}')

    except Exception as e:
        logger.error(f'[PUSH] Receipt check failed: {e}')
