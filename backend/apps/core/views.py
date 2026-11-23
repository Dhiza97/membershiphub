from typing import cast
from typing import Any
from zoneinfo import ZoneInfo

from django.db import transaction
from django.db.models import QuerySet
from django.shortcuts import get_object_or_404
from rest_framework.decorators import api_view
from rest_framework.exceptions import ValidationError
from rest_framework.generics import ListCreateAPIView, RetrieveUpdateAPIView
from rest_framework.permissions import BasePermission, IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView
from django.utils import timezone

from apps.accounts.models import User
from apps.accounts.permissions import IsSuperAdmin

from .models import (
    Attendance,
    Branch,
    Cohort,
    Curriculum,
    CurriculumLesson,
    CurriculumObjective,
    CurriculumTopic,
    CurriculumVersion,
    Enrollment,
    LearningMaterial,
    Session,
)
from .serializers import (
    AttendanceCreateSerializer,
    AttendanceSerializer,
    AttendanceUpdateSerializer,
    BranchSerializer,
    CohortFilterSerializer,
    CohortSerializer,
    CurriculumSerializer,
    CurriculumVersionDetailSerializer,
    CurriculumVersionDraftSerializer,
    CurriculumVersionSummarySerializer,
    EnrollmentCreateSerializer,
    EnrollmentSerializer,
    SessionSerializer,
)


@api_view(["GET"])
def health_check(_request):  # pyright: ignore[reportUnusedParameter]
    return Response({
        "status": "ok",
        "message": "MembershipHub API is running",
    })


class BranchListCreateView(ListCreateAPIView):
    serializer_class = BranchSerializer

    def get_permissions(self):
        if self.request.method == "POST":
            return [IsAuthenticated(), IsSuperAdmin()]
        return [IsAuthenticated()]

    def get_queryset(self) -> QuerySet[Branch]:  # pyright: ignore[reportIncompatibleMethodOverride]
        user = self.request.user
        if isinstance(user, User) and user.is_super_admin():
            return cast(QuerySet[Branch], Branch.objects.all())
        branch_id = getattr(user, "branch_id", None)
        if isinstance(user, User) and user.is_branch_admin() and branch_id:
            return Branch.objects.filter(pk=branch_id)
        return Branch.objects.none()


class BranchDetailView(RetrieveUpdateAPIView):
    serializer_class = BranchSerializer

    def get_permissions(self):
        if self.request.method in ("PUT", "PATCH"):
            return [IsAuthenticated(), IsSuperAdmin()]
        return [IsAuthenticated()]

    def get_queryset(self) -> QuerySet[Branch]:  # pyright: ignore[reportIncompatibleMethodOverride]
        user = self.request.user
        if isinstance(user, User) and user.is_super_admin():
            return cast(QuerySet[Branch], Branch.objects.all())
        branch_id = getattr(user, "branch_id", None)
        if isinstance(user, User) and user.is_branch_admin() and branch_id:
            return Branch.objects.filter(pk=branch_id)
        return Branch.objects.none()


class IsCohortManager(BasePermission):
    def has_permission(self, request, view) -> bool:  # pyright: ignore[reportIncompatibleMethodOverride]
        user = request.user
        return bool(
            user
            and user.is_authenticated
            and (user.is_super_admin() or user.is_branch_admin())
        )


class IsSessionOperator(BasePermission):
    def has_permission(self, request, view) -> bool:  # pyright: ignore[reportIncompatibleMethodOverride]
        user = request.user
        return bool(
            user
            and user.is_authenticated
            and (
                user.is_super_admin()
                or user.is_branch_admin()
                or user.application_role == User.ApplicationRole.INSTRUCTOR
            )
        )


class CohortScopeMixin:
    def get_cohort_queryset(self):
        request = cast(Request, getattr(self, "request"))
        user = request.user
        queryset = Cohort.objects.select_related("branch", "instructor", "curriculum_version__curriculum").prefetch_related(
            "enrollments__student"
        )
        if user.is_super_admin():
            return queryset
        if user.is_branch_admin() and user.branch_id:
            return queryset.filter(branch_id=user.branch_id)
        if user.application_role == User.ApplicationRole.INSTRUCTOR:
            return queryset.filter(instructor_id=user.pk)
        return queryset.none()

    def get_cohort(self):
        kwargs = cast(dict[str, Any], getattr(self, "kwargs"))
        return get_object_or_404(
            self.get_cohort_queryset(),
            pk=kwargs["cohort_id"],
        )


class CohortListCreateView(CohortScopeMixin, ListCreateAPIView):
    permission_classes = (IsAuthenticated, IsCohortManager)
    serializer_class = CohortSerializer

    def get_queryset(self) -> QuerySet[Cohort]:  # pyright: ignore[reportIncompatibleMethodOverride]
        queryset = self.get_cohort_queryset()
        request = cast(Request, self.request)
        filter_serializer = CohortFilterSerializer(data=request.query_params)
        filter_serializer.is_valid(raise_exception=True)
        params = cast(dict[str, Any], filter_serializer.validated_data)
        if "status" in params:
            queryset = queryset.filter(status=params["status"])
        if "branch" in params:
            queryset = queryset.filter(branch=params["branch"])
        if "instructor" in params:
            queryset = queryset.filter(instructor=params["instructor"])
        if params.get("search"):
            queryset = queryset.filter(name__icontains=params["search"])
        if "start_date_after" in params:
            queryset = queryset.filter(start_date__gte=params["start_date_after"])
        if "start_date_before" in params:
            queryset = queryset.filter(start_date__lte=params["start_date_before"])
        return queryset


class CohortDetailView(CohortScopeMixin, RetrieveUpdateAPIView):
    permission_classes = (IsAuthenticated, IsCohortManager)
    serializer_class = CohortSerializer

    def get_queryset(self) -> QuerySet[Cohort]:  # pyright: ignore[reportIncompatibleMethodOverride]
        return self.get_cohort_queryset()


class CohortEnrollmentListCreateView(CohortScopeMixin, ListCreateAPIView):
    permission_classes = (IsAuthenticated, IsCohortManager)

    def get_queryset(self) -> QuerySet[Enrollment]:  # pyright: ignore[reportIncompatibleMethodOverride]
        return Enrollment.objects.filter(cohort=self.get_cohort()).select_related("student")

    def get_serializer_class(self) -> type[EnrollmentCreateSerializer] | type[EnrollmentSerializer]:  # pyright: ignore[reportIncompatibleMethodOverride]
        if self.request.method == "POST":
            return EnrollmentCreateSerializer
        return EnrollmentSerializer

    def get_serializer_context(self):
        context = super().get_serializer_context()
        context["cohort"] = self.get_cohort()
        return context


class CohortEnrollmentDeleteView(CohortScopeMixin, APIView):
    permission_classes = (IsAuthenticated, IsCohortManager)

    def delete(self, request, cohort_id, student_id):
        cohort = self.get_cohort()
        enrollment = get_object_or_404(
            Enrollment,
            cohort=cohort,
            student_id=student_id,
        )
        enrollment_count = Enrollment.objects.filter(cohort=cohort).count()
        if cohort.status == Cohort.Status.READY and enrollment_count <= 1:
            raise ValidationError({
                "students": "A Ready cohort must keep at least one enrolled Student."
            })
        enrollment.delete()
        return Response(status=204)


class CurriculumScopeMixin:
    def get_curriculum_queryset(self):
        request = cast(Request, getattr(self, "request"))
        user = request.user
        queryset = Curriculum.objects.select_related("branch").prefetch_related("versions")
        if user.is_super_admin():
            return queryset
        if user.is_branch_admin() and user.branch_id:
            return queryset.filter(branch_id=user.branch_id)
        return queryset.none()

    def get_scoped_curriculum(self, curriculum_id):
        return get_object_or_404(self.get_curriculum_queryset(), pk=curriculum_id)


class CurriculumListCreateView(CurriculumScopeMixin, ListCreateAPIView):
    permission_classes = (IsAuthenticated, IsCohortManager)
    serializer_class = CurriculumSerializer

    def get_queryset(self) -> QuerySet[Curriculum]:  # pyright: ignore[reportIncompatibleMethodOverride]
        queryset = self.get_curriculum_queryset()
        request = cast(Request, self.request)
        search = request.query_params.get("search", "").strip()
        if search:
            queryset = queryset.filter(name__icontains=search)
        if request.query_params.get("is_active") in ("true", "false"):
            queryset = queryset.filter(is_active=request.query_params["is_active"] == "true")
        return queryset

    def get_serializer_context(self):
        context = super().get_serializer_context()
        context["request"] = self.request
        return context


class CurriculumDetailView(CurriculumScopeMixin, RetrieveUpdateAPIView):
    permission_classes = (IsAuthenticated, IsCohortManager)
    serializer_class = CurriculumSerializer

    def get_queryset(self) -> QuerySet[Curriculum]:  # pyright: ignore[reportIncompatibleMethodOverride]
        return self.get_curriculum_queryset()

    def get_serializer_context(self):
        context = super().get_serializer_context()
        context["request"] = self.request
        return context


class CurriculumVersionListCreateView(CurriculumScopeMixin, APIView):
    permission_classes = (IsAuthenticated, IsCohortManager)

    def get(self, request, curriculum_id):
        curriculum = self.get_scoped_curriculum(curriculum_id)
        versions = CurriculumVersion.objects.filter(curriculum=curriculum)
        serializer = CurriculumVersionSummarySerializer(versions, many=True)
        return Response(serializer.data)

    @transaction.atomic
    def post(self, request, curriculum_id):
        curriculum = self.get_scoped_curriculum(curriculum_id)
        if CurriculumVersion.objects.filter(curriculum=curriculum, status=CurriculumVersion.Status.DRAFT).exists():
            raise ValidationError({"detail": "This curriculum already has an editable draft version."})

        previous = CurriculumVersion.objects.filter(curriculum=curriculum).exclude(
            status=CurriculumVersion.Status.DRAFT
        ).order_by("-version_number").first()
        version_number = (previous.version_number + 1) if previous else 1
        version = CurriculumVersion.objects.create(
            curriculum=curriculum,
            version_number=version_number,
            status=CurriculumVersion.Status.DRAFT,
            change_note=request.data.get("change_note", ""),
            created_by=request.user,
        )

        if previous is not None:
            for old_topic in CurriculumTopic.objects.filter(version=previous).prefetch_related(
                "objectives",
                "lessons__materials",
            ):
                topic = CurriculumTopic.objects.create(
                    version=version,
                    title=old_topic.title,
                    description=old_topic.description,
                    notes=old_topic.notes,
                    position=old_topic.position,
                )
                for objective in CurriculumObjective.objects.filter(topic=old_topic):
                    CurriculumObjective.objects.create(
                        topic=topic,
                        text=objective.text,
                        position=objective.position,
                    )
                for old_lesson in CurriculumLesson.objects.filter(topic=old_topic):
                    lesson = CurriculumLesson.objects.create(
                        topic=topic,
                        title=old_lesson.title,
                        description=old_lesson.description,
                        notes=old_lesson.notes,
                        position=old_lesson.position,
                    )
                    for material in LearningMaterial.objects.filter(lesson=old_lesson):
                        LearningMaterial.objects.create(
                            lesson=lesson,
                            title=material.title,
                            url=material.url,
                            material_type=material.material_type,
                            description=material.description,
                            position=material.position,
                        )

        return Response(CurriculumVersionDetailSerializer(version).data, status=201)


class CurriculumVersionDetailView(CurriculumScopeMixin, APIView):
    permission_classes = (IsAuthenticated, IsCohortManager)

    def get_version(self, curriculum_id, version_id):
        curriculum = self.get_scoped_curriculum(curriculum_id)
        return get_object_or_404(
            CurriculumVersion.objects.filter(curriculum=curriculum).prefetch_related(
                "topics__objectives",
                "topics__lessons__materials",
            ),
            pk=version_id,
        )

    def get(self, request, curriculum_id, version_id):
        version = self.get_version(curriculum_id, version_id)
        return Response(CurriculumVersionDetailSerializer(version).data)

    def patch(self, request, curriculum_id, version_id):
        version = self.get_version(curriculum_id, version_id)
        serializer = CurriculumVersionDraftSerializer(
            version,
            data=request.data,
            partial=True,
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()
        version.refresh_from_db()
        return Response(CurriculumVersionDetailSerializer(version).data)


class CurriculumVersionPublishView(CurriculumScopeMixin, APIView):
    permission_classes = (IsAuthenticated, IsCohortManager)

    def post(self, request, curriculum_id, version_id):
        version = get_object_or_404(
            CurriculumVersion.objects.filter(curriculum=self.get_scoped_curriculum(curriculum_id)),
            pk=version_id,
        )
        if version.status != CurriculumVersion.Status.DRAFT:
            raise ValidationError({"status": "Only a draft version can be published."})
        if not CurriculumTopic.objects.filter(version=version).exists():
            raise ValidationError({"topics": "Add at least one topic before publishing this curriculum."})
        version.status = CurriculumVersion.Status.PUBLISHED
        version.save()
        return Response(CurriculumVersionDetailSerializer(version).data)


class SessionScopeMixin(CohortScopeMixin):
    def get_session_queryset(self) -> QuerySet[Session]:
        return Session.objects.filter(cohort=self.get_cohort()).select_related("cohort__branch")

    def get_session(self):
        kwargs = cast(dict[str, Any], getattr(self, "kwargs"))
        return get_object_or_404(self.get_session_queryset(), pk=kwargs["session_id"])


class SessionListCreateView(CohortScopeMixin, ListCreateAPIView):
    permission_classes = (IsAuthenticated, IsSessionOperator)
    serializer_class = SessionSerializer

    def get_queryset(self) -> QuerySet[Session]:  # pyright: ignore[reportIncompatibleMethodOverride]
        queryset = Session.objects.filter(cohort=self.get_cohort()).select_related("cohort__branch")
        request = cast(Request, self.request)
        status_filter = request.query_params.get("status")
        if status_filter in Session.Status.values:
            queryset = queryset.filter(status=status_filter)
        return queryset

    def get_serializer_context(self):
        context = super().get_serializer_context()
        context["cohort"] = self.get_cohort()
        return context


class SessionDetailView(SessionScopeMixin, RetrieveUpdateAPIView):
    permission_classes = (IsAuthenticated, IsSessionOperator)
    serializer_class = SessionSerializer
    lookup_url_kwarg = "session_id"

    def get_queryset(self) -> QuerySet[Session]:  # pyright: ignore[reportIncompatibleMethodOverride]
        return self.get_session_queryset()

    def get_serializer_context(self):
        context = super().get_serializer_context()
        context["cohort"] = self.get_cohort()
        return context


class SessionAttendanceListCreateView(SessionScopeMixin, ListCreateAPIView):
    permission_classes = (IsAuthenticated, IsSessionOperator)

    def get_queryset(self) -> QuerySet[Attendance]:  # pyright: ignore[reportIncompatibleMethodOverride]
        return Attendance.objects.filter(session=self.get_session()).select_related("student", "marked_by")

    def get_serializer_class(self) -> type[AttendanceCreateSerializer] | type[AttendanceSerializer]:  # pyright: ignore[reportIncompatibleMethodOverride]
        if self.request.method == "POST":
            return AttendanceCreateSerializer
        return AttendanceSerializer

    def get_serializer_context(self):
        context = super().get_serializer_context()
        context["session"] = self.get_session()
        return context


class SessionAttendanceDetailView(SessionScopeMixin, APIView):
    permission_classes = (IsAuthenticated, IsSessionOperator)

    def patch(self, request, cohort_id, session_id, student_id):
        session = self.get_session()
        attendance = get_object_or_404(
            Attendance.objects.select_related("session", "student"),
            session=session,
            student_id=student_id,
        )
        serializer = AttendanceUpdateSerializer(
            attendance,
            data=request.data,
            partial=True,
            context={"request": request},
        )
        serializer.is_valid(raise_exception=True)
        serializer.save(marked_by=request.user)
        return Response(AttendanceSerializer(attendance).data)


class CohortAttendanceReportView(CohortScopeMixin, APIView):
    permission_classes = (IsAuthenticated, IsSessionOperator)

    def get(self, request, cohort_id):
        cohort = self.get_cohort()
        branch_timezone = ZoneInfo(cohort.branch.timezone)
        enrollments = list(
            Enrollment.objects.filter(cohort=cohort)
            .select_related("student")
            .order_by("student__last_name", "student__first_name", "pk")
        )
        sessions = list(
            Session.objects.filter(cohort=cohort)
            .prefetch_related("attendance_records")
            .order_by("date", "start_time", "pk")
        )
        completed_sessions = [session for session in sessions if session.status == Session.Status.COMPLETED]
        student_rows = []
        overall_attended = 0
        overall_denominator = 0

        for enrollment in enrollments:
            enrolled_on = timezone.localtime(enrollment.created_at, branch_timezone).date()
            eligible = [session for session in completed_sessions if session.date >= enrolled_on]
            records = {
                getattr(record, "session_id", None): record
                for record in Attendance.objects.filter(
                    session__in=eligible,
                    student_id=getattr(enrollment, "student_id", None),
                )
            }
            excused = sum(record.status == Attendance.Status.EXCUSED for record in records.values())
            attended = sum(
                record.status in (Attendance.Status.PRESENT, Attendance.Status.LATE)
                for record in records.values()
            )
            denominator = max(0, len(eligible) - excused)
            percentage = round(attended * 100 / denominator, 1) if denominator else None
            overall_attended += attended
            overall_denominator += denominator
            student_rows.append({
                "student": {
                    "id": getattr(enrollment, "student_id", None),
                    "username": enrollment.student.username,
                    "first_name": enrollment.student.first_name,
                    "last_name": enrollment.student.last_name,
                },
                "completed_sessions": len(eligible),
                "excused_sessions": excused,
                "attended_sessions": attended,
                "attendance_percentage": percentage,
            })

        session_rows = []
        for session in sessions:
            local_enrollments = [
                enrollment
                for enrollment in enrollments
                if timezone.localtime(enrollment.created_at, branch_timezone).date() <= session.date
            ]
            status_counts = {
                status: Attendance.objects.filter(session=session, status=status).count()
                for status in Attendance.Status.values
            }
            recorded_count = sum(status_counts.values())
            session_rows.append({
                "id": session.pk,
                "title": session.title,
                "date": session.date,
                "start_time": session.start_time,
                "end_time": session.end_time,
                "status": session.status,
                "eligible_students": len(local_enrollments),
                "present": status_counts[Attendance.Status.PRESENT],
                "late": status_counts[Attendance.Status.LATE],
                "absent": status_counts[Attendance.Status.ABSENT],
                "excused": status_counts[Attendance.Status.EXCUSED],
                "unrecorded": max(0, len(local_enrollments) - recorded_count),
            })

        return Response({
            "cohort": {"id": cohort.pk, "name": cohort.name},
            "timezone": cohort.branch.timezone,
            "session_count": len(sessions),
            "completed_session_count": len(completed_sessions),
            "scheduled_session_count": sum(session.status == Session.Status.SCHEDULED for session in sessions),
            "cancelled_session_count": sum(session.status == Session.Status.CANCELLED for session in sessions),
            "attendance_percentage": round(overall_attended * 100 / overall_denominator, 1) if overall_denominator else None,
            "students": student_rows,
            "sessions": session_rows,
        })
