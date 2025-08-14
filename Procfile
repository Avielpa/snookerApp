web: cd maxBreak && gunicorn --bind 0.0.0.0:$PORT maxBreak.wsgi:application
worker: cd maxBreak && python manage.py auto_live_monitor