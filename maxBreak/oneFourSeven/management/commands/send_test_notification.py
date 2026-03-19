# management/commands/send_test_notification.py
"""
Manual test command for push notifications.
Usage: python manage.py send_test_notification --device-id <uuid>
"""

from django.core.management.base import BaseCommand
from oneFourSeven.models import DeviceToken
from oneFourSeven.push_notifications import send_expo_push


class Command(BaseCommand):
    help = 'Send a test push notification to a specific device'

    def add_arguments(self, parser):
        parser.add_argument(
            '--device-id',
            required=True,
            help='The device UUID to send the test notification to',
        )

    def handle(self, *args, **options):
        device_id = options['device_id']

        try:
            device = DeviceToken.objects.get(device_id=device_id)
        except DeviceToken.DoesNotExist:
            self.stdout.write(f'[ERROR] Device not found: {device_id}')
            self.stdout.write('[INFO] Use GET /device/favorites/?device_id=... to verify registration')
            return

        self.stdout.write(f'[INFO] Sending test notification to device {device_id[:8]}...')
        self.stdout.write(f'[INFO] Push token: {device.push_token[:30]}...')
        self.stdout.write(f'[INFO] Favourite players: {device.favorite_player_ids}')
        self.stdout.write(f'[INFO] Favourite matches: {device.favorite_match_ids}')

        send_expo_push(
            [device.push_token],
            '🎱 MaxBreak Test',
            'Push notifications are working!',
            {'type': 'test'},
        )

        self.stdout.write(f'[SUCCESS] Test notification sent to device {device_id[:8]}...')
