# oneFourSeven/views_frame_scores.py
#
# Per-frame score endpoint. Reads from MatchFrameScore (populated by
# the fetch_frame_scores management command). No live scraping here.

from django.http import JsonResponse
from django.views.decorators.http import require_http_methods
from rest_framework import serializers

from .models import MatchFrameScore


class MatchFrameScoreSerializer(serializers.ModelSerializer):
    class Meta:
        model = MatchFrameScore
        fields = [
            'frame_number',
            'player1_points',
            'player2_points',
            'player1_break',
            'player2_break',
            'winner',
            'source',
        ]


@require_http_methods(["GET"])
def match_frame_scores_view(request, match_api_id):
    """
    Returns per-frame point data for a completed match.
    Data is pre-populated by: python manage.py fetch_frame_scores
    Returns {"frames": []} if no data exists for this match.
    """
    try:
        id_int = int(match_api_id)
    except (ValueError, TypeError):
        return JsonResponse({"frames": []})

    frames = MatchFrameScore.objects.filter(
        match__api_match_id=id_int
    ).order_by('frame_number')

    serializer = MatchFrameScoreSerializer(frames, many=True)
    return JsonResponse({"frames": serializer.data})
