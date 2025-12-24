"""
Test if snooker.org API returns matches for Championship League - Group 1
Run with: python test_api_matches.py
"""
import requests
import json

EVENT_ID = 2368  # Championship League - Group 1
API_BASE = "https://api.snooker.org/"
HEADERS = {"X-Requested-By": "FahimaApp128"}

print("=" * 80)
print(f"TESTING: Fetching matches for Event ID {EVENT_ID} from snooker.org API")
print("=" * 80)

# Fetch matches for this event (t=6 means matches of an event)
url = f"{API_BASE}?t=6&e={EVENT_ID}"
print(f"\nAPI URL: {url}")

try:
    response = requests.get(url, headers=HEADERS, timeout=30)
    response.raise_for_status()

    data = response.json()

    print(f"\nAPI Response Status: {response.status_code} ✅")
    print(f"Response Type: {type(data)}")

    if isinstance(data, list):
        print(f"Number of matches returned: {len(data)}")

        if len(data) > 0:
            print("\n✅ API HAS MATCHES! First 3 matches:")
            for i, match in enumerate(data[:3], 1):
                print(f"\n  Match {i}:")
                print(f"    ID: {match.get('ID')}")
                print(f"    Round: {match.get('Round')}")
                print(f"    Number: {match.get('Number')}")
                print(f"    Player1: {match.get('Player1ID')} (Score: {match.get('Score1')})")
                print(f"    Player2: {match.get('Player2ID')} (Score: {match.get('Score2')})")
                print(f"    Status: {match.get('Status')}")
                print(f"    ScheduledDate: {match.get('ScheduledDate')}")
        else:
            print("\n❌ API returned EMPTY list - no matches available yet!")
            print("   This event might not have matches scheduled yet.")
    else:
        print(f"\n⚠️ Unexpected response type: {type(data)}")
        print(f"Response: {data}")

except requests.exceptions.RequestException as e:
    print(f"\n❌ API Request failed: {e}")
except json.JSONDecodeError as e:
    print(f"\n❌ JSON decode error: {e}")
    print(f"Response text: {response.text[:200]}")

print("\n" + "=" * 80)
