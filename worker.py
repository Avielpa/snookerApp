#!/usr/bin/env python3
"""
Railway Worker Process - Runs live monitoring alongside main Django app
"""
import os
import sys
import time
import subprocess
import threading
from pathlib import Path

def run_live_monitor():
    """Run the live monitor in a separate thread"""
    print("[WORKER] Starting live monitor thread...")
    
    # Change to Django directory
    os.chdir('maxBreak')
    
    try:
        # Run the live monitor
        subprocess.run([
            sys.executable, 'manage.py', 'auto_live_monitor'
        ], check=True)
    except Exception as e:
        print(f"[WORKER] Live monitor error: {e}")
        time.sleep(60)  # Wait before potential restart

def main():
    """Main worker entry point"""
    print("[WORKER] Railway worker starting...")
    
    # Only run live monitor if explicitly enabled
    if os.environ.get('RAILWAY_RUN_LIVE_MONITOR') == 'true':
        print("[WORKER] Live monitor enabled - starting background thread")
        
        # Start live monitor in background thread
        monitor_thread = threading.Thread(target=run_live_monitor, daemon=True)
        monitor_thread.start()
        
        # Keep worker alive
        try:
            while True:
                time.sleep(30)  # Check every 30 seconds
                if not monitor_thread.is_alive():
                    print("[WORKER] Live monitor thread died - restarting...")
                    monitor_thread = threading.Thread(target=run_live_monitor, daemon=True)
                    monitor_thread.start()
        except KeyboardInterrupt:
            print("[WORKER] Worker shutting down...")
    else:
        print("[WORKER] Live monitor disabled - worker idle")
        # Keep worker alive but idle
        while True:
            time.sleep(60)

if __name__ == '__main__':
    main()