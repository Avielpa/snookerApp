"""
Tests for the match favorite / notification api_match_id churn fix.

Bug: snooker.org rotates a match's api_match_id (observed 10220801 -> 10232815
-> 10232821 for one Championship League match in a few hours). Favorites stored
the volatile api_match_id, so the favorite star + push notifications silently
broke on rotation. The fix additionally tracks the stable MatchesOfAnEvent.id
(Django PK) in favorite_match_db_ids while keeping favorite_match_ids for
backward compatibility and an identical response shape.

See docs/BUG_match_favorite_id_churn_2026-07-09.md and the approved plan.
"""
from django.test import TestCase
from rest_framework.test import APIClient

from .models import Event, MatchesOfAnEvent, DeviceToken, UserFavorite
from .push_notifications import get_tokens_for_match, get_tokens_for_match_db_id
from .tests import _make_user, _make_device, _make_user_favorite


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_event(event_id=5000):
    return Event.objects.get_or_create(ID=event_id, defaults={'Name': 'Test Event'})[0]


def _make_match(api_match_id, event=None, round_no=1, number=1):
    """Create a MatchesOfAnEvent row with a given api_match_id. Returns the row."""
    if event is None:
        event = _make_event()
    return MatchesOfAnEvent.objects.create(
        api_match_id=api_match_id, Event=event, Round=round_no, Number=number,
    )


def _churn(match, new_api_id):
    """Simulate snooker.org reassigning the api_match_id on the SAME logical row."""
    match.api_match_id = new_api_id
    match.save(update_fields=['api_match_id'])
    return match


# ===========================================================================
# Model field defaults
# ===========================================================================

class FavoriteMatchDbIdsFieldTest(TestCase):

    def test_device_default_empty_list(self):
        d = DeviceToken.objects.create(device_id='fld_d1')
        self.assertEqual(d.favorite_match_db_ids, [])

    def test_userfavorite_default_empty_list(self):
        fav = UserFavorite.objects.create(user=_make_user('fld_u1'))
        self.assertEqual(fav.favorite_match_db_ids, [])

    def test_device_persists_db_ids(self):
        d = DeviceToken.objects.create(device_id='fld_d2', favorite_match_db_ids=[7, 8])
        self.assertEqual(DeviceToken.objects.get(device_id='fld_d2').favorite_match_db_ids, [7, 8])


# ===========================================================================
# get_tokens_for_match_db_id helper
# ===========================================================================

class GetTokensForMatchDbIdTest(TestCase):

    def test_empty_when_no_devices(self):
        self.assertEqual(get_tokens_for_match_db_id(999), [])

    def test_uuid_device_with_db_id_returned(self):
        _make_device('mdb_d1', push_token='tok-A')
        DeviceToken.objects.filter(device_id='mdb_d1').update(favorite_match_db_ids=[42])
        self.assertIn('tok-A', get_tokens_for_match_db_id(42))

    def test_uuid_device_without_push_token_excluded(self):
        d = _make_device('mdb_d2', push_token='')
        d.favorite_match_db_ids = [42]; d.save()
        self.assertEqual(get_tokens_for_match_db_id(42), [])

    def test_user_linked_device_returned(self):
        user = _make_user('mdb_u1')
        _make_device('mdb_d3', push_token='tok-B', user=user)
        fav = _make_user_favorite(user)
        fav.favorite_match_db_ids = [42]; fav.save()
        self.assertIn('tok-B', get_tokens_for_match_db_id(42))

    def test_user_linked_device_without_token_excluded(self):
        user = _make_user('mdb_u2')
        _make_device('mdb_d4', push_token='', user=user)
        fav = _make_user_favorite(user)
        fav.favorite_match_db_ids = [42]; fav.save()
        self.assertEqual(get_tokens_for_match_db_id(42), [])

    def test_union_and_dedup(self):
        d = _make_device('mdb_d5', push_token='tok-uuid'); d.favorite_match_db_ids = [42]; d.save()
        user = _make_user('mdb_u3')
        _make_device('mdb_d6', push_token='tok-user', user=user)
        fav = _make_user_favorite(user); fav.favorite_match_db_ids = [42]; fav.save()
        result = get_tokens_for_match_db_id(42)
        self.assertIn('tok-uuid', result)
        self.assertIn('tok-user', result)
        self.assertEqual(len(result), 2)

    def test_duplicate_token_deduplicated(self):
        user = _make_user('mdb_u4')
        d = _make_device('mdb_d7', push_token='tok-SAME', user=user)
        d.favorite_match_db_ids = [42]; d.save()
        fav = _make_user_favorite(user); fav.favorite_match_db_ids = [42]; fav.save()
        self.assertEqual(get_tokens_for_match_db_id(42).count('tok-SAME'), 1)

    def test_different_db_id_not_returned(self):
        d = _make_device('mdb_d8', push_token='tok-wrong'); d.favorite_match_db_ids = [99]; d.save()
        self.assertNotIn('tok-wrong', get_tokens_for_match_db_id(42))

    def test_empty_db_ids_excluded(self):
        _make_device('mdb_d9', push_token='tok-empty')
        self.assertNotIn('tok-empty', get_tokens_for_match_db_id(42))


# ===========================================================================
# Device PATCH — write translation
# ===========================================================================

class DeviceWriteTranslationTest(TestCase):
    URL = '/oneFourSeven/device/favorites/matches/'

    def setUp(self):
        self.client = APIClient()

    def test_resolvable_id_populates_db_ids(self):
        m = _make_match(api_match_id=10220801)
        self.client.patch(self.URL, {'device_id': 'w1', 'match_ids': [10220801]}, format='json')
        d = DeviceToken.objects.get(device_id='w1')
        self.assertEqual(d.favorite_match_db_ids, [m.pk])

    def test_raw_ids_still_stored_for_backward_compat(self):
        _make_match(api_match_id=10220801)
        self.client.patch(self.URL, {'device_id': 'w2', 'match_ids': [10220801]}, format='json')
        d = DeviceToken.objects.get(device_id='w2')
        self.assertEqual(d.favorite_match_ids, [10220801])

    def test_unresolvable_id_stored_raw_only(self):
        # Match not in DB yet -> db_ids empty, raw kept, no crash.
        r = self.client.patch(self.URL, {'device_id': 'w3', 'match_ids': [77777]}, format='json')
        self.assertEqual(r.status_code, 200)
        d = DeviceToken.objects.get(device_id='w3')
        self.assertEqual(d.favorite_match_ids, [77777])
        self.assertEqual(d.favorite_match_db_ids, [])

    def test_none_id_does_not_crash(self):
        _make_match(api_match_id=10220801)
        r = self.client.patch(self.URL, {'device_id': 'w4', 'match_ids': [None, 10220801]}, format='json')
        self.assertEqual(r.status_code, 200)
        d = DeviceToken.objects.get(device_id='w4')
        self.assertEqual(d.favorite_match_ids, [10220801])

    def test_response_shape_unchanged(self):
        _make_match(api_match_id=10220801)
        r = self.client.patch(self.URL, {'device_id': 'w5', 'match_ids': [10220801]}, format='json')
        self.assertEqual(set(r.data.keys()), {'status', 'match_ids'})
        self.assertEqual(r.data['match_ids'], [10220801])

    def test_empty_list_clears_both_fields(self):
        m = _make_match(api_match_id=10220801)
        self.client.patch(self.URL, {'device_id': 'w6', 'match_ids': [10220801]}, format='json')
        self.client.patch(self.URL, {'device_id': 'w6', 'match_ids': []}, format='json')
        d = DeviceToken.objects.get(device_id='w6')
        self.assertEqual(d.favorite_match_ids, [])
        self.assertEqual(d.favorite_match_db_ids, [])

    def test_many_favorites(self):
        ev = _make_event()
        matches = [_make_match(api_match_id=1000 + i, event=ev, number=i) for i in range(5)]
        api_ids = [m.api_match_id for m in matches]
        self.client.patch(self.URL, {'device_id': 'w7', 'match_ids': api_ids}, format='json')
        d = DeviceToken.objects.get(device_id='w7')
        self.assertEqual(sorted(d.favorite_match_db_ids), sorted(m.pk for m in matches))


# ===========================================================================
# User PATCH — write translation
# ===========================================================================

class UserWriteTranslationTest(TestCase):
    URL = '/oneFourSeven/user/favorites/matches/'

    def setUp(self):
        self.client = APIClient()
        self.user = _make_user('uw_user')
        self.client.force_authenticate(user=self.user)

    def test_resolvable_id_populates_db_ids(self):
        m = _make_match(api_match_id=10220801)
        self.client.patch(self.URL, {'match_ids': [10220801]}, format='json')
        fav = UserFavorite.objects.get(user=self.user)
        self.assertEqual(fav.favorite_match_db_ids, [m.pk])

    def test_unresolvable_id_stored_raw_only(self):
        r = self.client.patch(self.URL, {'match_ids': [88888]}, format='json')
        self.assertEqual(r.status_code, 200)
        fav = UserFavorite.objects.get(user=self.user)
        self.assertEqual(fav.favorite_match_ids, [88888])
        self.assertEqual(fav.favorite_match_db_ids, [])

    def test_response_shape_unchanged(self):
        _make_match(api_match_id=10220801)
        r = self.client.patch(self.URL, {'match_ids': [10220801]}, format='json')
        self.assertEqual(set(r.data.keys()), {'status', 'match_ids'})
        self.assertEqual(r.data['match_ids'], [10220801])


# ===========================================================================
# Device GET — read reverse-translation, churn healing, self-heal
# ===========================================================================

class DeviceReadTranslationTest(TestCase):
    PATCH_URL = '/oneFourSeven/device/favorites/matches/'
    GET_URL = '/oneFourSeven/device/favorites/'

    def setUp(self):
        self.client = APIClient()

    def _get(self, device_id):
        return self.client.get(self.GET_URL, {'device_id': device_id})

    def test_churn_heals_to_current_api_id(self):
        """THE core case: favorite stored, api_match_id rotates, GET returns the NEW id."""
        m = _make_match(api_match_id=10220801)
        self.client.patch(self.PATCH_URL, {'device_id': 'r1', 'match_ids': [10220801]}, format='json')
        _churn(m, 10232815)
        r = self._get('r1')
        self.assertIn(10232815, r.data['match_ids'])

    def test_response_shape_unchanged(self):
        _make_match(api_match_id=10220801)
        self.client.patch(self.PATCH_URL, {'device_id': 'r2', 'match_ids': [10220801]}, format='json')
        r = self._get('r2')
        self.assertEqual(set(r.data.keys()), {'player_ids', 'match_ids'})

    def test_old_scheme_only_row_still_works(self):
        """Pre-fix row: only favorite_match_ids populated, db_ids empty (rule 8)."""
        d = _make_device('r3', push_token='tok')
        d.favorite_match_ids = [55555]  # legacy, no db id, match not in DB
        d.favorite_match_db_ids = []
        d.save()
        r = self._get('r3')
        self.assertEqual(r.data['match_ids'], [55555])

    def test_old_scheme_row_self_heals_on_read(self):
        """Q2: legacy raw id becomes resolvable later -> db id persisted on read."""
        d = _make_device('r4', push_token='tok')
        d.favorite_match_ids = [10220801]
        d.favorite_match_db_ids = []
        d.save()
        m = _make_match(api_match_id=10220801)  # match published AFTER the favorite
        r = self._get('r4')
        self.assertIn(10220801, r.data['match_ids'])
        self.assertEqual(DeviceToken.objects.get(device_id='r4').favorite_match_db_ids, [m.pk])

    def test_self_heal_then_survives_later_churn(self):
        """After self-heal stores the pk, a subsequent api churn is also handled."""
        d = _make_device('r5', push_token='tok')
        d.favorite_match_ids = [10220801]; d.favorite_match_db_ids = []; d.save()
        m = _make_match(api_match_id=10220801)
        self._get('r5')  # heals -> db_ids=[pk]
        _churn(m, 10232815)
        r = self._get('r5')
        self.assertIn(10232815, r.data['match_ids'])

    def test_nonexistent_device_returns_empty(self):
        r = self._get('does-not-exist')
        self.assertEqual(r.data, {'player_ids': [], 'match_ids': []})

    def test_empty_favorites_returns_empty_match_ids(self):
        _make_device('r6', push_token='tok')
        r = self._get('r6')
        self.assertEqual(r.data['match_ids'], [])


# ===========================================================================
# User GET — read reverse-translation
# ===========================================================================

class UserReadTranslationTest(TestCase):
    PATCH_URL = '/oneFourSeven/user/favorites/matches/'
    GET_URL = '/oneFourSeven/user/favorites/'

    def setUp(self):
        self.client = APIClient()
        self.user = _make_user('ur_user')
        self.client.force_authenticate(user=self.user)

    def test_churn_heals_to_current_api_id(self):
        m = _make_match(api_match_id=10220801)
        self.client.patch(self.PATCH_URL, {'match_ids': [10220801]}, format='json')
        _churn(m, 10232815)
        r = self.client.get(self.GET_URL)
        self.assertIn(10232815, r.data['match_ids'])

    def test_old_scheme_only_row_still_works(self):
        fav = _make_user_favorite(self.user)
        fav.favorite_match_ids = [55555]; fav.favorite_match_db_ids = []; fav.save()
        r = self.client.get(self.GET_URL)
        self.assertEqual(r.data['match_ids'], [55555])

    def test_response_shape_unchanged(self):
        r = self.client.get(self.GET_URL)
        self.assertEqual(set(r.data.keys()), {'player_ids', 'match_ids'})


# ===========================================================================
# Churn sequences + notification token lookup (the payoff)
# ===========================================================================

class ChurnNotificationTest(TestCase):

    def _favorite_via_device(self, device_id, token, api_id):
        d = _make_device(device_id, push_token=token)
        # simulate a proper write through the helper path
        from .views import _write_match_favorites
        _write_match_favorites(d, [api_id])
        return d

    def test_single_reassignment_db_lookup_finds_old_misses(self):
        m = _make_match(api_match_id=10220801)
        self._favorite_via_device('c1', 'tok-1', 10220801)
        _churn(m, 10232815)
        # NEW churn-proof lookup finds the token by stable pk:
        self.assertIn('tok-1', get_tokens_for_match_db_id(m.pk))
        # THE BUG: notifications fire on the CURRENT (churned) api id — the old
        # function misses it because the favorite was stored under the old id.
        self.assertNotIn('tok-1', get_tokens_for_match(10232815))

    def test_three_reassignments_still_found(self):
        """Observed real sequence 10220801 -> 10232815 -> 10232821."""
        m = _make_match(api_match_id=10220801)
        self._favorite_via_device('c2', 'tok-2', 10220801)
        for new_id in (10232815, 10232821):
            _churn(m, new_id)
        # stable-pk lookup still finds it after all three ids:
        self.assertIn('tok-2', get_tokens_for_match_db_id(m.pk))
        # The churned-to api ids (the ones a notification would actually fire on)
        # all miss via the old function — only the pk union rescues them:
        for churned_id in (10232815, 10232821):
            self.assertNotIn('tok-2', get_tokens_for_match(churned_id))

    def _union(self, mid, pk):
        """Mirror the union used in all 4 auto_live_monitor notification blocks."""
        return list(set(get_tokens_for_match(mid)) | set(get_tokens_for_match_db_id(pk)))

    def test_notification_union_finds_token_after_churn(self):
        m = _make_match(api_match_id=10220801)
        self._favorite_via_device('c3', 'tok-3', 10220801)
        _churn(m, 10232815)
        # simulate a notification block reading match.api_match_id (now 10232815) and match.pk
        self.assertIn('tok-3', self._union(m.api_match_id, m.pk))

    def test_notification_union_covers_legacy_api_only_favorite(self):
        """A legacy favorite (api id only, no pk) is still reached via the union."""
        m = _make_match(api_match_id=10220801)
        d = _make_device('c4', push_token='tok-4')
        d.favorite_match_ids = [10220801]; d.favorite_match_db_ids = []; d.save()  # legacy shape
        # match hasn't churned -> old api-id lookup still works via the union
        self.assertIn('tok-4', self._union(m.api_match_id, m.pk))

    def test_union_for_scheduled_live_and_resume_blocks(self):
        """The 4 blocks (upcoming/live/result/resume) all use the same union; verify
        it works regardless of Status by exercising each status value."""
        for status_val, dev in ((0, 'c5a'), (1, 'c5b'), (2, 'c5c'), (3, 'c5d')):
            m = _make_match(api_match_id=20000 + status_val, number=status_val + 1)
            m.Status = status_val; m.save()
            self._favorite_via_device(dev, f'tok-{dev}', m.api_match_id)
            _churn(m, 30000 + status_val)
            self.assertIn(f'tok-{dev}', self._union(m.api_match_id, m.pk))
