"""
One-shot command to fetch news from RSS feeds into the DB.
Run once manually to seed the DB, then auto_live_monitor keeps it updated every 2 hours.

Usage:
    python manage.py fetch_news
"""
import re
import urllib.request
from email.utils import parsedate_to_datetime

from django.core.management.base import BaseCommand
from django.utils import timezone

from oneFourSeven.models import NewsArticle

RSS_FEEDS = [
    ('https://feeds.bbci.co.uk/sport/snooker/rss.xml', 'BBC Sport'),
    ('https://wpbsa.com/feed', 'WPBSA'),
    ('https://snookerhq.com/feed', 'SnookerHQ'),
]


def extract_text(xml, tag):
    m = re.search(rf'<{tag}[^>]*><!\[CDATA\[([\s\S]*?)\]\]><\/{tag}>', xml)
    if m:
        return m.group(1).strip()
    m = re.search(rf'<{tag}[^>]*>([\s\S]*?)<\/{tag}>', xml)
    if m:
        return m.group(1).strip()
    return ''


def extract_link(item_xml):
    link = extract_text(item_xml, 'link')
    if link.startswith('http'):
        return link
    guid = extract_text(item_xml, 'guid')
    if guid.startswith('http'):
        return guid
    return ''


def extract_image(item_xml):
    for pattern in [
        r'media:thumbnail[^>]*url="([^"]+)"',
        r'enclosure[^>]*url="([^"]+\.(jpg|jpeg|png|webp)[^"]*)"',
        r'media:content[^>]*url="([^"]+)"',
    ]:
        m = re.search(pattern, item_xml)
        if m:
            return m.group(1)
    return None


class Command(BaseCommand):
    help = 'Fetch latest news from RSS feeds and save to DB (run once to seed, auto_live_monitor keeps it updated)'

    def handle(self, *args, **options):
        new_count = 0
        for feed_url, source_name in RSS_FEEDS:
            self.stdout.write(f'Fetching {source_name}...')
            try:
                req = urllib.request.Request(
                    feed_url,
                    headers={'User-Agent': 'Mozilla/5.0 (compatible; snooker-app/1.0)'}
                )
                with urllib.request.urlopen(req, timeout=10) as response:
                    xml = response.read().decode('utf-8', errors='ignore')

                items = re.findall(r'<item[\s>][\s\S]*?<\/item>', xml)
                for item_xml in items[:5]:
                    title = extract_text(item_xml, 'title')
                    url = extract_link(item_xml)
                    if not title or not url:
                        continue

                    raw_date = extract_text(item_xml, 'pubDate')
                    try:
                        pub_date = parsedate_to_datetime(raw_date) if raw_date else timezone.now()
                    except Exception:
                        pub_date = timezone.now()

                    _, created = NewsArticle.objects.get_or_create(
                        url=url,
                        defaults={
                            'title': title,
                            'image_url': extract_image(item_xml),
                            'source_name': source_name,
                            'published_at': pub_date,
                        }
                    )
                    if created:
                        new_count += 1

                self.stdout.write(self.style.SUCCESS(f'  {source_name}: OK'))
            except Exception as e:
                self.stdout.write(self.style.ERROR(f'  {source_name}: FAILED - {e}'))

        self.stdout.write(self.style.SUCCESS(f'Done: {new_count} new articles saved ({NewsArticle.objects.count()} total)'))
