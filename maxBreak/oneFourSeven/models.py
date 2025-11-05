# oneFourSeven/models.py
from django.db import models
from django.utils import timezone # Keep for potential future use with default/auto_now
import json

# ================== Player Model ==================
class Player(models.Model):
    """
    Represents a snooker player, identified by their ID from the external API.
    Stores biographical and performance-related information.
    """
    ID = models.IntegerField(
        primary_key=True,
        help_text="Player ID from external API (snooker.org)"
    )
    Type = models.IntegerField(
        null=True, blank=True,
        help_text="Numeric player type from API if provided"
    )
    FirstName = models.CharField(max_length=100, null=True, blank=True)
    MiddleName = models.CharField(max_length=100, null=True, blank=True)
    LastName = models.CharField(max_length=100, null=True, blank=True)
    TeamName = models.CharField(
        max_length=100, null=True, blank=True,
        help_text="Relevant for team events"
    )
    TeamNumber = models.IntegerField(null=True, blank=True)
    TeamSeason = models.IntegerField(null=True, blank=True)
    ShortName = models.CharField(
        max_length=100, null=True, blank=True,
        help_text="Abbreviated name, often used for display"
    )
    Nationality = models.CharField(max_length=100, null=True, blank=True)

    # --- Choices for Sex ---
    SEX_MALE = 'M'
    SEX_FEMALE = 'F'
    SEX_CHOICES = [
        (SEX_MALE, 'Male'),
        (SEX_FEMALE, 'Female'),
    ]
    Sex = models.CharField(
        max_length=1,
        choices=SEX_CHOICES,
        null=True,
        blank=True,
        help_text="Player's sex (M/F)"
    )
    # -----------------------------

    Born = models.DateField(null=True, blank=True, help_text="Date of birth")
    SurnameFirst = models.BooleanField(
        null=True, blank=True,
        help_text="API flag indicating if surname should be displayed first"
    )
    FirstSeasonAsPro = models.IntegerField(null=True, blank=True)
    LastSeasonAsPro = models.IntegerField(null=True, blank=True)
    NumRankingTitles = models.IntegerField(
        null=True, blank=True,
        help_text="Number of ranking titles won"
    )
    NumMaximums = models.IntegerField(
        null=True, blank=True,
        help_text="Number of official 147 breaks"
    )
    Photo = models.URLField(
        max_length=500, null=True, blank=True,
        help_text="Player photo URL from snooker.org"
    )

    def __str__(self) -> str:
        """String representation of the Player object, typically the full name."""
        name_parts = []
        if self.FirstName:
            name_parts.append(self.FirstName)
        if self.MiddleName:
            name_parts.append(self.MiddleName)
        if self.LastName:
            name_parts.append(self.LastName)
            
        full_name = " ".join(name_parts)
        
        # Use ID as fallback if no name parts are available
        if full_name:
            return full_name
        else:
            return f"Player {self.ID}"

    class Meta:
        verbose_name = "Player"
        verbose_name_plural = "Players"
        ordering = ['LastName', 'FirstName'] # Default ordering

# ================== Ranking Model ==================
class Ranking(models.Model):
    """
    Represents a player's ranking entry for a specific season and ranking type.
    Linked to a Player via a ForeignKey.
    """
    # Note: API 'ID' for ranking entry might not be stable or globally unique.
    # Consider using a composite key or Django's AutoField if issues arise.
    # For now, using API's ID as requested.
    ID = models.BigIntegerField(
        primary_key=True,
        help_text="Ranking entry ID from API (use with caution if not stable)"
    )
    Position = models.IntegerField(null=True, blank=True, help_text="Ranking position")

    # --- ForeignKey link to Player ---
    Player = models.ForeignKey(
        Player,
        on_delete=models.SET_NULL, # Keep ranking entry even if player is deleted (set Player to NULL)
        null=True,                 # Allow Player field to be NULL in the database
        blank=True,                # Allow blank in forms/admin
        related_name='rankings',   # Access rankings from player instance (player.rankings.all())
        help_text="Link to the Player this ranking entry belongs to"
    )
    # ---------------------------------

    Season = models.IntegerField(
        null=True, blank=True, db_index=True,
        help_text="The season this ranking applies to"
    )
    Sum = models.IntegerField(
        null=True, blank=True,
        help_text="Ranking points or money sum, depending on the ranking type"
    )
    Type = models.CharField(
        max_length=50, null=True, blank=True, db_index=True,
        help_text="Type of ranking (e.g., MoneyRankings, OneYear, Provisional)"
    )

    def __str__(self) -> str:
        """String representation showing player, rank, type, and season."""
        player_info = "Unknown Player"
        if self.Player:
            player_info = str(self.Player) # Use Player's __str__
        else:
            # Check if FK ID exists even if object is null
            has_player_id_attr = hasattr(self, 'Player_id')
            if has_player_id_attr and self.Player_id:
                player_info = f"Player ID {self.Player_id}"

        return (f"{player_info} - Rank {self.Position or '?'} "
                f"({self.Type or 'N/A'} - Season {self.Season or '?'})")

    class Meta:
        verbose_name = "Ranking Entry"
        verbose_name_plural = "Ranking Entries"
        # Ensure each player has only one ranking per season/type combination
        unique_together = ('Player', 'Season', 'Type')
        ordering = ['Season', 'Type', 'Position'] # Default order

# ================== Event Model ==================
class Event(models.Model):
    """
    Represents a snooker tournament or event, identified by its ID from the external API.
    Contains details about the event's schedule, location, type, etc.
    """
    ID = models.IntegerField(
        primary_key=True,
        help_text="Event ID from external API (snooker.org)"
    )
    Name = models.CharField(max_length=255, null=True, blank=True)
    StartDate = models.DateField(null=True, blank=True, db_index=True, help_text="Event start date")
    EndDate = models.DateField(null=True, blank=True, db_index=True, help_text="Event end date")
    Sponsor = models.CharField(max_length=255, null=True, blank=True)
    Season = models.IntegerField(null=True, blank=True, db_index=True, help_text="Season the event belongs to")

    # --- Choices for Event Type ---
    TYPE_RANKING = 'Ranking'
    TYPE_QUALIFYING = 'Qualifying'
    TYPE_INVITATIONAL = 'Invitational'
    TYPE_LEAGUE = 'League' # e.g., Championship League
    TYPE_OTHER = 'Other'
    EVENT_TYPE_CHOICES = [
        (TYPE_RANKING, 'Ranking'),
        (TYPE_QUALIFYING, 'Qualifying'),
        (TYPE_INVITATIONAL, 'Invitational'),
        (TYPE_LEAGUE, 'League'),
        (TYPE_OTHER, 'Other'),
    ]
    Type = models.CharField(
        max_length=50,
        choices=EVENT_TYPE_CHOICES,
        null=True,
        blank=True,
        db_index=True,
        help_text="Type of the event (e.g., Ranking, Invitational)"
    )
    # ------------------------------

    Num = models.IntegerField(null=True, blank=True, help_text="Internal numeric field from API")
    Venue = models.CharField(max_length=255, null=True, blank=True)
    City = models.CharField(max_length=100, null=True, blank=True)
    Country = models.CharField(max_length=100, null=True, blank=True)
    Discipline = models.CharField(max_length=50, null=True, blank=True, default='snooker')
    Main = models.IntegerField(
        null=True, blank=True,
        help_text="ID of the related main event, if this is a qualifying stage"
    )
    Sex = models.CharField(
        max_length=10, null=True, blank=True,
        help_text="Gender category (e.g., Men, Women, Mixed)" # Consider choices if fixed
    )
    AgeGroup = models.CharField(
        max_length=10, null=True, blank=True,
        help_text="Age category (e.g., O (Open), U21)" # Consider choices if fixed
    )
    Url = models.URLField(max_length=500, null=True, blank=True, help_text="Official event website URL")
    Related = models.CharField(
        max_length=100, null=True, blank=True,
        help_text="Identifier for related events (e.g., 'world', 'uk')"
    )
    Stage = models.CharField(
        max_length=10, null=True, blank=True,
        help_text="Event stage (e.g., F (Finals), Q (Qualifying))" # Consider choices if fixed
    )
    ValueType = models.CharField(
        max_length=10, null=True, blank=True,
        help_text="Internal value type from API (e.g., 'WC')"
    )
    ShortName = models.CharField(max_length=100, null=True, blank=True)
    WorldSnookerId = models.IntegerField(
        null=True, blank=True,
        help_text="Event ID on the World Snooker Tour website"
    )
    RankingType = models.CharField(
        max_length=50, null=True, blank=True,
        help_text="Type of ranking points awarded (e.g., 'WR', 'Provisional')"
    )
    EventPredictionID = models.IntegerField(
        null=True, blank=True,
        help_text="Related ID from API, possibly for predictions/betting"
    )
    Team = models.BooleanField(default=False, help_text="Is this a team event?")
    Format = models.IntegerField(null=True, blank=True, help_text="Internal format ID from API")
    Twitter = models.CharField(max_length=100, null=True, blank=True, help_text="Official Twitter handle")
    HashTag = models.CharField(max_length=100, null=True, blank=True, help_text="Official event hashtag")
    ConversionRate = models.FloatField(
        null=True, blank=True,
        help_text="Currency conversion rate, if prize money is not in GBP"
    )
    AllRoundsAdded = models.BooleanField(
        default=False,
        help_text="Flag from API indicating if all round data is complete"
    )
    PhotoURLs = models.TextField(
        null=True, blank=True,
        help_text="Semicolon-separated (?) URLs for event photos/banners from API"
    )
    NumCompetitors = models.IntegerField(null=True, blank=True)
    NumUpcoming = models.IntegerField(null=True, blank=True)
    NumActive = models.IntegerField(null=True, blank=True)
    NumResults = models.IntegerField(null=True, blank=True)
    Note = models.TextField(null=True, blank=True, help_text="Specific notes about this event from API")
    CommonNote = models.TextField(
        null=True, blank=True,
        help_text="Common note across events, often TV/broadcast info, from API"
    )
    # Consider ForeignKey to Player if defending champion is guaranteed to be in Player table
    DefendingChampion = models.IntegerField(
        null=True, blank=True,
        help_text="Player ID of the defending champion"
    )
    # Consider ForeignKey to self if previous event is guaranteed to be in Event table
    PreviousEdition = models.IntegerField(
        null=True, blank=True,
        help_text="Event ID of the previous edition of this tournament"
    )
    Tour = models.CharField(
        max_length=50, null=True, blank=True, db_index=True,
        help_text="Tour identifier (e.g., 'main', 'seniors', 'womens')"
    )

    def get_winner_prize_money(self):
        """Get the winner's prize money from round details."""
        from .models import RoundDetails
        
        # Find the final round (usually has NumLeft=2 or is the highest round)
        final_round = RoundDetails.objects.filter(
            Event=self
        ).order_by('-Round').first()
        
        if final_round and final_round.Money:
            return {
                'amount': float(final_round.Money),
                'currency': final_round.Currency or 'GBP',
                'formatted': f"{final_round.Currency or 'GBP'} {final_round.Money:,.0f}" if final_round.Money else None
            }
        return None

    def get_prize_money_breakdown(self):
        """Get both winner and runner-up prize money from round details."""
        from .models import RoundDetails
        
        # Get final and semi-final rounds to calculate winner/runner-up prizes
        rounds = RoundDetails.objects.filter(
            Event=self,
            Money__isnull=False,
            Money__gt=0
        ).order_by('-Round')[:2]
        
        if not rounds:
            return None
            
        winner_round = rounds[0] if rounds else None
        runner_up_round = rounds[1] if len(rounds) > 1 else None
        
        result = {}
        
        if winner_round and winner_round.Money:
            result['winner'] = {
                'amount': float(winner_round.Money),
                'currency': winner_round.Currency or 'GBP',
                'formatted': f"{winner_round.Currency or 'GBP'} {winner_round.Money:,.0f}"
            }
        
        if runner_up_round and runner_up_round.Money:
            result['runner_up'] = {
                'amount': float(runner_up_round.Money), 
                'currency': runner_up_round.Currency or 'GBP',
                'formatted': f"{runner_up_round.Currency or 'GBP'} {runner_up_round.Money:,.0f}"
            }
            
        return result if result else None

    def __str__(self) -> str:
        """String representation including name and season."""
        season_str = f" ({self.Season})" if self.Season else ""
        return f"{self.Name or f'Event {self.ID}'}{season_str}"

    class Meta:
        verbose_name = "Event"
        verbose_name_plural = "Events"
        ordering = ['-Season', 'StartDate', 'Name'] # Order by season desc, then date asc, then name

# ================== MatchesOfAnEvent Model ==================
class MatchesOfAnEvent(models.Model):
    """
    Represents a specific match within an event, including players, scores, schedule, and status.
    Uses Django's auto-incrementing ID as the Primary Key.
    The API's match ID is stored separately in 'api_match_id'.
    Uniqueness within the database is enforced based on the logical key: (Event, Round, Number).
    """
    # --- Django's Auto Primary Key (Implicitly added) ---
    # id = models.BigAutoField(primary_key=True)

    # --- API's Match ID (Stored for reference, NOT PK) ---
    api_match_id = models.IntegerField(
        db_index=True, # Index for potential lookups based on API ID
        unique=False,  # Not unique in our DB (API might reuse IDs across events/seasons?)
        null=True,     # Allow null if API might not provide it reliably
        blank=True,
        help_text="Match ID from external API (snooker.org). NOT the primary key."
    )

    # --- Logical Key Components ---
    Event = models.ForeignKey(
        Event,
        on_delete=models.CASCADE,   # If Event is deleted, delete its matches
        related_name='matches',     # Access matches via event.matches.all()
        null=False,                 # An Event MUST be linked
        blank=False,
        help_text="The event this match belongs to (Required)"
    )
    Round = models.IntegerField(
        null=False, # Required for unique_together constraint
        blank=False,
        db_index=True, # Index for faster lookups by round
        help_text="Round number within the event (e.g., 1=L128, 7=QF, 8=SF, 15=Final) (Required)"
    )
    Number = models.IntegerField(
        null=False, # Required for unique_together constraint
        blank=False,
        help_text="Match number within the round (Required)"
    )
    # -----------------------------

    # --- Player & Score Fields ---
    # Consider using ForeignKey(Player, ...) if players MUST exist in Player table.
    # Using IntegerField allows storing IDs even if the Player record isn't fetched/saved yet.
    Player1ID = models.IntegerField(null=True, blank=True, db_index=True, help_text="Player 1's ID from API")
    Score1 = models.IntegerField(null=True, blank=True, help_text="Player 1 Final Score")
    Player2ID = models.IntegerField(null=True, blank=True, db_index=True, help_text="Player 2's ID from API")
    Score2 = models.IntegerField(null=True, blank=True, help_text="Player 2 Final Score")
    WinnerID = models.IntegerField(null=True, blank=True, db_index=True, help_text="Winning player's ID from API")
    # -----------------------------

    # --- Timing & Status Fields ---
    # Use DateTimeField for specific times, ensure timezone awareness in scraper/views
    ScheduledDate = models.DateTimeField(
        null=True, blank=True, db_index=True,
        help_text="Scheduled start time/date (store as timezone-aware)"
    )
    StartDate = models.DateTimeField(
        null=True, blank=True,
        help_text="Actual match start time from API (store as timezone-aware)"
    )
    EndDate = models.DateTimeField(
        null=True, blank=True,
        help_text="Actual match end time from API (store as timezone-aware)"
    )
    # --- API Status Choices ---
    STATUS_SCHEDULED = 0
    STATUS_RUNNING = 1
    STATUS_FINISHED = 2
    STATUS_UNKNOWN = 3 # Or other specific meanings
    STATUS_CHOICES = [
        (STATUS_SCHEDULED, 'Scheduled'),
        (STATUS_RUNNING, 'Running / Live'),
        (STATUS_FINISHED, 'Finished'),
        (STATUS_UNKNOWN, 'Unknown/Other'),
    ]
    Status = models.IntegerField(
        choices=STATUS_CHOICES,
        null=True, blank=True, db_index=True,
        help_text="Match status code from API (0=Sched, 1=Running, 2=Finished, 3=?)",
        default=STATUS_UNKNOWN
    )
    Unfinished = models.BooleanField(
        null=True, blank=True,
        help_text="Flag from API indicating if the match ended prematurely/unfinished"
    )
    # -----------------------------

    # --- Additional Details ---
    FrameScores = models.CharField(
        max_length=1000, null=True, blank=True,
        help_text="Frame-by-frame scores string from API (e.g., '(64-21, ...)')"
    )
    OnBreak = models.BooleanField(
        null=True, blank=True,
        help_text="Flag from API indicating if a player is currently on a break (live data)"
    )
    LiveUrl = models.URLField(
        max_length=500, null=True, blank=True,
        help_text="URL for live scoring page, if available"
    )
    DetailsUrl = models.URLField(
        max_length=500, null=True, blank=True,
        help_text="URL for match details page on snooker.org"
    )
    Note = models.TextField(null=True, blank=True, help_text="Specific notes about this match from API")
    # Store sessions as text; parsing can happen in views/serializers if needed
    sessions_str = models.TextField(
        null=True, blank=True,
        help_text="Raw session times string from API (e.g., 'DD.MM.YYYY HH:MM; ...')"
    )
    # -----------------------------


    def __str__(self) -> str:
        """Detailed string representation for admin/debugging."""
        event_name = self.Event.Name if self.Event else f"EventID {self.Event_id}"
        round_info = f"R{self.Round}" if self.Round is not None else "R?"
        number_info = f"N{self.Number}" if self.Number is not None else "N?"
        p1 = f"P1({self.Player1ID})" if self.Player1ID else "TBD"
        p2 = f"P2({self.Player2ID})" if self.Player2ID else "TBD"
        score = f"{self.Score1}-{self.Score2}" if self.Score1 is not None and self.Score2 is not None else "vs"
        # Use Django's pk (auto ID) for clear identification in logs/admin
        return (f"Match PK {self.pk} (API ID {self.api_match_id or 'N/A'}): "
                f"{event_name} ({round_info}.{number_info}) - {p1} {score} {p2} "
                f"[Status: {self.get_Status_display()}]")


    class Meta:
        verbose_name = "Event Match"
        verbose_name_plural = "Event Matches"
        # Enforce uniqueness based on the logical key (Event, Round, Number)
        unique_together = ('Event', 'Round', 'Number')
        # Define default ordering for queries
        ordering = [
            'Event__Season',    # Group by season
            'Event__StartDate', # Then by event start date
            'Event__ID',        # Then by event ID (consistency)
            'Round',            # Then by round number
            'Number',           # Then by match number within round
            'ScheduledDate',    # Then by scheduled time (if available)
            'id'                # Finally by primary key for deterministic order
        ]
        indexes = [
            models.Index(fields=['Event', 'Round', 'Number']), # Index for unique_together lookup
            models.Index(fields=['Player1ID']), # Index for finding player matches
            models.Index(fields=['Player2ID']), # Index for finding player matches
            models.Index(fields=['api_match_id']), # Index for finding by API ID
        ]


# ================== Round Details Model ==================
class RoundDetails(models.Model):
    """
    Represents round format details for tournaments.
    Stores the Distance (frames to win) and other round-specific information.
    """
    Round = models.IntegerField(
        help_text="Round number from API"
    )
    RoundName = models.CharField(
        max_length=100, null=True, blank=True,
        help_text="Display name for the round (e.g., 'Round 1', 'Final')"
    )
    Event = models.ForeignKey(
        Event, on_delete=models.CASCADE, 
        related_name='round_details',
        help_text="The tournament this round belongs to"
    )
    MainEvent = models.IntegerField(
        null=True, blank=True,
        help_text="Main event ID from API"
    )
    Distance = models.IntegerField(
        help_text="Frames needed to win the match (e.g., 6 for 'best of 11')"
    )
    NumLeft = models.IntegerField(
        null=True, blank=True,
        help_text="Number of players left in the tournament at this round"
    )
    NumMatches = models.IntegerField(
        null=True, blank=True,
        help_text="Number of matches in this round"
    )
    Note = models.TextField(
        null=True, blank=True,
        help_text="Additional notes about the round"
    )
    ValueType = models.CharField(
        max_length=10, null=True, blank=True,
        help_text="Value type from API (e.g., 'SM')"
    )
    Rank = models.IntegerField(
        null=True, blank=True,
        help_text="Ranking points available"
    )
    Money = models.DecimalField(
        max_digits=10, decimal_places=2, null=True, blank=True,
        help_text="Prize money for this round"
    )
    SeedGetsHalf = models.IntegerField(
        null=True, blank=True,
        help_text="Whether seed gets half points/money"
    )
    ActualMoney = models.DecimalField(
        max_digits=10, decimal_places=2, null=True, blank=True,
        help_text="Actual prize money after conversions"
    )
    Currency = models.CharField(
        max_length=3, null=True, blank=True,
        help_text="Currency code (e.g., 'GBP', 'USD')"
    )
    ConversionRate = models.DecimalField(
        max_digits=10, decimal_places=6, null=True, blank=True,
        help_text="Currency conversion rate"
    )
    Points = models.IntegerField(
        null=True, blank=True,
        help_text="Ranking points for this round"
    )
    SeedPoints = models.IntegerField(
        null=True, blank=True,
        help_text="Seed points for this round"
    )
    
    # Metadata fields
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def get_best_of_frames(self) -> int:
        """Calculate the 'best of' frame count from Distance."""
        return (self.Distance * 2) - 1

    def get_format_text(self) -> str:
        """Get human-readable format text."""
        best_of = self.get_best_of_frames()
        return f"Best of {best_of}"

    def get_correct_round_name(self) -> str:
        """Get the correct round name based on NumLeft or fallback to RoundName."""
        if self.NumLeft:
            # Standard tournament round names based on players left
            if self.NumLeft >= 128:
                return f"Last {self.NumLeft}"
            elif self.NumLeft == 64:
                return "Last 64"
            elif self.NumLeft == 32:
                return "Last 32"
            elif self.NumLeft == 16:
                return "Last 16"
            elif self.NumLeft == 8:
                return "Quarterfinals"
            elif self.NumLeft == 4:
                return "Semifinals"
            elif self.NumLeft == 2:
                return "Final"
            elif self.NumLeft == 1:
                return "Winner"
        
        # Fallback to API-provided round name or generic
        return self.RoundName or f"Round {self.Round}"

    def __str__(self) -> str:
        """String representation of the RoundDetails object."""
        event_name = self.Event.Name if self.Event and self.Event.Name else f"Event {self.Event_id}"
        round_name = self.RoundName or f"Round {self.Round}"
        return f"{event_name} - {round_name} ({self.get_format_text()})"

    class Meta:
        verbose_name = "Round Details"
        verbose_name_plural = "Round Details"
        unique_together = ('Event', 'Round')  # Each round per event should be unique
        ordering = ['Event__Season', 'Event__StartDate', 'Round']
        indexes = [
            models.Index(fields=['Event', 'Round']),  # Index for lookups
            models.Index(fields=['Event']),  # Index for event-based queries
        ]


# ================== Upcoming Match Model (Fallback) ==================
class UpcomingMatch(models.Model):
    """
    Fallback model for upcoming matches fetched directly from snooker.org API
    Used when no active tournaments exist in the main database
    """
    
    # Match identification
    api_match_id = models.IntegerField(
        help_text="Original match ID from snooker.org API"
    )
    event_id = models.IntegerField(
        null=True, blank=True,
        help_text="Event ID from snooker.org API"
    )
    event_name = models.CharField(
        max_length=200, null=True, blank=True,
        help_text="Event/Tournament name"
    )
    
    # Match details
    round_number = models.IntegerField(
        null=True, blank=True,
        help_text="Round number in the tournament"
    )
    match_number = models.IntegerField(
        null=True, blank=True,
        help_text="Match number within the round"
    )
    
    # Player information
    player1_id = models.IntegerField(
        null=True, blank=True,
        help_text="Player 1 ID from snooker.org"
    )
    player2_id = models.IntegerField(
        null=True, blank=True,
        help_text="Player 2 ID from snooker.org"
    )
    player1_name = models.CharField(
        max_length=100, null=True, blank=True,
        help_text="Player 1 name"
    )
    player2_name = models.CharField(
        max_length=100, null=True, blank=True,
        help_text="Player 2 name"
    )
    
    # Match results
    score1 = models.IntegerField(
        null=True, blank=True,
        help_text="Player 1 score/frames won"
    )
    score2 = models.IntegerField(
        null=True, blank=True,
        help_text="Player 2 score/frames won"
    )
    winner_id = models.IntegerField(
        null=True, blank=True,
        help_text="Winner player ID (if match is finished)"
    )
    
    # Match status
    STATUS_CHOICES = [
        (0, 'Scheduled'),
        (1, 'Live'),
        (2, 'On Break'),
        (3, 'Finished'),
    ]
    status = models.IntegerField(
        choices=STATUS_CHOICES,
        default=0,
        help_text="Current match status"
    )
    
    # Timing
    scheduled_date = models.DateTimeField(
        null=True, blank=True,
        help_text="Scheduled start date and time"
    )
    
    # Tour classification
    TOUR_CHOICES = [
        ('main', 'Main Tour'),
        ('womens', 'Womens Tour'),
        ('seniors', 'Seniors Tour'),
        ('other', 'Other Tours'),
        ('all', 'All Tours'),
    ]
    tour_type = models.CharField(
        max_length=10,
        choices=TOUR_CHOICES,
        default='main',
        help_text="Tour type this match belongs to"
    )
    
    # Metadata
    raw_data = models.TextField(
        null=True, blank=True,
        help_text="Raw JSON data from snooker.org API"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    def __str__(self):
        return f"{self.player1_name} vs {self.player2_name} - {self.event_name}"
    
    @property
    def is_today(self):
        """Check if match is scheduled for today"""
        if not self.scheduled_date:
            return False
        return self.scheduled_date.date() == timezone.now().date()
    
    @property
    def is_live(self):
        """Check if match is currently live"""
        return self.status in [1, 2]  # Live or On Break
    
    @property
    def status_display(self):
        """Get human-readable status"""
        return dict(self.STATUS_CHOICES).get(self.status, 'Unknown')
    
    @property
    def score_display(self):
        """Get formatted score display"""
        if self.status == 3 and self.score1 is not None and self.score2 is not None:
            return f"{self.score1}-{self.score2}"
        return "vs"
    
    def get_raw_data_dict(self):
        """Parse raw JSON data"""
        if self.raw_data:
            try:
                return json.loads(self.raw_data)
            except json.JSONDecodeError:
                return {}
        return {}
    
    class Meta:
        verbose_name = "Upcoming Match"
        verbose_name_plural = "Upcoming Matches"
        ordering = ['scheduled_date', 'round_number', 'match_number']
        indexes = [
            models.Index(fields=['tour_type', 'scheduled_date']),
            models.Index(fields=['status', 'scheduled_date']),
            models.Index(fields=['event_id', 'round_number']),
            models.Index(fields=['created_at']),
        ]


# ================== Player Match History Model ==================
class PlayerMatchHistory(models.Model):
    """
    Stores match history for players (API t=8).
    Lightweight model optimized for player profile display.
    Separate from MatchesOfAnEvent to avoid interfering with event pipelines.
    """
    # Match identification
    api_match_id = models.BigIntegerField(
        help_text="Match ID from API"
    )
    player_id = models.IntegerField(
        db_index=True,
        help_text="Player ID this match belongs to"
    )

    # Event info
    event_id = models.IntegerField(
        null=True, blank=True,
        help_text="Tournament/Event ID"
    )
    event_name = models.CharField(
        max_length=255, null=True, blank=True,
        help_text="Tournament name (denormalized for faster display)"
    )

    # Match details
    round_number = models.IntegerField(null=True, blank=True)
    round_name = models.CharField(
        max_length=100, null=True, blank=True,
        help_text="Round name like 'Final', 'Semi-Final'"
    )

    # Players
    player1_id = models.IntegerField(null=True, blank=True)
    player1_name = models.CharField(max_length=255, null=True, blank=True)
    score1 = models.IntegerField(null=True, blank=True)

    player2_id = models.IntegerField(null=True, blank=True)
    player2_name = models.CharField(max_length=255, null=True, blank=True)
    score2 = models.IntegerField(null=True, blank=True)

    # Result
    winner_id = models.IntegerField(null=True, blank=True)
    status = models.IntegerField(
        default=0,
        help_text="0=Scheduled, 1=Running, 2=OnBreak, 3=Finished"
    )

    # Dates
    scheduled_date = models.DateTimeField(null=True, blank=True)
    start_date = models.DateTimeField(null=True, blank=True)
    end_date = models.DateTimeField(null=True, blank=True)

    # Season
    season = models.IntegerField(
        null=True, blank=True,
        help_text="Season year (e.g. 2024 for 2024/2025 season)"
    )

    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.player1_name} vs {self.player2_name} - {self.event_name}"

    class Meta:
        verbose_name = "Player Match History"
        verbose_name_plural = "Player Match Histories"
        ordering = ['-scheduled_date', '-start_date']
        indexes = [
            models.Index(fields=['player_id', '-scheduled_date']),
            models.Index(fields=['player_id', 'season']),
            models.Index(fields=['status', 'scheduled_date']),
            models.Index(fields=['api_match_id']),
        ]
        # Ensure unique matches per player
        unique_together = [['api_match_id', 'player_id']]
