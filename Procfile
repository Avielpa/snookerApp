web: cd maxBreak && python manage.py runserver 0.0.0.0:$PORT

# === LIVE MATCH MONITORING SYSTEM ===
# Primary live match monitoring - runs continuously and detects live matches automatically
live_monitor: cd maxBreak && python manage.py intelligent_live_monitor --check-interval 120 --quiet-interval 900 --max-events 5

# Smart live updates - efficient updates only when tournaments are active
smart_live: cd maxBreak && python manage.py smart_live_update