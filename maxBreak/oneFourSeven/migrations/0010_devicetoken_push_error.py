from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('oneFourSeven', '0009_othertourevent_othertourplayer_othertourmatch'),
    ]

    operations = [
        migrations.AddField(
            model_name='devicetoken',
            name='push_error',
            field=models.TextField(blank=True, default=''),
        ),
        migrations.AlterField(
            model_name='devicetoken',
            name='push_token',
            field=models.CharField(blank=True, default='', max_length=512),
        ),
    ]
