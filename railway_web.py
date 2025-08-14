#!/usr/bin/env python3
"""
Simple Railway web server script
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
    
    # Get port from environment
    port = os.environ.get('PORT', '8000')
    
    # Add maxBreak to Python path
    sys.path.insert(0, str(maxbreak_dir))
    
    # Import Django and run server
    try:
        import django
        from django.core.management import execute_from_command_line
        
        # Setup Django
        django.setup()
        
        # Run server
        execute_from_command_line(['manage.py', 'runserver', f'0.0.0.0:{port}'])
    except Exception as e:
        print(f"[WEB] Error starting server: {e}")
        # Fallback to direct system call
        os.system(f'python manage.py runserver 0.0.0.0:{port}')

if __name__ == '__main__':
    main()