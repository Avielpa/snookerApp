#!/usr/bin/env python
"""
One-time script to populate Railway database with tournament data
Run this once after deployment to populate the empty database
"""
import os
import sys
import django

# Set up Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'maxBreak.settings')
sys.path.append('maxBreak')
django.setup()

from django.core.management import call_command

print("🚀 INITIALIZING RAILWAY DATABASE...")
print("This will populate the database with tournament data...")

try:
    # Update tournaments first (foundation data)
    print("1/4 Updating tournaments...")
    call_command('update_tournaments', '--tour', 'all', '--season', '2025')
    
    # Update players
    print("2/4 Updating players...")
    call_command('update_players', '--status', 'pro', '--sex', 'men')
    
    # Update rankings
    print("3/4 Updating rankings...")
    call_command('update_rankings', '--ranking-type', 'all')
    
    # Update recent matches
    print("4/4 Updating recent matches...")
    call_command('update_matches', '--active-only')
    
    print("✅ DATABASE INITIALIZATION COMPLETE!")
    print("Your Railway app now has tournament data!")
    
except Exception as e:
    print(f"❌ Error during initialization: {e}")
    sys.exit(1)