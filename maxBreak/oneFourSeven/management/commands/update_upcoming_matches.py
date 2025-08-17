from django.core.management.base import BaseCommand
import requests
import json
from datetime import datetime, timedelta
from oneFourSeven.models import UpcomingMatch
from django.utils import timezone

class Command(BaseCommand):
    help = 'Fetch upcoming matches from snooker.org API as fallback when no active tournaments'

    def add_arguments(self, parser):
        parser.add_argument(
            '--tour',
            type=str,
            default='main',
            help='Tour type: main, womens, seniors, or all (default: main)'
        )
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Show what would be updated without making changes'
        )
        parser.add_argument(
            '--force',
            action='store_true',
            help='Force update even if recent data exists'
        )

    def handle(self, *args, **options):
        tour = options['tour']
        dry_run = options['dry_run']
        force = options['force']

        self.stdout.write(f"Fetching upcoming matches for {tour} tour...")
        
        # Check if we need to update (don't update if recent data exists)
        if not force:
            recent_data = UpcomingMatch.objects.filter(
                created_at__gte=timezone.now() - timedelta(hours=2)
            ).exists()
            
            if recent_data:
                self.stdout.write(
                    self.style.WARNING('Recent upcoming matches data exists (< 2 hours old). Use --force to update anyway.')
                )
                return

        try:
            # Fetch from snooker.org API
            headers = {'X-Requested-By': 'FahimaApp128'}
            base_url = 'https://api.snooker.org/'
            
            # Build URL for upcoming matches (t=14)
            api_url = f"{base_url}?t=14"
            if tour and tour != 'all':
                api_url += f"&tr={tour}"
            
            self.stdout.write(f"Requesting: {api_url}")
            
            response = requests.get(api_url, headers=headers, timeout=30)
            response.raise_for_status()
            
            data = response.json()
            
            if not isinstance(data, list):
                self.stdout.write(
                    self.style.ERROR(f'Invalid response format: expected list, got {type(data)}')
                )
                return
            
            if dry_run:
                self.stdout.write(f"DRY RUN: Would process {len(data)} upcoming matches")
                for i, match in enumerate(data[:5]):  # Show first 5
                    self.stdout.write(f"  Match {i+1}: {match.get('Player1', 'TBD')} vs {match.get('Player2', 'TBD')}")
                    self.stdout.write(f"    Event: {match.get('EventName', 'Unknown')}")
                    self.stdout.write(f"    Date: {match.get('ScheduledDate', 'TBD')}")
                return

            # Clear old upcoming matches for this tour
            deleted_count = UpcomingMatch.objects.filter(tour_type=tour).delete()[0]
            self.stdout.write(f"Cleared {deleted_count} old upcoming matches for {tour} tour")

            # Process and save new matches
            created_count = 0
            now = timezone.now()
            
            for match_data in data:
                try:
                    # Parse scheduled date
                    scheduled_date = None
                    if match_data.get('ScheduledDate'):
                        try:
                            scheduled_date = datetime.fromisoformat(
                                match_data['ScheduledDate'].replace('Z', '+00:00')
                            )
                        except (ValueError, TypeError):
                            self.stdout.write(
                                self.style.WARNING(f"Invalid date format: {match_data.get('ScheduledDate')}")
                            )

                    # Create UpcomingMatch object
                    upcoming_match = UpcomingMatch.objects.create(
                        api_match_id=match_data.get('ID', 0),
                        event_id=match_data.get('EventID', 0),
                        event_name=match_data.get('EventName', 'Unknown Event'),
                        round_number=match_data.get('Round', 0),
                        match_number=match_data.get('Number', 0),
                        player1_id=match_data.get('Player1ID', 0),
                        player2_id=match_data.get('Player2ID', 0),
                        player1_name=match_data.get('Player1', 'Player 1'),
                        player2_name=match_data.get('Player2', 'Player 2'),
                        score1=match_data.get('Score1'),
                        score2=match_data.get('Score2'),
                        winner_id=match_data.get('WinnerID'),
                        status=match_data.get('Status', 0),
                        scheduled_date=scheduled_date,
                        tour_type=tour,
                        raw_data=json.dumps(match_data),
                        created_at=now,
                        updated_at=now
                    )
                    created_count += 1
                    
                except Exception as e:
                    self.stdout.write(
                        self.style.ERROR(f"Error processing match {match_data.get('ID', 'unknown')}: {e}")
                    )
                    continue

            self.stdout.write(
                self.style.SUCCESS(f'Successfully created {created_count} upcoming matches for {tour} tour')
            )

            # Show some statistics
            total_upcoming = UpcomingMatch.objects.filter(tour_type=tour).count()
            today = timezone.now().date()
            todays_matches = UpcomingMatch.objects.filter(
                tour_type=tour,
                scheduled_date__date=today
            ).count()
            
            self.stdout.write(f"Statistics:")
            self.stdout.write(f"  Total upcoming matches: {total_upcoming}")
            self.stdout.write(f"  Today's matches: {todays_matches}")

        except requests.RequestException as e:
            self.stdout.write(
                self.style.ERROR(f'Failed to fetch upcoming matches: {e}')
            )
        except Exception as e:
            self.stdout.write(
                self.style.ERROR(f'Unexpected error: {e}')
            )