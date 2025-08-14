#!/usr/bin/env python3
"""
Django App with Integrated Live Monitor for Railway Deployment
Runs the Django server and live monitoring in parallel.
"""
import os
import sys
import threading
import time
import subprocess
import signal
from pathlib import Path

def run_live_monitor():
    """Run the live monitor in a background thread"""
    print("[LIVE_MONITOR] Starting background live monitor...")
    
    try:
        # Change to Django directory
        django_dir = Path(__file__).parent / "maxBreak"
        os.chdir(django_dir)
        
        # Set Django settings
        os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'maxBreak.settings')
        
        # Import Django and run the live monitor command
        import django
        django.setup()
        
        from django.core.management import execute_from_command_line
        
        # Run the live monitor command
        execute_from_command_line(['manage.py', 'auto_live_monitor'])
        
    except Exception as e:
        print(f"[LIVE_MONITOR] Error: {e}")
        time.sleep(60)  # Wait before potential restart

def main():
    """Main entry point for Railway deployment"""
    print("[RAILWAY] Starting Django app with integrated live monitor...")
    
    # Set environment variables
    os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'maxBreak.settings')
    
    # Start live monitor in background thread
    monitor_thread = threading.Thread(target=run_live_monitor, daemon=True)
    monitor_thread.start()
    print("[RAILWAY] Live monitor started in background")
    
    # Change to Django directory
    django_dir = Path(__file__).parent / "maxBreak"
    os.chdir(django_dir)
    
    # Start Django server (main thread)
    port = os.environ.get('PORT', '8000')
    print(f"[RAILWAY] Starting Django server on port {port}")
    
    try:
        # Use gunicorn for production
        subprocess.run([
            'gunicorn', 
            '--bind', f'0.0.0.0:{port}',
            '--workers', '2',
            '--timeout', '120',
            'maxBreak.wsgi:application'
        ])
    except KeyboardInterrupt:
        print("[RAILWAY] Shutting down...")
    except Exception as e:
        print(f"[RAILWAY] Error starting server: {e}")
        # Fallback to Django dev server
        os.system(f'python manage.py runserver 0.0.0.0:{port}')

if __name__ == '__main__':
    main()