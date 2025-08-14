#!/bin/bash

# Railway Startup Script
# Starts both Django server and live monitor

set -e  # Exit on error

echo "Railway startup script starting..."
echo "Working directory: $(pwd)"
echo "Contents: $(ls -la)"

# Navigate to Django project
cd maxBreak
echo "Changed to maxBreak directory: $(pwd)"

# Run migrations
echo "Running Django migrations..."
python manage.py migrate --noinput

# Start live monitor in background if enabled
if [ "$RAILWAY_RUN_LIVE_MONITOR" = "true" ]; then
    echo "Starting live monitor in background..."
    nohup python manage.py auto_live_monitor > live_monitor.log 2>&1 &
    MONITOR_PID=$!
    echo "Live monitor started with PID: $MONITOR_PID"
    sleep 2  # Give it time to start
else
    echo "Live monitor disabled (RAILWAY_RUN_LIVE_MONITOR not set to true)"
fi

# Start Django server in foreground
echo "Starting Django server on port $PORT..."
exec python manage.py runserver 0.0.0.0:$PORT