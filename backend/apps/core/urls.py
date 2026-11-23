from django.urls import path

from .views import (
    BranchDetailView,
    BranchListCreateView,
    CohortDetailView,
    CohortEnrollmentDeleteView,
    CohortEnrollmentListCreateView,
    CohortListCreateView,
    CurriculumDetailView,
    CurriculumListCreateView,
    CurriculumVersionDetailView,
    CurriculumVersionListCreateView,
    CurriculumVersionPublishView,
    CohortAttendanceReportView,
    health_check,
    SessionAttendanceDetailView,
    SessionAttendanceListCreateView,
    SessionDetailView,
    SessionListCreateView,
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
    path("curricula/", CurriculumListCreateView.as_view(), name="curriculum-list-create"),
    path("curricula/<int:pk>/", CurriculumDetailView.as_view(), name="curriculum-detail"),
    path(
        "curricula/<int:curriculum_id>/versions/",
        CurriculumVersionListCreateView.as_view(),
        name="curriculum-version-list-create",
    ),
    path(
        "curricula/<int:curriculum_id>/versions/<int:version_id>/",
        CurriculumVersionDetailView.as_view(),
        name="curriculum-version-detail",
    ),
    path(
        "curricula/<int:curriculum_id>/versions/<int:version_id>/publish/",
        CurriculumVersionPublishView.as_view(),
        name="curriculum-version-publish",
    ),
    path(
        "cohorts/<int:cohort_id>/sessions/",
        SessionListCreateView.as_view(),
        name="session-list-create",
    ),
    path(
        "cohorts/<int:cohort_id>/sessions/<int:session_id>/",
        SessionDetailView.as_view(),
        name="session-detail",
    ),
    path(
        "cohorts/<int:cohort_id>/sessions/<int:session_id>/attendance/",
        SessionAttendanceListCreateView.as_view(),
        name="session-attendance-list-create",
    ),
    path(
        "cohorts/<int:cohort_id>/sessions/<int:session_id>/attendance/<int:student_id>/",
        SessionAttendanceDetailView.as_view(),
        name="session-attendance-detail",
    ),
    path(
        "cohorts/<int:cohort_id>/attendance-report/",
        CohortAttendanceReportView.as_view(),
        name="cohort-attendance-report",
    ),
]