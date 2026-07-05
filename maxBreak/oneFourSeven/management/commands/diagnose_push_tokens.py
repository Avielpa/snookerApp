# management/commands/diagnose_push_tokens.py
"""
Read-only diagnostic: reports how many devices actually have a valid,
error-free push token registered, and breaks down why the rest don't.

  python manage.py diagnose_push_tokens
"""

from collections import Counter
from django.core.management.base import BaseCommand
from django.utils import timezone
from oneFourSeven.models import DeviceToken


class Command(BaseCommand):
    help = 'Read-only report on DeviceToken push registration health'

    def handle(self, *args, **options):
        total = DeviceToken.objects.count()
        with_token = DeviceToken.objects.exclude(push_token='').count()
        with_error = DeviceToken.objects.exclude(push_error='').count()
        healthy = DeviceToken.objects.exclude(push_token='').filter(push_error='').count()

        self.stdout.write(f'Total registered devices:        {total}')
        self.stdout.write(f'Devices with a push token:       {with_token}')
        self.stdout.write(f'Devices with a push_error set:   {with_error}')
        self.stdout.write(f'Healthy (token, no error):       {healthy}')
        self.stdout.write('')

        if with_error:
            self.stdout.write('Error breakdown (first word of each error message):')
            errors = DeviceToken.objects.exclude(push_error='').values_list('push_error', flat=True)
            counts = Counter(e.split(':', 1)[0].strip() for e in errors)
            for err, count in counts.most_common(10):
                self.stdout.write(f'  {count:>4}  {err}')
            self.stdout.write('')

        recent_cutoff = timezone.now() - timezone.timedelta(days=30)
        recently_updated = DeviceToken.objects.filter(updated_at__gte=recent_cutoff).count()
        self.stdout.write(f'Devices updated in the last 30 days: {recently_updated}')

        never_registered_token = DeviceToken.objects.filter(push_token='', push_error='').count()
        if never_registered_token:
            self.stdout.write(f'Devices with neither token nor error (never attempted): {never_registered_token}')
