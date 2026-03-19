from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('oneFourSeven', '0007_newsarticle'),
    ]

    operations = [
        migrations.CreateModel(
            name='DeviceToken',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('device_id', models.CharField(db_index=True, max_length=64, unique=True)),
                ('push_token', models.CharField(max_length=512)),
                ('favorite_player_ids', models.JSONField(default=list)),
                ('favorite_match_ids', models.JSONField(default=list)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
            ],
            options={
                'verbose_name': 'Device Token',
                'verbose_name_plural': 'Device Tokens',
            },
        ),
    ]
