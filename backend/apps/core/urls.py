from django.urls import path

from .views import BranchDetailView, BranchListCreateView, health_check


urlpatterns = [
    path("health/", health_check, name="health-check"),
    path("branches/", BranchListCreateView.as_view(), name="branch-list-create"),
    path("branches/<int:pk>/", BranchDetailView.as_view(), name="branch-detail"),
]