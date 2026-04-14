from django.db import migrations
from django.db.models import Count, Max


def deduplicate_player_match_history(apps, schema_editor):
    """
    For each group sharing the same logical match identity
    (player_id, event_id, round_number, player1_id, player2_id),
    keep the row with the highest api_match_id and delete the rest.
    """
    db = schema_editor.connection.alias
    PlayerMatchHistory = apps.get_model('oneFourSeven', 'PlayerMatchHistory')

    duplicate_groups = (
        PlayerMatchHistory.objects.using(db)
        .values('player_id', 'event_id', 'round_number', 'player1_id', 'player2_id')
        .annotate(cnt=Count('id'), max_api_id=Max('api_match_id'))
        .filter(cnt__gt=1)
    )

    deleted_total = 0
    for group in duplicate_groups:
        deleted, _ = (
            PlayerMatchHistory.objects.using(db)
            .filter(
                player_id=group['player_id'],
                event_id=group['event_id'],
                round_number=group['round_number'],
                player1_id=group['player1_id'],
                player2_id=group['player2_id'],
            )
            .exclude(api_match_id=group['max_api_id'])
            .delete()
        )
        deleted_total += deleted

    print(f'\n  Deleted {deleted_total} duplicate PlayerMatchHistory rows.')


class Migration(migrations.Migration):

    dependencies = [
        ('oneFourSeven', '0016_rename_match_api_id_matchcomment_match_db_id'),
    ]

    operations = [
        migrations.RunPython(deduplicate_player_match_history, migrations.RunPython.noop),
    ]
