#!/bin/bash

# Railway Startup Script
# Starts both Django server and live monitor

cd maxBreak

# Start live monitor in background if enabled
if [ "$RAILWAY_RUN_LIVE_MONITOR" = "true" ]; then
    echo "Starting live monitor in background..."
    python manage.py auto_live_monitor &
    MONITOR_PID=$!
    echo "Live monitor started with PID: $MONITOR_PID"
fi

# Start Django server in foreground
echo "Starting Django server..."
python manage.py runserver 0.0.0.0:$PORT