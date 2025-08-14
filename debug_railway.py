#!/usr/bin/env python3
import os
import sys

print("=== RAILWAY DEBUG INFO ===")
print(f"Current working directory: {os.getcwd()}")
print(f"Python executable: {sys.executable}")
print(f"Python path: {sys.path}")

print("\n=== DIRECTORY CONTENTS ===")
try:
    files = os.listdir('.')
    print("Files in current directory:")
    for f in sorted(files):
        print(f"  {f}")
except Exception as e:
    print(f"Error listing current directory: {e}")

print("\n=== MAXBREAK DIRECTORY CHECK ===")
try:
    if os.path.exists('maxBreak'):
        print("maxBreak directory exists!")
        files = os.listdir('maxBreak')
        print("Files in maxBreak:")
        for f in sorted(files):
            print(f"  {f}")
        
        if os.path.exists('maxBreak/manage.py'):
            print("✅ manage.py found in maxBreak/")
        else:
            print("❌ manage.py NOT found in maxBreak/")
    else:
        print("❌ maxBreak directory does NOT exist")
except Exception as e:
    print(f"Error checking maxBreak: {e}")

print("\n=== ENVIRONMENT VARIABLES ===")
for key in sorted(os.environ.keys()):
    if 'PORT' in key or 'RAILWAY' in key or 'PATH' in key:
        print(f"{key}: {os.environ[key]}")