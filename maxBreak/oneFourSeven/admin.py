from django.contrib import admin
from .models import MatchesOfAnEvent, Player,Event,Ranking

@admin.register(Player)
class PlayerAdmin(admin.ModelAdmin):
    list_display = ('ID', 'FirstName', 'LastName', 'Sex', 'Nationality') # הוסף את השדות שאתה רוצה לראות ברשימה
    list_filter = ('Sex', 'Nationality') # הוסף שדות לסינון (אופציונלי)
    search_fields = ('FirstName', 'LastName', 'ShortName') # הוסף שדות לחיפוש (אופציונלי)
    ordering = ('LastName', 'FirstName') # השדה/שדות שברירת המחדל למיון לפי


@admin.register(Event)
class EventsAdmin(admin.ModelAdmin):
    list_filter = ('StartDate',)



@admin.register(Ranking)
class Ranking(admin.ModelAdmin):
    search_fields = ("PlayerID",)


@admin.register(MatchesOfAnEvent)
class MatchOnAnEvent(admin.ModelAdmin):
    pass