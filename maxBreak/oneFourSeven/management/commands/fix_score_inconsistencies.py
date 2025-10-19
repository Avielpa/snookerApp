# management/commands/fix_score_inconsistencies.py
"""
Critical Fix: Repair existing score display inconsistencies in the database.

This command fixes the "Barry Hawkins vs Louis Heathcote" type issues where:
- Winner highlighting is correct (based on WinnerID) 
- But displayed scores are backwards/incorrect

The script identifies and corrects matches where the winner/score data is inconsistent.
"""

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from oneFourSeven.models import MatchesOfAnEvent, Player
import logging

logger = logging.getLogger(__name__)


class Command(BaseCommand):
    help = 'Fix score display inconsistencies where winner highlighting doesn\'t match displayed scores'
    
    def add_arguments(self, parser):
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Show what would be fixed without making changes',
        )
        parser.add_argument(
            '--event-id',
            type=int,
            help='Fix only matches from specific event ID',
        )
        parser.add_argument(
            '--limit',
            type=int,
            default=1000,
            help='Maximum number of matches to process (default: 1000)',
        )

    def handle(self, *args, **options):
        dry_run = options['dry_run']
        event_id = options.get('event_id')
        limit = options['limit']
        
        self.stdout.write(
            self.style.SUCCESS(
                f'🔍 SCORE INCONSISTENCY REPAIR {"(DRY RUN)" if dry_run else "(LIVE)"}' 
            )
        )
        
        # Build queryset
        queryset = MatchesOfAnEvent.objects.filter(
            Status=3,  # Finished matches only
            Score1__isnull=False,
            Score2__isnull=False,
            WinnerID__isnull=False,
            Player1ID__isnull=False,
            Player2ID__isnull=False,
        ).exclude(
            Score1=0, Score2=0  # Skip matches with no actual scores
        ).order_by('-Event__Season', 'Event__StartDate')
        
        if event_id:
            queryset = queryset.filter(Event_id=event_id)
            
        queryset = queryset[:limit]
        
        total_matches = queryset.count()
        inconsistent_matches = []
        fixed_count = 0
        
        self.stdout.write(f'📊 Analyzing {total_matches} finished matches...')
        
        # Find inconsistent matches
        for match in queryset:
            analysis = self._analyze_match_consistency(match)
            if analysis['is_inconsistent']:
                inconsistent_matches.append({
                    'match': match,
                    'analysis': analysis
                })
        
        if not inconsistent_matches:
            self.stdout.write(
                self.style.SUCCESS('✅ No score inconsistencies found! All matches are correct.')
            )
            return
            
        self.stdout.write(
            self.style.WARNING(f'🚨 Found {len(inconsistent_matches)} inconsistent matches:')
        )
        
        # Show details of inconsistent matches
        for item in inconsistent_matches:
            match = item['match']
            analysis = item['analysis']
            
            self.stdout.write(f'\n🔍 Match ID {match.api_match_id} - {match.Event.Name}:')
            self.stdout.write(f'   Current: {analysis["player1_name"]} {match.Score1}-{match.Score2} {analysis["player2_name"]}')
            self.stdout.write(f'   Winner ID: {match.WinnerID} ({analysis["winner_name"]})')
            self.stdout.write(f'   Issue: {analysis["issue_description"]}')
            
            if analysis['suggested_fix']:
                self.stdout.write(f'   Fix: {analysis["suggested_fix"]}')
        
        if dry_run:
            self.stdout.write(
                self.style.WARNING(f'\n🔸 DRY RUN: {len(inconsistent_matches)} matches would be fixed')
            )
            return
            
        # Apply fixes
        if inconsistent_matches:
            confirm = input(f'\n⚠️  Fix {len(inconsistent_matches)} inconsistent matches? (y/N): ')
            if confirm.lower() != 'y':
                self.stdout.write('❌ Operation cancelled')
                return
                
        with transaction.atomic():
            for item in inconsistent_matches:
                match = item['match']
                analysis = item['analysis']
                
                if self._apply_fix(match, analysis):
                    fixed_count += 1
                    
        self.stdout.write(
            self.style.SUCCESS(f'\n✅ COMPLETED: Fixed {fixed_count}/{len(inconsistent_matches)} matches')
        )
        self.stdout.write('🔄 Restart your frontend app to see the fixes!')

    def _analyze_match_consistency(self, match):
        """Analyze a match for score/winner consistency issues."""
        try:
            # Get player names
            player1_name = self._get_player_name(match.Player1ID)
            player2_name = self._get_player_name(match.Player2ID) 
            winner_name = self._get_player_name(match.WinnerID)
            
            # Determine winner by scores
            score_winner_is_player1 = match.Score1 > match.Score2
            score_winner_is_player2 = match.Score2 > match.Score1
            
            # Determine winner by WinnerID
            winner_id_is_player1 = match.WinnerID == match.Player1ID
            winner_id_is_player2 = match.WinnerID == match.Player2ID
            
            # Check for inconsistency
            is_inconsistent = False
            issue_description = ""
            suggested_fix = ""
            
            if score_winner_is_player1 and not winner_id_is_player1:
                is_inconsistent = True
                issue_description = f"Score shows {player1_name} won {match.Score1}-{match.Score2}, but winner ID points to {winner_name}"
                suggested_fix = f"Set WinnerID to {match.Player1ID} ({player1_name})"
                
            elif score_winner_is_player2 and not winner_id_is_player2:
                is_inconsistent = True  
                issue_description = f"Score shows {player2_name} won {match.Score2}-{match.Score1}, but winner ID points to {winner_name}"
                suggested_fix = f"Set WinnerID to {match.Player2ID} ({player2_name})"
                
            elif match.Score1 == match.Score2 and match.WinnerID:
                is_inconsistent = True
                issue_description = f"Tied score {match.Score1}-{match.Score2} but has winner {winner_name}"
                suggested_fix = "Clear WinnerID (set to None)"
            
            return {
                'is_inconsistent': is_inconsistent,
                'issue_description': issue_description,
                'suggested_fix': suggested_fix,
                'player1_name': player1_name,
                'player2_name': player2_name,
                'winner_name': winner_name,
                'score_winner_is_player1': score_winner_is_player1,
                'score_winner_is_player2': score_winner_is_player2,
            }
            
        except Exception as e:
            logger.error(f"Error analyzing match {match.api_match_id}: {e}")
            return {'is_inconsistent': False, 'error': str(e)}

    def _apply_fix(self, match, analysis):
        """Apply the fix to a match."""
        try:
            if analysis['score_winner_is_player1']:
                match.WinnerID = match.Player1ID
                logger.info(f"Fixed match {match.api_match_id}: Set winner to Player1 ({match.Player1ID})")
                
            elif analysis['score_winner_is_player2']:
                match.WinnerID = match.Player2ID  
                logger.info(f"Fixed match {match.api_match_id}: Set winner to Player2 ({match.Player2ID})")
                
            elif match.Score1 == match.Score2:
                match.WinnerID = None
                logger.info(f"Fixed match {match.api_match_id}: Cleared winner for tied score")
                
            match.save()
            return True
            
        except Exception as e:
            logger.error(f"Error fixing match {match.api_match_id}: {e}")
            self.stdout.write(
                self.style.ERROR(f'❌ Failed to fix match {match.api_match_id}: {e}')
            )
            return False

    def _get_player_name(self, player_id):
        """Get player name with fallback."""
        if not player_id:
            return "TBD"
            
        try:
            player = Player.objects.get(ID=player_id)
            name_parts = []
            if player.FirstName:
                name_parts.append(player.FirstName)
            if player.MiddleName:
                name_parts.append(player.MiddleName) 
            if player.LastName:
                name_parts.append(player.LastName)
                
            full_name = " ".join(name_parts)
            return full_name if full_name else f"Player {player_id}"
            
        except Player.DoesNotExist:
            return f"Player {player_id} (Not Found)"