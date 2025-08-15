#!/usr/bin/env python
"""Django's command-line utility for administrative tasks."""
import os
import sys


def main():
    """Run administrative tasks."""
    os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'maxBreak.settings')
    
    # Check if we should run live match detection
    if os.environ.get('RAILWAY_RUN_LIVE_MONITOR') == 'true':
        # Import Django setup
        import django
        django.setup()
        
        # Run live match detector
        from django.core.management import call_command
        print("🔥 LIVE MATCH DETECTOR STARTING...")
        call_command('live_match_detector')
        print("✅ Live Match Detection completed")
        return
    
    try:
        from django.core.management import execute_from_command_line
    except ImportError as exc:
        raise ImportError(
            "Couldn't import Django. Are you sure it's installed and "
            "available on your PYTHONPATH environment variable? Did you "
            "forget to activate a virtual environment?"
        ) from exc
    execute_from_command_line(sys.argv)


if __name__ == '__main__':
    main()
