# maxBreak/urls.py
from django.contrib import admin
from django.urls import path, include
from .privacy_policy import privacy_policy_view

urlpatterns = [
    path('admin/', admin.site.urls),
    path('oneFourSeven/', include('oneFourSeven.urls')),
    path('privacy/', privacy_policy_view, name='privacy-policy'),
]
