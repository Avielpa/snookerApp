"""
Debug script to investigate why Championship League events are missing.
Run this with: python manage.py shell < debug_championship_league.py
"""
from oneFourSeven.models import Event
from oneFourSeven.constants import ALLOWED_EVENT_TYPES, EXCLUDED_EVENT_NAME_PATTERNS
import json


print("=" * 80)
print("CHAMPIONSHIP LEAGUE DEBUGGING REPORT")
print("=" * 80)

# Step 1: Check current filter configuration
print("\n📋 CURRENT FILTER CONFIGURATION:")
print(f"   ALLOWED_EVENT_TYPES: {ALLOWED_EVENT_TYPES}")
print(f"   EXCLUDED_EVENT_NAME_PATTERNS: {EXCLUDED_EVENT_NAME_PATTERNS}")

# Step 2: Check if Championship League events exist in database
print("\n🔍 SEARCHING DATABASE FOR CHAMPIONSHIP LEAGUE EVENTS:")
championship_events = Event.objects.filter(Name__icontains='Championship League')
print(f"   Found {championship_events.count()} events in database")

if championship_events.exists():
    print("\n   Events found:")
    for event in championship_events[:10]:
        print(f"   - ID: {event.ID}")
        print(f"     Name: {event.Name}")
        print(f"     Type: {event.Type}")
        print(f"     Start: {event.StartDate}")
        print(f"     End: {event.EndDate}")

        # Check if it would be filtered
        type_allowed = event.Type in ALLOWED_EVENT_TYPES
        name_excluded = any(pattern in event.Name for pattern in EXCLUDED_EVENT_NAME_PATTERNS)

        print(f"     ✓ Type allowed? {type_allowed} (Type='{event.Type}')")
        print(f"     ✗ Name excluded? {name_excluded}")

        if not type_allowed:
            print(f"     ❌ FILTERED OUT: Type '{event.Type}' not in {ALLOWED_EVENT_TYPES}")
        if name_excluded:
            print(f"     ❌ FILTERED OUT: Name contains excluded pattern")
        if type_allowed and not name_excluded:
            print(f"     ✅ SHOULD BE VISIBLE")
        print()
else:
    print("   ❌ NO Championship League events found in database!")
    print("\n   This means the events are NOT being saved to the database.")
    print("   Possible reasons:")
    print("   1. Scraper hasn't run yet")
    print("   2. Events are being filtered BEFORE saving to database")
    print("   3. API is not returning these events")

# Step 3: Check all event types in database
print("\n📊 ALL EVENT TYPES IN DATABASE:")
all_types = Event.objects.values_list('Type', flat=True).distinct()
for event_type in all_types:
    count = Event.objects.filter(Type=event_type).count()
    allowed = "✅ ALLOWED" if event_type in ALLOWED_EVENT_TYPES else "❌ FILTERED"
    print(f"   {event_type}: {count} events - {allowed}")

# Step 4: Check upcoming events
print("\n📅 UPCOMING EVENTS (next 30 days):")
from datetime import datetime, timedelta
from django.utils import timezone
today = timezone.now().date()
next_month = today + timedelta(days=30)

upcoming = Event.objects.filter(
    StartDate__gte=today,
    StartDate__lte=next_month
).order_by('StartDate')[:10]

print(f"   Found {upcoming.count()} upcoming events")
for event in upcoming:
    print(f"   - {event.StartDate}: {event.Name} (Type: {event.Type})")

print("\n" + "=" * 80)
print("END OF REPORT")
print("=" * 80)
