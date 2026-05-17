from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient
from unittest.mock import patch, MagicMock
from datetime import date, timedelta
from io import StringIO

from .models import Player, PlayerMatchHistory


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_monitor():
    """Instantiate the Command without Django management machinery."""
    from oneFourSeven.management.commands.auto_live_monitor import Command
    cmd = Command()
    cmd.stdout = StringIO()
    return cmd


def _make_player(player_id=9999):
    return Player.objects.get_or_create(
        ID=player_id,
        defaults={'FirstName': 'Test', 'LastName': 'Player'}
    )[0]


def _make_match(player_id, api_match_id, scheduled_date, status=3, season=2025):
    return PlayerMatchHistory.objects.create(
        api_match_id=api_match_id,
        player_id=player_id,
        status=status,
        scheduled_date=scheduled_date,
        season=season,
    )


# ---------------------------------------------------------------------------
# Tests: _check_daily_updates uses instance variable (not Event.created_at)
# ---------------------------------------------------------------------------

class CheckDailyUpdatesTest(TestCase):
    """Verify that _check_daily_updates tracks runs via self.last_daily_run."""

    @patch(
        'oneFourSeven.management.commands.auto_live_monitor.Command._run_daily_updates'
    )
    def test_runs_when_not_run_today(self, mock_run):
        """Should run and set last_daily_run when not run today."""
        cmd = _make_monitor()
        # Simulate 3am UTC
        fake_now = timezone.now().replace(hour=3, minute=0, second=0, microsecond=0)
        with patch('oneFourSeven.management.commands.auto_live_monitor.timezone') as mock_tz:
            mock_tz.now.return_value = fake_now
            result = cmd._check_daily_updates()

        self.assertTrue(result)
        mock_run.assert_called_once()
        self.assertEqual(cmd.last_daily_run, fake_now.date())

    @patch(
        'oneFourSeven.management.commands.auto_live_monitor.Command._run_daily_updates'
    )
    def test_skips_when_already_run_today(self, mock_run):
        """Should NOT run again if last_daily_run is already today."""
        cmd = _make_monitor()
        fake_now = timezone.now().replace(hour=3, minute=0, second=0, microsecond=0)
        cmd.last_daily_run = fake_now.date()  # already ran today

        with patch('oneFourSeven.management.commands.auto_live_monitor.timezone') as mock_tz:
            mock_tz.now.return_value = fake_now
            result = cmd._check_daily_updates()

        self.assertFalse(result)
        mock_run.assert_not_called()

    @patch(
        'oneFourSeven.management.commands.auto_live_monitor.Command._run_daily_updates'
    )
    def test_skips_outside_window(self, mock_run):
        """Should NOT run at 10am — only runs between 2-4am UTC."""
        cmd = _make_monitor()
        fake_now = timezone.now().replace(hour=10, minute=0, second=0, microsecond=0)

        with patch('oneFourSeven.management.commands.auto_live_monitor.timezone') as mock_tz:
            mock_tz.now.return_value = fake_now
            result = cmd._check_daily_updates()

        self.assertFalse(result)
        mock_run.assert_not_called()

    @patch(
        'oneFourSeven.management.commands.auto_live_monitor.Command._run_daily_updates'
    )
    def test_runs_again_next_day(self, mock_run):
        """Should run again the next day even if it ran yesterday."""
        cmd = _make_monitor()
        fake_now = timezone.now().replace(hour=3, minute=0, second=0, microsecond=0)
        cmd.last_daily_run = fake_now.date() - timedelta(days=1)  # yesterday

        with patch('oneFourSeven.management.commands.auto_live_monitor.timezone') as mock_tz:
            mock_tz.now.return_value = fake_now
            result = cmd._check_daily_updates()

        self.assertTrue(result)
        mock_run.assert_called_once()


# ---------------------------------------------------------------------------
# Tests: _check_monthly_updates uses instance variable (not Player.created_at)
# ---------------------------------------------------------------------------

class CheckMonthlyUpdatesTest(TestCase):
    """Verify that _check_monthly_updates tracks runs via self.last_monthly_run."""

    @patch(
        'oneFourSeven.management.commands.auto_live_monitor.Command._run_monthly_updates'
    )
    def test_runs_on_first_of_month(self, mock_run):
        """Should run and set last_monthly_run on 1st of month at 3am."""
        cmd = _make_monitor()
        # Create a datetime that is the 1st of the month at 3am
        now = timezone.now()
        fake_now = now.replace(day=1, hour=3, minute=0, second=0, microsecond=0)

        with patch('oneFourSeven.management.commands.auto_live_monitor.timezone') as mock_tz:
            mock_tz.now.return_value = fake_now
            result = cmd._check_monthly_updates()

        self.assertTrue(result)
        mock_run.assert_called_once()
        self.assertEqual(cmd.last_monthly_run, fake_now.strftime('%Y-%m'))

    @patch(
        'oneFourSeven.management.commands.auto_live_monitor.Command._run_monthly_updates'
    )
    def test_skips_when_already_run_this_month(self, mock_run):
        """Should NOT run again if last_monthly_run is already this month."""
        cmd = _make_monitor()
        now = timezone.now()
        fake_now = now.replace(day=1, hour=3, minute=0, second=0, microsecond=0)
        cmd.last_monthly_run = fake_now.strftime('%Y-%m')

        with patch('oneFourSeven.management.commands.auto_live_monitor.timezone') as mock_tz:
            mock_tz.now.return_value = fake_now
            result = cmd._check_monthly_updates()

        self.assertFalse(result)
        mock_run.assert_not_called()

    @patch(
        'oneFourSeven.management.commands.auto_live_monitor.Command._run_monthly_updates'
    )
    def test_skips_on_non_first_day(self, mock_run):
        """Should NOT run on day 15 — only runs on 1st of month."""
        cmd = _make_monitor()
        now = timezone.now()
        fake_now = now.replace(day=15, hour=3, minute=0, second=0, microsecond=0)

        with patch('oneFourSeven.management.commands.auto_live_monitor.timezone') as mock_tz:
            mock_tz.now.return_value = fake_now
            result = cmd._check_monthly_updates()

        self.assertFalse(result)
        mock_run.assert_not_called()


# ---------------------------------------------------------------------------
# Tests: player_match_history view — NULL scheduled_date sorts to bottom
# ---------------------------------------------------------------------------

class PlayerMatchHistoryOrderingTest(TestCase):
    """Verify that matches with NULL scheduled_date appear LAST, not first."""

    def setUp(self):
        self.client = APIClient()
        self.player = _make_player(player_id=9001)

        now = timezone.now()

        # Match with NULL scheduled_date (old/incomplete data — should appear LAST)
        self.null_date_match = _make_match(
            player_id=9001,
            api_match_id=1001,
            scheduled_date=None,
            status=3,
        )

        # Match from 5 days ago (should appear 2nd)
        self.old_match = _make_match(
            player_id=9001,
            api_match_id=1002,
            scheduled_date=now - timedelta(days=5),
            status=3,
        )

        # Most recent match (should appear 1st)
        self.recent_match = _make_match(
            player_id=9001,
            api_match_id=1003,
            scheduled_date=now - timedelta(days=1),
            status=3,
        )

    def test_null_date_appears_last(self):
        """NULL scheduled_date must appear after matches that have a real date."""
        url = f'/oneFourSeven/players/9001/matches/'
        response = self.client.get(url, {'limit': 10})

        self.assertEqual(response.status_code, 200)
        matches = response.data['matches']

        # Should return 3 matches
        self.assertEqual(len(matches), 3)

        # Extract api_match_ids in returned order
        returned_ids = [m['api_match_id'] for m in matches]

        # Most recent (1003) first, then old (1002), NULL last (1001)
        self.assertEqual(returned_ids[0], 1003, "Most recent match should be first")
        self.assertEqual(returned_ids[1], 1002, "5-day-old match should be second")
        self.assertEqual(returned_ids[2], 1001, "NULL date match should be last")

    def test_null_date_not_first(self):
        """Regression test: NULL date must NOT appear as the most-recent match."""
        url = f'/oneFourSeven/players/9001/matches/'
        response = self.client.get(url, {'limit': 10})

        self.assertEqual(response.status_code, 200)
        matches = response.data['matches']

        first_match_id = matches[0]['api_match_id']
        self.assertNotEqual(
            first_match_id, 1001,
            "NULL-date match should never be returned as the most recent match"
        )


# ===========================================================================
# Helpers for User / Favorites / Notification tests
# ===========================================================================

def _make_user(username='testuser', password='testpass123'):
    from django.contrib.auth.models import User
    return User.objects.create_user(username=username, password=password)


def _make_device(device_id='test-device-001', push_token='ExponentPushToken[test001]',
                 user=None, player_ids=None, match_ids=None):
    from oneFourSeven.models import DeviceToken
    return DeviceToken.objects.create(
        device_id=device_id,
        push_token=push_token,
        user=user,
        favorite_player_ids=player_ids or [],
        favorite_match_ids=match_ids or [],
    )


def _make_user_favorite(user, player_ids=None, match_ids=None):
    from oneFourSeven.models import UserFavorite
    return UserFavorite.objects.create(
        user=user,
        favorite_player_ids=player_ids or [],
        favorite_match_ids=match_ids or [],
    )


# ===========================================================================
# Tests 1–8: UserFavorite model
# ===========================================================================

class UserFavoriteModelTest(TestCase):
    """Verify UserFavorite model creation, constraints, and cascade behaviour."""

    def test_default_empty_lists(self):
        """player and match IDs default to empty lists."""
        from oneFourSeven.models import UserFavorite
        user = _make_user('uf_u1')
        fav = UserFavorite.objects.create(user=user)
        self.assertEqual(fav.favorite_player_ids, [])
        self.assertEqual(fav.favorite_match_ids, [])

    def test_str_representation(self):
        """__str__ includes username and ID counts."""
        user = _make_user('uf_u2')
        fav = _make_user_favorite(user, player_ids=[1, 2], match_ids=[10])
        s = str(fav)
        self.assertIn('uf_u2', s)

    def test_update_player_ids(self):
        """Saving new player_ids persists correctly."""
        from oneFourSeven.models import UserFavorite
        user = _make_user('uf_u3')
        fav = _make_user_favorite(user)
        fav.favorite_player_ids = [5, 10, 15]
        fav.save(update_fields=['favorite_player_ids', 'updated_at'])
        refreshed = UserFavorite.objects.get(user=user)
        self.assertEqual(refreshed.favorite_player_ids, [5, 10, 15])

    def test_update_match_ids(self):
        """Saving new match_ids persists correctly."""
        from oneFourSeven.models import UserFavorite
        user = _make_user('uf_u4')
        fav = _make_user_favorite(user)
        fav.favorite_match_ids = [100, 200]
        fav.save(update_fields=['favorite_match_ids', 'updated_at'])
        refreshed = UserFavorite.objects.get(user=user)
        self.assertEqual(refreshed.favorite_match_ids, [100, 200])

    def test_user_is_one_to_one(self):
        """Creating a second UserFavorite for the same user raises IntegrityError."""
        from django.db import IntegrityError
        from oneFourSeven.models import UserFavorite
        user = _make_user('uf_u5')
        UserFavorite.objects.create(user=user)
        with self.assertRaises(IntegrityError):
            UserFavorite.objects.create(user=user)

    def test_cascade_delete_on_user_delete(self):
        """Deleting a user cascades and removes their UserFavorite row."""
        from oneFourSeven.models import UserFavorite
        user = _make_user('uf_u6')
        _make_user_favorite(user, player_ids=[1])
        user.delete()
        self.assertEqual(UserFavorite.objects.count(), 0)

    def test_updated_at_auto_updates(self):
        """updated_at changes when the row is re-saved."""
        import time
        user = _make_user('uf_u7')
        fav = _make_user_favorite(user)
        t1 = fav.updated_at
        time.sleep(0.02)
        fav.favorite_player_ids = [99]
        fav.save()
        self.assertGreater(fav.updated_at, t1)

    def test_set_both_ids_simultaneously(self):
        """Both player_ids and match_ids can be set at creation time."""
        user = _make_user('uf_u8')
        fav = _make_user_favorite(user, player_ids=[1, 2, 3], match_ids=[10, 20])
        self.assertEqual(fav.favorite_player_ids, [1, 2, 3])
        self.assertEqual(fav.favorite_match_ids, [10, 20])


# ===========================================================================
# Tests 9–15: DeviceToken.user FK
# ===========================================================================

class DeviceTokenUserFKTest(TestCase):
    """Verify DeviceToken.user FK creation, SET_NULL, and multi-device ownership."""

    def test_default_user_is_null(self):
        """A newly created DeviceToken has user=None."""
        device = _make_device('dt_null')
        self.assertIsNone(device.user)

    def test_link_user(self):
        """Setting device.user and saving links the device to the user."""
        from oneFourSeven.models import DeviceToken
        user = _make_user('dt_u1')
        device = _make_device('dt_link')
        device.user = user
        device.save(update_fields=['user', 'updated_at'])
        refreshed = DeviceToken.objects.get(device_id='dt_link')
        self.assertEqual(refreshed.user, user)

    def test_set_null_on_user_delete(self):
        """Deleting the user sets device.user to NULL; the device row survives."""
        from oneFourSeven.models import DeviceToken
        user = _make_user('dt_u2')
        _make_device('dt_setnull', user=user)
        user.delete()
        device = DeviceToken.objects.get(device_id='dt_setnull')
        self.assertIsNone(device.user)

    def test_one_user_many_devices(self):
        """A single user can be linked to multiple DeviceToken rows."""
        user = _make_user('dt_u3')
        _make_device('dt_multi1', user=user)
        _make_device('dt_multi2', user=user)
        _make_device('dt_multi3', user=user)
        self.assertEqual(user.devices.count(), 3)

    def test_devices_related_name(self):
        """user.devices.all() returns all and only that user's devices."""
        user = _make_user('dt_u4')
        _make_device('dt_rel1', user=user)
        _make_device('dt_rel2', user=user)
        ids = set(user.devices.values_list('device_id', flat=True))
        self.assertEqual(ids, {'dt_rel1', 'dt_rel2'})

    def test_filter_by_user(self):
        """DeviceToken.objects.filter(user=user) excludes other users' devices."""
        from oneFourSeven.models import DeviceToken
        user = _make_user('dt_u5')
        other = _make_user('dt_u5b')
        _make_device('dt_f1', user=user)
        _make_device('dt_f2', user=user)
        _make_device('dt_fother', user=other)
        self.assertEqual(DeviceToken.objects.filter(user=user).count(), 2)

    def test_unlink_device(self):
        """Setting device.user = None unlinks it from the user."""
        from oneFourSeven.models import DeviceToken
        user = _make_user('dt_u6')
        device = _make_device('dt_unlink', user=user)
        device.user = None
        device.save(update_fields=['user', 'updated_at'])
        refreshed = DeviceToken.objects.get(device_id='dt_unlink')
        self.assertIsNone(refreshed.user)
        self.assertEqual(user.devices.count(), 0)


# ===========================================================================
# Tests 16–27: get_tokens_for_match helper
# ===========================================================================

class GetTokensForMatchTest(TestCase):
    """Verify get_tokens_for_match returns a correct, deduplicated token list."""

    def setUp(self):
        from oneFourSeven.push_notifications import get_tokens_for_match
        self.fn = get_tokens_for_match

    def test_empty_when_no_devices(self):
        """Returns [] when the table is empty."""
        self.assertEqual(self.fn(999), [])

    def test_uuid_device_with_match_returned(self):
        """UUID device with the target match_id and a push_token is included."""
        _make_device('m_d1', push_token='tok-MA', match_ids=[42])
        self.assertIn('tok-MA', self.fn(42))

    def test_uuid_device_without_push_token_excluded(self):
        """UUID device with empty push_token is excluded even if match is favorited."""
        _make_device('m_d2', push_token='', match_ids=[42])
        self.assertEqual(self.fn(42), [])

    def test_user_linked_device_returned(self):
        """Device linked to user whose UserFavorite has the match_id is included."""
        user = _make_user('m_u1')
        _make_device('m_d3', push_token='tok-MB', user=user)
        _make_user_favorite(user, match_ids=[42])
        self.assertIn('tok-MB', self.fn(42))

    def test_user_linked_device_without_token_excluded(self):
        """User-linked device without push_token is excluded."""
        user = _make_user('m_u2')
        _make_device('m_d4', push_token='', user=user)
        _make_user_favorite(user, match_ids=[42])
        self.assertEqual(self.fn(42), [])

    def test_union_of_uuid_and_user_tokens(self):
        """Result is the union of UUID-based and user-based tokens."""
        _make_device('m_d5', push_token='tok-uuid', match_ids=[42])
        user = _make_user('m_u3')
        _make_device('m_d6', push_token='tok-user', user=user)
        _make_user_favorite(user, match_ids=[42])
        result = self.fn(42)
        self.assertIn('tok-uuid', result)
        self.assertIn('tok-user', result)
        self.assertEqual(len(result), 2)

    def test_duplicate_token_deduplicated(self):
        """Token appearing in both UUID and user paths is returned only once."""
        user = _make_user('m_u4')
        _make_device('m_d7', push_token='tok-SAME', match_ids=[42], user=user)
        _make_user_favorite(user, match_ids=[42])
        result = self.fn(42)
        self.assertEqual(result.count('tok-SAME'), 1)

    def test_different_match_id_not_returned(self):
        """Device favoriting a different match is NOT included."""
        _make_device('m_d8', push_token='tok-wrong', match_ids=[99])
        self.assertNotIn('tok-wrong', self.fn(42))

    def test_multiple_uuid_devices(self):
        """Multiple UUID devices all favoriting the same match are all returned."""
        _make_device('m_d9', push_token='tok-u1', match_ids=[42])
        _make_device('m_d10', push_token='tok-u2', match_ids=[42])
        _make_device('m_d11', push_token='tok-u3', match_ids=[42])
        self.assertEqual(len(self.fn(42)), 3)

    def test_multiple_user_linked_devices(self):
        """All devices linked to a user with the match favorited are returned."""
        user = _make_user('m_u5')
        _make_device('m_d12', push_token='tok-ud1', user=user)
        _make_device('m_d13', push_token='tok-ud2', user=user)
        _make_user_favorite(user, match_ids=[42])
        result = self.fn(42)
        self.assertIn('tok-ud1', result)
        self.assertIn('tok-ud2', result)

    def test_user_with_no_match_favorites_contributes_nothing(self):
        """User-linked device where UserFavorite.match_ids is empty gives no tokens."""
        user = _make_user('m_u6')
        _make_device('m_d14', push_token='tok-nofav', user=user)
        _make_user_favorite(user, match_ids=[])
        self.assertNotIn('tok-nofav', self.fn(42))

    def test_uuid_device_empty_match_ids_excluded(self):
        """UUID device with empty match_ids list is excluded."""
        _make_device('m_d15', push_token='tok-empty', match_ids=[])
        self.assertNotIn('tok-empty', self.fn(42))


# ===========================================================================
# Tests 28–39: get_tokens_for_player helper
# ===========================================================================

class GetTokensForPlayerTest(TestCase):
    """Verify get_tokens_for_player returns a correct, deduplicated token list."""

    def setUp(self):
        from oneFourSeven.push_notifications import get_tokens_for_player
        self.fn = get_tokens_for_player

    def test_empty_when_no_devices(self):
        """Returns [] when the table is empty."""
        self.assertEqual(self.fn(999), [])

    def test_uuid_device_with_player_returned(self):
        """UUID device with the target player_id and a push_token is included."""
        _make_device('p_d1', push_token='tok-PA', player_ids=[7])
        self.assertIn('tok-PA', self.fn(7))

    def test_uuid_device_without_push_token_excluded(self):
        """UUID device with empty push_token is excluded even if player is favorited."""
        _make_device('p_d2', push_token='', player_ids=[7])
        self.assertEqual(self.fn(7), [])

    def test_user_linked_device_returned(self):
        """Device linked to user whose UserFavorite has the player_id is included."""
        user = _make_user('p_u1')
        _make_device('p_d3', push_token='tok-PB', user=user)
        _make_user_favorite(user, player_ids=[7])
        self.assertIn('tok-PB', self.fn(7))

    def test_user_linked_device_without_token_excluded(self):
        """User-linked device without push_token is excluded."""
        user = _make_user('p_u2')
        _make_device('p_d4', push_token='', user=user)
        _make_user_favorite(user, player_ids=[7])
        self.assertEqual(self.fn(7), [])

    def test_union_of_uuid_and_user_tokens(self):
        """Result is the union of UUID-based and user-based tokens."""
        _make_device('p_d5', push_token='tok-puuid', player_ids=[7])
        user = _make_user('p_u3')
        _make_device('p_d6', push_token='tok-puser', user=user)
        _make_user_favorite(user, player_ids=[7])
        result = self.fn(7)
        self.assertIn('tok-puuid', result)
        self.assertIn('tok-puser', result)
        self.assertEqual(len(result), 2)

    def test_duplicate_token_deduplicated(self):
        """Token appearing in both UUID and user paths is returned only once."""
        user = _make_user('p_u4')
        _make_device('p_d7', push_token='tok-PSAME', player_ids=[7], user=user)
        _make_user_favorite(user, player_ids=[7])
        result = self.fn(7)
        self.assertEqual(result.count('tok-PSAME'), 1)

    def test_different_player_id_not_returned(self):
        """Device favoriting a different player is NOT included."""
        _make_device('p_d8', push_token='tok-pwrong', player_ids=[99])
        self.assertNotIn('tok-pwrong', self.fn(7))

    def test_multiple_uuid_devices(self):
        """Multiple UUID devices all favoriting the same player are all returned."""
        _make_device('p_d9', push_token='tok-pu1', player_ids=[7])
        _make_device('p_d10', push_token='tok-pu2', player_ids=[7])
        _make_device('p_d11', push_token='tok-pu3', player_ids=[7])
        self.assertEqual(len(self.fn(7)), 3)

    def test_multiple_user_linked_devices(self):
        """All devices linked to a user with the player favorited are returned."""
        user = _make_user('p_u5')
        _make_device('p_d12', push_token='tok-pud1', user=user)
        _make_device('p_d13', push_token='tok-pud2', user=user)
        _make_user_favorite(user, player_ids=[7])
        result = self.fn(7)
        self.assertIn('tok-pud1', result)
        self.assertIn('tok-pud2', result)

    def test_user_with_no_player_favorites_contributes_nothing(self):
        """User-linked device where UserFavorite.player_ids is empty gives no tokens."""
        user = _make_user('p_u6')
        _make_device('p_d14', push_token='tok-pnofav', user=user)
        _make_user_favorite(user, player_ids=[])
        self.assertNotIn('tok-pnofav', self.fn(7))

    def test_multiple_players_in_favorites_each_match(self):
        """Device with multiple player IDs responds to each of them."""
        _make_device('p_d15', push_token='tok-pmulti', player_ids=[7, 14, 21])
        self.assertIn('tok-pmulti', self.fn(7))
        self.assertIn('tok-pmulti', self.fn(14))
        self.assertIn('tok-pmulti', self.fn(21))
        self.assertNotIn('tok-pmulti', self.fn(99))


# ===========================================================================
# Tests 40–49: user_link_device_view  POST /oneFourSeven/user/link-device/
# ===========================================================================

class UserLinkDeviceViewTest(TestCase):
    """Verify POST /oneFourSeven/user/link-device/ behaviour."""

    URL = '/oneFourSeven/user/link-device/'

    def setUp(self):
        self.client = APIClient()
        self.user = _make_user('lv_user')
        self.client.force_authenticate(user=self.user)

    def test_links_existing_device(self):
        """Links an already-registered device to the authenticated user."""
        from oneFourSeven.models import DeviceToken
        _make_device('lv_dev1')
        response = self.client.post(self.URL, {'device_id': 'lv_dev1'})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(DeviceToken.objects.get(device_id='lv_dev1').user, self.user)

    def test_creates_device_if_not_exists(self):
        """Creates a DeviceToken row when the device_id is brand new."""
        from oneFourSeven.models import DeviceToken
        response = self.client.post(self.URL, {'device_id': 'lv_brand_new'})
        self.assertEqual(response.status_code, 200)
        self.assertTrue(DeviceToken.objects.filter(device_id='lv_brand_new').exists())

    def test_unauthenticated_returns_401(self):
        """Unauthenticated request is rejected with 401."""
        anon = APIClient()
        response = anon.post(self.URL, {'device_id': 'lv_dev2'})
        self.assertEqual(response.status_code, 401)

    def test_missing_device_id_returns_400(self):
        """Empty body (no device_id key) returns 400."""
        response = self.client.post(self.URL, {})
        self.assertEqual(response.status_code, 400)

    def test_blank_device_id_returns_400(self):
        """Whitespace-only device_id returns 400."""
        response = self.client.post(self.URL, {'device_id': '   '})
        self.assertEqual(response.status_code, 400)

    def test_links_to_requesting_user_not_another(self):
        """Device previously owned by user A is re-linked to user B (the requester)."""
        from oneFourSeven.models import DeviceToken
        other = _make_user('lv_other')
        _make_device('lv_dev3', user=other)
        response = self.client.post(self.URL, {'device_id': 'lv_dev3'})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(DeviceToken.objects.get(device_id='lv_dev3').user, self.user)

    def test_idempotent_relinking_same_user(self):
        """Linking the same device to the same user twice both return 200."""
        _make_device('lv_dev4', user=self.user)
        r1 = self.client.post(self.URL, {'device_id': 'lv_dev4'})
        r2 = self.client.post(self.URL, {'device_id': 'lv_dev4'})
        self.assertEqual(r1.status_code, 200)
        self.assertEqual(r2.status_code, 200)

    def test_get_method_not_allowed(self):
        """GET /user/link-device/ returns 405."""
        response = self.client.get(self.URL)
        self.assertEqual(response.status_code, 405)

    def test_response_body_status_linked(self):
        """Successful response contains {'status': 'linked'}."""
        _make_device('lv_dev5')
        response = self.client.post(self.URL, {'device_id': 'lv_dev5'})
        self.assertEqual(response.data.get('status'), 'linked')

    def test_device_user_field_persisted(self):
        """After link, device.user is persisted (survives a fresh DB read)."""
        from oneFourSeven.models import DeviceToken
        _make_device('lv_dev6')
        self.client.post(self.URL, {'device_id': 'lv_dev6'})
        device = DeviceToken.objects.get(device_id='lv_dev6')
        self.assertIsNotNone(device.user)
        self.assertEqual(device.user.pk, self.user.pk)


# ===========================================================================
# Tests 50–56: user_favorites_view  GET /oneFourSeven/user/favorites/
# ===========================================================================

class UserFavoritesViewTest(TestCase):
    """Verify GET /oneFourSeven/user/favorites/ behaviour."""

    URL = '/oneFourSeven/user/favorites/'

    def setUp(self):
        self.client = APIClient()
        self.user = _make_user('fv_user')
        self.client.force_authenticate(user=self.user)

    def test_returns_empty_lists_for_new_user(self):
        """New user with no UserFavorite gets empty player_ids and match_ids."""
        response = self.client.get(self.URL)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['player_ids'], [])
        self.assertEqual(response.data['match_ids'], [])

    def test_returns_correct_player_ids(self):
        """Returns the player_ids stored in the user's UserFavorite."""
        _make_user_favorite(self.user, player_ids=[1, 2, 3])
        response = self.client.get(self.URL)
        self.assertEqual(sorted(response.data['player_ids']), [1, 2, 3])

    def test_returns_correct_match_ids(self):
        """Returns the match_ids stored in the user's UserFavorite."""
        _make_user_favorite(self.user, match_ids=[10, 20])
        response = self.client.get(self.URL)
        self.assertEqual(sorted(response.data['match_ids']), [10, 20])

    def test_unauthenticated_returns_401(self):
        """Unauthenticated request returns 401."""
        anon = APIClient()
        response = anon.get(self.URL)
        self.assertEqual(response.status_code, 401)

    def test_creates_userfavorite_row_on_first_get(self):
        """GET auto-creates a UserFavorite row if none exists yet."""
        from oneFourSeven.models import UserFavorite
        self.assertFalse(UserFavorite.objects.filter(user=self.user).exists())
        self.client.get(self.URL)
        self.assertTrue(UserFavorite.objects.filter(user=self.user).exists())

    def test_response_has_both_keys(self):
        """Response always contains both 'player_ids' and 'match_ids' keys."""
        response = self.client.get(self.URL)
        self.assertIn('player_ids', response.data)
        self.assertIn('match_ids', response.data)

    def test_post_not_allowed(self):
        """POST returns 405 Method Not Allowed."""
        response = self.client.post(self.URL, {})
        self.assertEqual(response.status_code, 405)


# ===========================================================================
# Tests 57–64: user_favorites_players_view  PATCH /user/favorites/players/
# ===========================================================================

class UserFavoritesPlayersViewTest(TestCase):
    """Verify PATCH /oneFourSeven/user/favorites/players/ behaviour."""

    URL = '/oneFourSeven/user/favorites/players/'

    def setUp(self):
        self.client = APIClient()
        self.user = _make_user('fp_user')
        self.client.force_authenticate(user=self.user)

    def test_patch_replaces_player_ids(self):
        """PATCH replaces the existing favorite_player_ids."""
        _make_user_favorite(self.user, player_ids=[1])
        response = self.client.patch(self.URL, {'player_ids': [10, 20, 30]}, format='json')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(sorted(response.data['player_ids']), [10, 20, 30])

    def test_unauthenticated_returns_401(self):
        """Unauthenticated request returns 401."""
        anon = APIClient()
        response = anon.patch(self.URL, {'player_ids': [1]}, format='json')
        self.assertEqual(response.status_code, 401)

    def test_player_ids_not_a_list_returns_400(self):
        """Sending player_ids as a string returns 400."""
        response = self.client.patch(self.URL, {'player_ids': 'not-a-list'}, format='json')
        self.assertEqual(response.status_code, 400)

    def test_empty_list_clears_player_favorites(self):
        """Sending [] clears all player favorites."""
        from oneFourSeven.models import UserFavorite
        _make_user_favorite(self.user, player_ids=[1, 2, 3])
        self.client.patch(self.URL, {'player_ids': []}, format='json')
        self.assertEqual(UserFavorite.objects.get(user=self.user).favorite_player_ids, [])

    def test_creates_userfavorite_if_not_exists(self):
        """PATCH creates a UserFavorite row when none exists."""
        from oneFourSeven.models import UserFavorite
        self.assertFalse(UserFavorite.objects.filter(user=self.user).exists())
        self.client.patch(self.URL, {'player_ids': [5]}, format='json')
        self.assertTrue(UserFavorite.objects.filter(user=self.user).exists())

    def test_does_not_modify_match_ids(self):
        """Updating player_ids does NOT overwrite the existing match_ids."""
        from oneFourSeven.models import UserFavorite
        _make_user_favorite(self.user, player_ids=[1], match_ids=[99])
        self.client.patch(self.URL, {'player_ids': [2]}, format='json')
        self.assertEqual(UserFavorite.objects.get(user=self.user).favorite_match_ids, [99])

    def test_ids_stored_as_integers(self):
        """player_ids are coerced to int and stored as integers."""
        from oneFourSeven.models import UserFavorite
        self.client.patch(self.URL, {'player_ids': [7, 8]}, format='json')
        fav = UserFavorite.objects.get(user=self.user)
        self.assertTrue(all(isinstance(pid, int) for pid in fav.favorite_player_ids))

    def test_get_method_not_allowed(self):
        """GET returns 405 Method Not Allowed."""
        response = self.client.get(self.URL)
        self.assertEqual(response.status_code, 405)


# ===========================================================================
# Tests 65–72: user_favorites_matches_view  PATCH /user/favorites/matches/
# ===========================================================================

class UserFavoritesMatchesViewTest(TestCase):
    """Verify PATCH /oneFourSeven/user/favorites/matches/ behaviour."""

    URL = '/oneFourSeven/user/favorites/matches/'

    def setUp(self):
        self.client = APIClient()
        self.user = _make_user('fm_user')
        self.client.force_authenticate(user=self.user)

    def test_patch_replaces_match_ids(self):
        """PATCH replaces the existing favorite_match_ids."""
        _make_user_favorite(self.user, match_ids=[1])
        response = self.client.patch(self.URL, {'match_ids': [100, 200]}, format='json')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(sorted(response.data['match_ids']), [100, 200])

    def test_unauthenticated_returns_401(self):
        """Unauthenticated request returns 401."""
        anon = APIClient()
        response = anon.patch(self.URL, {'match_ids': [1]}, format='json')
        self.assertEqual(response.status_code, 401)

    def test_match_ids_not_a_list_returns_400(self):
        """Sending match_ids as a dict returns 400."""
        response = self.client.patch(self.URL, {'match_ids': {'bad': 'type'}}, format='json')
        self.assertEqual(response.status_code, 400)

    def test_empty_list_clears_match_favorites(self):
        """Sending [] clears all match favorites."""
        from oneFourSeven.models import UserFavorite
        _make_user_favorite(self.user, match_ids=[100, 200])
        self.client.patch(self.URL, {'match_ids': []}, format='json')
        self.assertEqual(UserFavorite.objects.get(user=self.user).favorite_match_ids, [])

    def test_creates_userfavorite_if_not_exists(self):
        """PATCH creates a UserFavorite row when none exists."""
        from oneFourSeven.models import UserFavorite
        self.assertFalse(UserFavorite.objects.filter(user=self.user).exists())
        self.client.patch(self.URL, {'match_ids': [50]}, format='json')
        self.assertTrue(UserFavorite.objects.filter(user=self.user).exists())

    def test_does_not_modify_player_ids(self):
        """Updating match_ids does NOT overwrite the existing player_ids."""
        from oneFourSeven.models import UserFavorite
        _make_user_favorite(self.user, player_ids=[77], match_ids=[1])
        self.client.patch(self.URL, {'match_ids': [200]}, format='json')
        self.assertEqual(UserFavorite.objects.get(user=self.user).favorite_player_ids, [77])

    def test_response_contains_match_ids_key(self):
        """Response body contains 'match_ids' key with the updated values."""
        response = self.client.patch(self.URL, {'match_ids': [300, 400]}, format='json')
        self.assertIn('match_ids', response.data)
        self.assertEqual(sorted(response.data['match_ids']), [300, 400])

    def test_get_method_not_allowed(self):
        """GET returns 405 Method Not Allowed."""
        response = self.client.get(self.URL)
        self.assertEqual(response.status_code, 405)
