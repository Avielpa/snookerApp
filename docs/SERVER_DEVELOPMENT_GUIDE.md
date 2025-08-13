# 📊 MaxBreak Server Development Guide

This comprehensive guide will walk you through adding new functionality to your Django backend server, from basic concepts to advanced features.

## 🏗️ **Project Architecture Overview**

### **Directory Structure**
```
maxBreak/                          # Django Project Root
├── maxBreak/                      # Project Settings
│   ├── settings.py               # Django configuration
│   ├── urls.py                   # Main URL routing
│   └── wsgi.py                   # WSGI deployment config
├── oneFourSeven/                 # Main App
│   ├── models.py                 # Database models
│   ├── views.py                  # API endpoints
│   ├── urls.py                   # App URL routing
│   ├── scraper.py               # Data scraping logic
│   ├── management/commands/     # Custom Django commands
│   └── migrations/              # Database migrations
└── manage.py                    # Django management script
```

### **Key Components**
- **Models**: Database structure (Player, Event, Match, Rankings)
- **Views**: API endpoints that serve data to frontend
- **Scraper**: Fetches data from external snooker.org API
- **Management Commands**: Automated data update scripts
- **URLs**: Route definitions for all API endpoints

---

## 🚀 **Step-by-Step: Adding New Functionality**

### **STEP 1: Open Your Development Environment**

1. **Open VS Code**
   ```bash
   # Navigate to project directory
   cd C:\Users\Aviel\vsprojects\snookerApp
   
   # Open in VS Code
   code .
   ```

2. **Activate Virtual Environment**
   ```bash
   # Windows
   venv\Scripts\activate
   
   # Verify activation (should show (venv) in prompt)
   ```

3. **Navigate to Django Project**
   ```bash
   cd maxBreak
   ```

---

### **STEP 2: Understanding the Database Models**

**File: `oneFourSeven/models.py`**

This file defines your database structure. Key models:

```python
# Example model structure
class Player(models.Model):
    ID = models.AutoField(primary_key=True)
    FirstName = models.CharField(max_length=100)
    LastName = models.CharField(max_length=100)
    Sex = models.CharField(max_length=1)
    # ... other fields

class Event(models.Model):
    ID = models.AutoField(primary_key=True)
    Name = models.CharField(max_length=200)
    StartDate = models.DateField()
    EndDate = models.DateField()
    # ... other fields
```

**📝 To Add a New Field:**
1. Open `oneFourSeven/models.py`
2. Find the relevant model
3. Add your new field:
   ```python
   # Example: Adding a "Country" field to Player
   class Player(models.Model):
       # ... existing fields ...
       Country = models.CharField(max_length=100, null=True, blank=True)
   ```

4. **Create and Apply Migration:**
   ```bash
   python manage.py makemigrations oneFourSeven
   python manage.py migrate
   ```

---

### **STEP 3: Adding Data Scraping Logic**

**File: `oneFourSeven/scraper.py`**

This file handles fetching data from external APIs.

**🔧 Example: Adding a New Data Fetcher**

```python
def fetch_player_statistics(player_id):
    """
    Fetch detailed player statistics from snooker.org API
    """
    headers = {'X-Requested-By': 'FahimaApp128'}
    
    try:
        # API endpoint for player stats
        url = f"https://api.snooker.org/?t=10&p={player_id}"
        response = requests.get(url, headers=headers, timeout=10)
        
        if response.status_code == 200:
            return response.json()
        else:
            logger.error(f"API error: {response.status_code}")
            return None
            
    except Exception as e:
        logger.error(f"Error fetching player stats: {e}")
        return None
```

**📋 API Parameter Reference:**
- `t=1`: Events
- `t=2`: Matches  
- `t=5`: Players
- `t=9`: Player details
- `t=13`: Head-to-head
- `t=16`: Head-to-head matches

---

### **STEP 4: Creating API Endpoints**

**File: `oneFourSeven/views.py`**

This file contains all your API endpoints that serve data to the frontend.

**🎯 Example: Adding a New API Endpoint**

```python
@api_view(['GET'])
def player_statistics_view(request, player_id):
    """
    GET /oneFourSeven/players/{player_id}/stats/
    Returns detailed statistics for a player
    """
    try:
        # Fetch data using scraper
        stats_data = fetch_player_statistics(player_id)
        
        if not stats_data:
            return Response(
                {'error': 'Player statistics not found'}, 
                status=404
            )
        
        # Process and return data
        return Response(stats_data, status=200)
        
    except Exception as e:
        logger.error(f"Error in player_statistics_view: {e}")
        return Response(
            {'error': 'Internal server error'}, 
            status=500
        )
```

---

### **STEP 5: Adding URL Routing**

**File: `oneFourSeven/urls.py`**

Add your new endpoint to the URL configuration:

```python
urlpatterns = [
    # ... existing URLs ...
    
    # Add your new endpoint
    path('players/<int:player_id>/stats/', player_statistics_view, name='player-stats'),
]
```

---

### **STEP 6: Creating Management Commands**

**Directory: `oneFourSeven/management/commands/`**

Create automated scripts for data updates.

**📁 Create New Command File: `update_player_stats.py`**

```python
from django.core.management.base import BaseCommand
from oneFourSeven.models import Player
from oneFourSeven.scraper import fetch_player_statistics
import time

class Command(BaseCommand):
    help = 'Update player statistics from API'
    
    def add_arguments(self, parser):
        parser.add_argument('--player-id', type=int, help='Update specific player')
        parser.add_argument('--dry-run', action='store_true', help='Preview without saving')
    
    def handle(self, *args, **options):
        if options['player_id']:
            players = Player.objects.filter(ID=options['player_id'])
        else:
            players = Player.objects.all()[:50]  # Limit to avoid rate limits
        
        for player in players:
            self.stdout.write(f"Updating stats for {player.FirstName} {player.LastName}")
            
            if not options['dry_run']:
                stats = fetch_player_statistics(player.ID)
                if stats:
                    # Process and save stats
                    self.stdout.write(f"✓ Updated {player.FirstName} {player.LastName}")
                
                time.sleep(6)  # Rate limiting
```

**🏃‍♂️ Run Your Command:**
```bash
# Test run (dry run)
python manage.py update_player_stats --dry-run

# Update specific player
python manage.py update_player_stats --player-id 5

# Update all players
python manage.py update_player_stats
```

---

### **STEP 7: Testing Your Changes**

1. **Test Database Changes:**
   ```bash
   python manage.py check
   python manage.py makemigrations --dry-run
   ```

2. **Test API Endpoints:**
   ```bash
   python manage.py runserver
   # Visit: http://127.0.0.1:8000/oneFourSeven/players/5/stats/
   ```

3. **Test Management Commands:**
   ```bash
   python manage.py update_player_stats --dry-run
   ```

---

## 🔧 **Common Development Tasks**

### **Adding a New Data Field**
1. Update model in `models.py`
2. Create migration: `python manage.py makemigrations`
3. Apply migration: `python manage.py migrate`
4. Update scraper to fetch new data
5. Update API endpoint to serve new data

### **Creating a New API Endpoint**
1. Add function to `views.py`
2. Add URL route to `urls.py`
3. Test endpoint: `python manage.py runserver`

### **Adding Automated Data Updates**
1. Create command file in `management/commands/`
2. Implement data fetching logic
3. Add rate limiting (6+ seconds between requests)
4. Test: `python manage.py your_command --dry-run`

---

## ⚡ **Pro Tips & Best Practices**

### **🚨 Rate Limiting**
Always add delays between API calls:
```python
import time
time.sleep(6)  # 6+ seconds between requests
```

### **🔍 Error Handling**
Always wrap API calls in try-except:
```python
try:
    response = requests.get(url, timeout=10)
    response.raise_for_status()
except requests.RequestException as e:
    logger.error(f"API request failed: {e}")
    return None
```

### **📊 Logging**
Use consistent logging:
```python
import logging
logger = logging.getLogger(__name__)

logger.info("Starting data update...")
logger.error(f"Failed to process player {player_id}")
```

### **🧪 Testing**
Always use `--dry-run` first:
```bash
python manage.py your_command --dry-run
```

---

## 🆘 **Troubleshooting Common Issues**

### **Migration Errors**
```bash
# Reset migrations (careful!)
python manage.py migrate oneFourSeven zero
python manage.py makemigrations oneFourSeven
python manage.py migrate
```

### **API Rate Limiting**
- Always wait 6+ seconds between requests
- Use `--limit` parameters in commands
- Implement exponential backoff for failures

### **Database Locks**
- Stop all running processes
- Restart development server
- Check for long-running queries

---

## 📚 **Advanced Topics**

### **Custom Data Processing**
Add data validation and processing in your scraper:

```python
def process_player_data(raw_data):
    """Clean and validate player data"""
    if not raw_data or not isinstance(raw_data, dict):
        return None
    
    return {
        'name': raw_data.get('Name', '').strip(),
        'country': raw_data.get('Nationality', ''),
        'ranking': safe_int(raw_data.get('Position')),
    }
```

### **Bulk Operations**
Use Django's bulk operations for better performance:

```python
from django.db import transaction

@transaction.atomic
def bulk_update_players(player_data_list):
    players_to_update = []
    for data in player_data_list:
        player = Player.objects.get(ID=data['id'])
        player.Country = data['country']
        players_to_update.append(player)
    
    Player.objects.bulk_update(players_to_update, ['Country'])
```

---

## 🎯 **Next Steps**

1. **Practice**: Start with small changes (add a simple field)
2. **Experiment**: Try creating a new API endpoint
3. **Automate**: Build a management command for your data
4. **Test**: Always test changes thoroughly
5. **Deploy**: Update your production server with new features

---

*This guide covers the core concepts for extending your MaxBreak server. Each step builds upon the previous one, so follow them in order for best results.*