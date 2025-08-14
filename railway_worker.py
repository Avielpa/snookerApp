#!/usr/bin/env python3
"""
Simple Railway worker script for live monitoring
"""
import os
import sys
from pathlib import Path

def main():
    # Change to maxBreak directory
    maxbreak_dir = Path(__file__).parent / "maxBreak"
    os.chdir(maxbreak_dir)
    
    # Set Django settings
    os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'maxBreak.settings')
    
    # Add maxBreak to Python path
    sys.path.insert(0, str(maxbreak_dir))
    
    # Import Django and run live monitor
    try:
        import django
        from django.core.management import execute_from_command_line
        
        # Setup Django
        django.setup()
        
        print("[WORKER] Starting live monitor...")
        
        # Run live monitor
        execute_from_command_line(['manage.py', 'auto_live_monitor'])
    except Exception as e:
        print(f"Error starting live monitor: {e}")
        # Fallback to direct system call
        os.system('python manage.py auto_live_monitor')

if __name__ == '__main__':
    main()