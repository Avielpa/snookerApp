@echo off
echo Starting local live monitor for Railway production database...
echo This will connect to your Railway database and update matches automatically
echo Press Ctrl+C to stop
echo.

cd maxBreak
venv\Scripts\python.exe manage.py auto_live_monitor --active-interval 120 --sleep-interval 900