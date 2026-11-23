from django.urls import path

from .views import (
    BranchDetailView,
    BranchListCreateView,
    CohortDetailView,
    CohortEnrollmentDeleteView,
    CohortEnrollmentListCreateView,
    CohortListCreateView,
    health_check,
)


urlpatterns = [
    path("health/", health_check, name="health-check"),
    path("branches/", BranchListCreateView.as_view(), name="branch-list-create"),
    path("branches/<int:pk>/", BranchDetailView.as_view(), name="branch-detail"),
    path("cohorts/", CohortListCreateView.as_view(), name="cohort-list-create"),
    path("cohorts/<int:pk>/", CohortDetailView.as_view(), name="cohort-detail"),
    path(
        "cohorts/<int:cohort_id>/enrollments/",
        CohortEnrollmentListCreateView.as_view(),
        name="cohort-enrollment-list-create",
    ),
    path(
        "cohorts/<int:cohort_id>/enrollments/<int:student_id>/",
        CohortEnrollmentDeleteView.as_view(),
        name="cohort-enrollment-delete",
    ),
]