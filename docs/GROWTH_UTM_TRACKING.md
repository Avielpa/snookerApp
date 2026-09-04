# Growth UTM Tracking

**Problem (found 2026-09-03):** Firebase Analytics acquisition data only ever showed
"Organic Search" and "Direct" as install channels, despite weeks of Reddit comments,
Facebook group posts, and Instagram comments driving traffic to the Play Store listing.
Every outbound link was the bare listing URL, so there was no way to tell which channel
(if any) was actually converting.

**Fix:** Google Play natively supports a `referrer` query param on the store listing URL.
Firebase Analytics (already integrated in this app) automatically reads that param via the
Play Install Referrer API and populates the `first_open` event's traffic source — visible in
Firebase Console → Analytics → Acquisition reports (and GA4's Traffic acquisition report) as
source / medium / campaign. **No app code change required** — this is a Play Store + Firebase
platform feature.

## Link format

```
https://play.google.com/store/apps/details?id=com.avielpahima.maxbreaksnooker&referrer=<url-encoded utm string>
```

The `referrer` value is itself a query string (`utm_source=X&utm_medium=Y&utm_campaign=Z`),
so it must be URL-encoded as a whole before appending.

## Generating a tagged link

```python
import urllib.parse
def link(source, medium, campaign):
    inner = f'utm_source={source}&utm_medium={medium}&utm_campaign={campaign}'
    ref = urllib.parse.quote(inner, safe='')
    return f'https://play.google.com/store/apps/details?id=com.avielpahima.maxbreaksnooker&referrer={ref}'
```

## Convention

- `utm_source`: the platform — `reddit`, `facebook`, `instagram`, `youtube`, etc.
- `utm_medium`: the placement — `comment`, `group_post`, `bio_link`, `dm`, etc.
- `utm_campaign`: a short slug for the specific push — `snooker_227k`, `british_open_promo`, `reddit_general`, etc.

## Rules going forward

1. **Every outbound link shared for growth** (Reddit comments, Facebook posts, Instagram bio/comments,
   any future creator outreach) must use a tagged link, not the bare Play Store URL.
2. QR codes in promo graphics must encode the tagged link, not the bare one.
3. Check attribution in Firebase Console → Analytics Dashboard → scroll to "Average 120d value by
   First user primary channel group" or the Acquisition report — tagged sources appear as their
   own row instead of collapsing into Organic Search / Direct.

## Known gap

The British Open promo graphic posted 2026-09-03 to the Snooker (227K) Facebook group used the
**bare, untagged** Play Store link (built before this fix existed). That post's installs will still
show as Organic/Direct — not fixed retroactively. Everything posted after this doc exists should
use tagged links.
