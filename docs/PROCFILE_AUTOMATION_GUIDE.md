# ⚙️ MaxBreak Procfile Automation Guide

This guide shows you how to add automated commands to your Railway deployment using the Procfile, enabling scheduled data updates, background tasks, and deployment automation.

## 📋 **Understanding Your Current Procfile**

**File: `maxBreak/Procfile`**

```bash
web: gunicorn maxBreak.wsgi:application
worker: python comprehensive_scheduler.py  
release: python manage.py migrate --noinput && python manage.py collectstatic --noinput
```

### **Current Process Types:**
- **`web`**: Main Django application server
- **`worker`**: Background task scheduler for data updates
- **`release`**: Commands that run during deployment (migrations, static files)

---

## 🚀 **Step-by-Step: Adding New Automated Commands**

### **STEP 1: Understanding Process Types**

**🔧 Available Process Types:**

- **`web`**: HTTP server processes (your main app)
- **`worker`**: Background job processors  
- **`release`**: One-time commands during deployment
- **`clock`**: Scheduled tasks (like cron jobs)
- **Custom names**: Any name you choose for specific tasks

---

### **STEP 2: Adding Background Workers**

**Example: Adding a dedicated ranking update worker**

**📝 Step 2.1: Create the Worker Script**

Create `maxBreak/ranking_worker.py`:

```python
#!/usr/bin/env python
import os
import sys
import django
import time
import logging
from datetime import datetime

# Django setup
if __name__ == '__main__':
    os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'maxBreak.settings')
    django.setup()

from django.core.management import call_command

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

def ranking_update_worker():
    """
    Background worker that updates rankings every 6 hours
    """
    logger.info("Starting ranking update worker...")
    
    while True:
        try:
            logger.info("Starting ranking update cycle...")
            
            # Update different ranking types
            ranking_types = ['WorldRankings', 'MoneyRankings', 'WomenRankings']
            
            for ranking_type in ranking_types:
                logger.info(f"Updating {ranking_type}...")
                call_command('update_rankings', ranking_type=ranking_type)
                time.sleep(30)  # Brief pause between types
            
            logger.info("Ranking update cycle completed")
            
            # Wait 6 hours (21600 seconds) before next update
            time.sleep(21600)
            
        except Exception as e:
            logger.error(f"Error in ranking worker: {e}")
            # Wait 30 minutes before retry on error
            time.sleep(1800)
        except KeyboardInterrupt:
            logger.info("Ranking worker stopped by user")
            break

if __name__ == '__main__':
    ranking_update_worker()
```

**📝 Step 2.2: Update Procfile**

Add the new worker to your `Procfile`:

```bash
web: gunicorn maxBreak.wsgi:application
worker: python comprehensive_scheduler.py
rankings: python ranking_worker.py
release: python manage.py migrate --noinput && python manage.py collectstatic --noinput
```

---

### **STEP 3: Adding Scheduled Tasks (Clock Processes)**

**Example: Adding daily maintenance tasks**

**📝 Step 3.1: Create Clock Process**

Create `maxBreak/clock_scheduler.py`:

```python
#!/usr/bin/env python
import os
import sys
import django
import schedule
import time
import logging
from datetime import datetime

# Django setup
if __name__ == '__main__':
    os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'maxBreak.settings')
    django.setup()

from django.core.management import call_command

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

def daily_maintenance():
    """Run daily maintenance tasks"""
    try:
        logger.info("Starting daily maintenance...")
        
        # Update tournaments
        call_command('update_tournaments', season='2025')
        
        # Clean up old logs
        call_command('cleanup_logs')
        
        # Update player data
        call_command('update_players', status='pro', limit=50)
        
        logger.info("Daily maintenance completed")
        
    except Exception as e:
        logger.error(f"Error in daily maintenance: {e}")

def weekly_deep_update():
    """Run weekly comprehensive updates"""
    try:
        logger.info("Starting weekly deep update...")
        
        # Full data refresh
        call_command('comprehensive_update', mode='full')
        
        logger.info("Weekly deep update completed")
        
    except Exception as e:
        logger.error(f"Error in weekly update: {e}")

def hourly_live_update():
    """Update live matches every hour"""
    try:
        logger.info("Updating live matches...")
        call_command('update_live_matches')
        
    except Exception as e:
        logger.error(f"Error updating live matches: {e}")

# Schedule tasks
schedule.every().day.at("02:00").do(daily_maintenance)
schedule.every().sunday.at("01:00").do(weekly_deep_update)  
schedule.every().hour.do(hourly_live_update)

logger.info("Clock scheduler started with scheduled tasks:")
logger.info("- Daily maintenance: 02:00 UTC")  
logger.info("- Weekly deep update: Sunday 01:00 UTC")
logger.info("- Live updates: Every hour")

# Keep the scheduler running
while True:
    schedule.run_pending()
    time.sleep(60)  # Check every minute
```

**📝 Step 3.2: Add Clock to Procfile**

```bash
web: gunicorn maxBreak.wsgi:application
worker: python comprehensive_scheduler.py
rankings: python ranking_worker.py  
clock: python clock_scheduler.py
release: python manage.py migrate --noinput && python manage.py collectstatic --noinput
```

---

### **STEP 4: Adding Deployment Automation**

**Example: Enhanced deployment with data verification**

**📝 Step 4.1: Create Deployment Script**

Create `maxBreak/deploy_tasks.py`:

```python
#!/usr/bin/env python
import os
import sys
import django

# Django setup
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'maxBreak.settings')
django.setup()

from django.core.management import call_command
from django.db import connection
import logging

logger = logging.getLogger(__name__)

def run_deployment_tasks():
    """Run tasks during deployment"""
    print("Starting deployment tasks...")
    
    try:
        # 1. Run migrations
        print("Running database migrations...")
        call_command('migrate', verbosity=2)
        
        # 2. Collect static files
        print("Collecting static files...")
        call_command('collectstatic', interactive=False, verbosity=1)
        
        # 3. Verify database integrity
        print("Verifying database...")
        call_command('verify_data')
        
        # 4. Initialize essential data if needed
        print("Checking for essential data...")
        with connection.cursor() as cursor:
            cursor.execute("SELECT COUNT(*) FROM oneFourSeven_event")
            event_count = cursor.fetchone()[0]
            
            if event_count < 10:
                print("Low event count, running initial data load...")
                call_command('update_tournaments', limit=50)
        
        print("Deployment tasks completed successfully!")
        
    except Exception as e:
        print(f"Deployment task failed: {e}")
        sys.exit(1)  # Exit with error code

if __name__ == '__main__':
    run_deployment_tasks()
```

**📝 Step 4.2: Update Release Command**

```bash
web: gunicorn maxBreak.wsgi:application
worker: python comprehensive_scheduler.py
rankings: python ranking_worker.py
clock: python clock_scheduler.py
release: python deploy_tasks.py
```

---

### **STEP 5: Adding Specialized Workers**

**Example: Match notification worker**

**📝 Step 5.1: Create Notification Worker**

Create `maxBreak/notification_worker.py`:

```python
#!/usr/bin/env python
import os
import django
import time
import logging
from datetime import datetime, timedelta

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'maxBreak.settings')
django.setup()

from oneFourSeven.models import MatchesOfAnEvent

logger = logging.getLogger(__name__)

def check_match_updates():
    """Check for match updates and send notifications"""
    try:
        # Find matches that started in last 10 minutes
        recent_start = datetime.now() - timedelta(minutes=10)
        
        live_matches = MatchesOfAnEvent.objects.filter(
            Status=1,  # Running
            start_date__gte=recent_start
        )
        
        for match in live_matches:
            logger.info(f"Live match: {match.Player1ID} vs {match.Player2ID}")
            # Add your notification logic here
            
    except Exception as e:
        logger.error(f"Error checking matches: {e}")

def notification_worker():
    """Background worker for match notifications"""
    logger.info("Starting notification worker...")
    
    while True:
        try:
            check_match_updates()
            time.sleep(600)  # Check every 10 minutes
            
        except KeyboardInterrupt:
            logger.info("Notification worker stopped")
            break
        except Exception as e:
            logger.error(f"Notification worker error: {e}")
            time.sleep(300)  # Wait 5 minutes on error

if __name__ == '__main__':
    notification_worker()
```

**📝 Step 5.2: Add to Procfile**

```bash
web: gunicorn maxBreak.wsgi:application
worker: python comprehensive_scheduler.py
rankings: python ranking_worker.py
clock: python clock_scheduler.py
notifications: python notification_worker.py
release: python deploy_tasks.py
```

---

## 🛠️ **Advanced Procfile Configurations**

### **Environment-Specific Commands**

Create different commands for different environments:

```bash
web: gunicorn maxBreak.wsgi:application
worker: python comprehensive_scheduler.py

# Production-only processes
rankings-prod: python ranking_worker.py --production
notifications-prod: python notification_worker.py --production

# Development-only processes  
debug-worker: python debug_scheduler.py --development
test-runner: python manage.py test --keepdb

# Release commands with environment detection
release: python deploy_tasks.py --environment=$RAILWAY_ENVIRONMENT
```

### **Resource-Optimized Commands**

Optimize for Railway's resource limits:

```bash
# Light worker with reduced memory usage
worker-light: python comprehensive_scheduler.py --max-memory=256M --workers=1

# Heavy processing with more resources
processor-heavy: python data_processor.py --max-memory=512M --workers=2

# Memory-efficient batch processor
batch-processor: python batch_jobs.py --batch-size=100 --memory-limit=256M
```

### **Health Check Integration**

Add health monitoring to your workers:

```bash
web: gunicorn maxBreak.wsgi:application
worker: python comprehensive_scheduler.py --health-check-port=8001
rankings: python ranking_worker.py --health-check-port=8002
healthcheck: python health_monitor.py --check-ports=8001,8002
```

---

## 📊 **Monitoring Your Processes**

### **Logging Best Practices**

Add consistent logging to all your scripts:

```python
import logging
import sys

# Configure logging for Railway
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout),  # Logs to Railway dashboard
    ]
)

logger = logging.getLogger(__name__)

def my_worker_function():
    logger.info("Worker started")
    
    try:
        # Your worker logic here
        result = do_work()
        logger.info(f"Work completed: {result}")
        
    except Exception as e:
        logger.error(f"Worker failed: {e}", exc_info=True)
        raise
```

### **Process Health Monitoring**

Create a health check endpoint:

```python
# health_monitor.py
import time
import requests
import logging
from datetime import datetime

logger = logging.getLogger(__name__)

def check_worker_health():
    """Monitor worker processes"""
    workers = [
        ('rankings', 'http://localhost:8001/health'),
        ('notifications', 'http://localhost:8002/health'),
    ]
    
    for worker_name, health_url in workers:
        try:
            response = requests.get(health_url, timeout=5)
            if response.status_code == 200:
                logger.info(f"✓ {worker_name} worker is healthy")
            else:
                logger.warning(f"⚠️ {worker_name} worker returned {response.status_code}")
        except Exception as e:
            logger.error(f"❌ {worker_name} worker is unhealthy: {e}")

while True:
    check_worker_health()
    time.sleep(300)  # Check every 5 minutes
```

---

## 🚀 **Deployment Commands**

### **Deploy with New Processes**

When you add new processes to your Procfile:

```bash
# 1. Commit your changes
git add Procfile
git add ranking_worker.py
git commit -m "Add ranking worker process"

# 2. Push to Railway
git push origin main

# 3. Scale your new processes (via Railway dashboard or CLI)
# Railway will automatically detect new process types
```

### **Scaling Processes**

Control how many instances of each process run:

```bash
# In Railway dashboard:
# - web: 1 instance (always)
# - worker: 1 instance  
# - rankings: 1 instance
# - notifications: 1 instance (optional)
# - clock: 1 instance (optional)
```

---

## ⚡ **Pro Tips & Best Practices**

### **🚨 Resource Management**
- Keep only essential workers running
- Use environment variables for configuration
- Implement graceful shutdown handling

### **🔄 Error Recovery**
```python
def robust_worker():
    while True:
        try:
            do_work()
        except Exception as e:
            logger.error(f"Worker error: {e}")
            time.sleep(300)  # Wait 5 minutes before retry
        except KeyboardInterrupt:
            logger.info("Worker shutdown requested")
            break
```

### **📊 Performance Monitoring**
```python
import psutil
import os

def log_resource_usage():
    process = psutil.Process(os.getpid())
    logger.info(f"Memory: {process.memory_info().rss / 1024 / 1024:.1f}MB")
    logger.info(f"CPU: {process.cpu_percent()}%")
```

### **🔧 Environment Configuration**
```python
import os

# Use environment variables for configuration
MAX_WORKERS = int(os.environ.get('MAX_WORKERS', '1'))
UPDATE_INTERVAL = int(os.environ.get('UPDATE_INTERVAL', '3600'))
DEBUG_MODE = os.environ.get('DEBUG', 'false').lower() == 'true'
```

---

## 🆘 **Troubleshooting Process Issues**

### **Process Won't Start**
1. Check Railway logs for startup errors
2. Verify Python path and dependencies
3. Test script locally: `python your_script.py`
4. Check for missing environment variables

### **Process Keeps Crashing**  
1. Add error handling and logging
2. Check memory usage (Railway limits)
3. Implement exponential backoff for retries
4. Reduce batch sizes or processing load

### **Process Running But Not Working**
1. Check if Django setup is correct
2. Verify database connections
3. Test individual management commands
4. Check API rate limiting

---

## 📝 **Example: Complete Procfile Setup**

Here's a comprehensive example for a fully automated snooker app:

```bash
# Main web application
web: gunicorn maxBreak.wsgi:application --bind 0.0.0.0:$PORT

# Core data update worker (existing)  
worker: python comprehensive_scheduler.py

# Specialized workers
rankings: python ranking_worker.py
live-matches: python live_match_worker.py  
notifications: python notification_worker.py

# Scheduled tasks
clock: python clock_scheduler.py

# Maintenance tasks
maintenance: python maintenance_worker.py

# Deployment and setup
release: python deploy_tasks.py

# Optional development/debugging
debug: python debug_worker.py
```

**Corresponding worker files:**
- `comprehensive_scheduler.py` (existing)
- `ranking_worker.py` (new)
- `live_match_worker.py` (new)
- `notification_worker.py` (new)
- `clock_scheduler.py` (new)
- `maintenance_worker.py` (new)
- `deploy_tasks.py` (new)

---

## 🎯 **Next Steps**

1. **Start Small**: Add one new worker at a time
2. **Test Locally**: Always test scripts locally first  
3. **Monitor Logs**: Use Railway dashboard to monitor process health
4. **Scale Gradually**: Add more processes as needed
5. **Optimize**: Monitor resource usage and optimize accordingly

---

*This guide provides everything you need to automate your MaxBreak application with background processes, scheduled tasks, and deployment automation. Each process runs independently and can be scaled or modified as needed.*