# management/commands/send_test_notification.py
"""
Manual push notification command.

Send basic test to one device (original behavior):
  python manage.py send_test_notification --device-id <uuid>

Preview the broadcast message on your device before sending to everyone:
  python manage.py send_test_notification --device-id <uuid> --preview

Broadcast to all users:
  python manage.py send_test_notification --broadcast
  python manage.py send_test_notification --broadcast --title "New" --body "Check it out"
"""

from django.core.management.base import BaseCommand
from oneFourSeven.models import DeviceToken
from oneFourSeven.push_notifications import send_expo_push

ANNOUNCE_TITLE = '🎱 World Championship is LIVE!'
ANNOUNCE_BODY = 'Pick your favourite player, mark matches for alerts & use H2H in Stats to compare players'


class Command(BaseCommand):
    help = 'Send a push notification to a specific device or broadcast to all users'

    def add_arguments(self, parser):
        parser.add_argument('--device-id', help='The device UUID to send the notification to')
        parser.add_argument('--preview', action='store_true', help='Send the broadcast message to --device-id only (preview before sending to everyone)')
        parser.add_argument('--broadcast', action='store_true', help='Send to all registered devices')
        parser.add_argument('--title', default=ANNOUNCE_TITLE, help='Notification title (broadcast/preview)')
        parser.add_argument('--body', default=ANNOUNCE_BODY, help='Notification body (broadcast/preview)')

    def handle(self, *args, **options):
        if options['broadcast']:
            tokens = list(
                DeviceToken.objects.exclude(push_token='')
                .values_list('push_token', flat=True)
                .distinct()
            )
            if not tokens:
                self.stdout.write('[INFO] No registered devices found')
                return
            self.stdout.write(f'[INFO] Broadcasting to {len(tokens)} devices...')
            self.stdout.write(f'[INFO] Title: {options["title"]}')
            self.stdout.write(f'[INFO] Body:  {options["body"]}')
            send_expo_push(tokens, options['title'], options['body'], {'type': 'announcement'})
            self.stdout.write(f'[SUCCESS] Broadcast sent to {len(tokens)} devices')
            return

        device_id = options.get('device_id')
        if not device_id:
            self.stdout.write('[ERROR] Provide --device-id, --device-id --preview, or --broadcast')
            return

        try:
            device = DeviceToken.objects.get(device_id=device_id)
        except DeviceToken.DoesNotExist:
            self.stdout.write(f'[ERROR] Device not found: {device_id}')
            self.stdout.write('[INFO] Use GET /device/favorites/?device_id=... to verify registration')
            return

        if options['preview']:
            # Send the real broadcast message to this device only
            self.stdout.write(f'[PREVIEW] Sending broadcast message to device {device_id[:8]}...')
            send_expo_push([device.push_token], options['title'], options['body'], {'type': 'announcement'})
            self.stdout.write('[PREVIEW] Done — if it looks good, run --broadcast')
        else:
            # Original test behavior — unchanged
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
