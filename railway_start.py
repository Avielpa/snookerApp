#!/usr/bin/env python3
"""
Railway startup script that starts both Django server and live monitor
"""
import os
import sys
import subprocess
import signal
import time

def main():
    print("🚀 Railway Python startup script starting...")
    print(f"Working directory: {os.getcwd()}")
    print(f"Contents: {os.listdir('.')}")
    
    # Change to Django directory
    os.chdir('maxBreak')
    print(f"Changed to maxBreak directory: {os.getcwd()}")
    
    # Run migrations
    print("Running Django migrations...")
    try:
        subprocess.run([sys.executable, 'manage.py', 'migrate', '--noinput'], check=True)
    except subprocess.CalledProcessError as e:
        print(f"Migration failed: {e}")
    
    monitor_process = None
    
    try:
        # Start live monitor if enabled
        if os.environ.get('RAILWAY_RUN_LIVE_MONITOR') == 'true':
            print("Starting live monitor in background...")
            monitor_process = subprocess.Popen([
                sys.executable, 'manage.py', 'auto_live_monitor'
            ])
            print(f"Live monitor started with PID: {monitor_process.pid}")
            time.sleep(2)  # Give it time to start
        else:
            print("Live monitor disabled (RAILWAY_RUN_LIVE_MONITOR not set to true)")
        
        # Start Django server in foreground
        port = os.environ.get('PORT', '8000')
        print(f"Starting Django server on port {port}...")
        subprocess.run([
            sys.executable, 'manage.py', 'runserver', f'0.0.0.0:{port}'
        ])
    
    except KeyboardInterrupt:
        print("Received interrupt signal...")
    finally:
        if monitor_process:
            print("Terminating live monitor...")
            monitor_process.terminate()
            try:
                monitor_process.wait(timeout=5)
            except subprocess.TimeoutExpired:
                print("Force killing live monitor...")
                monitor_process.kill()

if __name__ == '__main__':
    main()