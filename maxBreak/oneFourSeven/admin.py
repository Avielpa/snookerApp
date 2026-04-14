from django.contrib import admin
from .models import MatchesOfAnEvent, Player, Event, Ranking, DeviceToken, OtherTourEvent, OtherTourMatch, OtherTourPlayer, MatchComment

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


@admin.register(DeviceToken)
class DeviceTokenAdmin(admin.ModelAdmin):
    list_display = ('device_id', 'push_token_short', 'push_error_short', 'player_count', 'match_count', 'updated_at')
    search_fields = ('device_id',)
    readonly_fields = ('device_id', 'created_at', 'updated_at')

    def push_token_short(self, obj):
        return obj.push_token[:30] + '...' if obj.push_token else '-'
    push_token_short.short_description = 'Push Token'

    def push_error_short(self, obj):
        return obj.push_error[:60] if obj.push_error else ''
    push_error_short.short_description = 'Push Error'

    def player_count(self, obj):
        return len(obj.favorite_player_ids or [])
    player_count.short_description = 'Players ⭐'

    def match_count(self, obj):
        return len(obj.favorite_match_ids or [])
    match_count.short_description = 'Matches ⭐'


@admin.register(OtherTourEvent)
class OtherTourEventAdmin(admin.ModelAdmin):
    list_display = ('name', 'tour', 'season', 'start_date', 'end_date', 'country')
    list_filter = ('tour', 'season')
    search_fields = ('name', 'city', 'country')


@admin.register(OtherTourPlayer)
class OtherTourPlayerAdmin(admin.ModelAdmin):
    list_display = ('snooker_id', 'first_name', 'last_name', 'nationality')
    search_fields = ('first_name', 'last_name')


@admin.register(OtherTourMatch)
class OtherTourMatchAdmin(admin.ModelAdmin):
    list_display = ('player1_name', 'player2_name', 'score1', 'score2', 'status', 'event')
    list_filter = ('status', 'event__tour')
    search_fields = ('player1_name', 'player2_name')


@admin.register(MatchComment)
class MatchCommentAdmin(admin.ModelAdmin):
    list_display  = ('id', 'author_name', 'match_db_id', 'text_preview', 'created_at', 'is_deleted')
    list_filter   = ('is_deleted', 'created_at')
    search_fields = ('author_name', 'text', 'device_id')
    readonly_fields = ('device_id', 'match_db_id', 'created_at')
    actions = ['restore_comments', 'hard_delete_comments']

    def text_preview(self, obj):
        return obj.text[:60] + ('...' if len(obj.text) > 60 else '')
    text_preview.short_description = 'Comment'

    @admin.action(description='Restore selected comments (undelete)')
    def restore_comments(self, request, queryset):
        queryset.update(is_deleted=False)

    @admin.action(description='Hard delete selected comments (permanent)')
    def hard_delete_comments(self, request, queryset):
        queryset.delete()