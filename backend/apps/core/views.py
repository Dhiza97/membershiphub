from typing import cast
from typing import Any
from zoneinfo import ZoneInfo
from datetime import timedelta
from decimal import Decimal

from django.db import transaction
from django.db.models import Q, QuerySet
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
    Assessment,
    AssessmentAnswer,
    AssessmentAttempt,
    AssessmentQuestion,
    Branch,
    Cohort,
    Curriculum,
    CurriculumLesson,
    CurriculumObjective,
    CurriculumTopic,
    CurriculumVersion,
    Enrollment,
    LearningMaterial,
    Question,
    QuestionBank,
    QuestionOption,
    Session,
)
from .serializers import (
    AttendanceCreateSerializer,
    AttendanceSerializer,
    AttendanceUpdateSerializer,
    AssessmentAttemptSerializer,
    AssessmentQuestionAdminSerializer,
    AssessmentQuestionStudentSerializer,
    AssessmentSerializer,
    AssessmentStudentSerializer,
    BranchSerializer,
    CohortFilterSerializer,
    CohortSerializer,
    CurriculumSerializer,
    CurriculumVersionDetailSerializer,
    CurriculumVersionDraftSerializer,
    CurriculumVersionSummarySerializer,
    EnrollmentCreateSerializer,
    EnrollmentSerializer,
    QuestionBankQuestionSerializer,
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


class IsAssessmentAuthor(BasePermission):
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


class AssessmentScopeMixin:
    def get_assessment_queryset(self):
        request = cast(Request, getattr(self, "request"))
        user = request.user
        queryset = Assessment.objects.select_related(
            "branch", "cohort", "cohort__instructor", "curriculum_topic__version__curriculum"
        ).prefetch_related("assessment_questions__question")
        if user.is_super_admin():
            return queryset
        if user.is_branch_admin() and user.branch_id:
            return queryset.filter(branch_id=user.branch_id)
        if user.application_role == User.ApplicationRole.INSTRUCTOR and user.branch_id:
            return queryset.filter(branch_id=user.branch_id, cohort__instructor_id=user.pk)
        return queryset.none()

    def get_assessment(self, assessment_id):
        return get_object_or_404(self.get_assessment_queryset(), pk=assessment_id)


class QuestionBankQuestionListCreateView(APIView):
    permission_classes = (IsAuthenticated, IsAssessmentAuthor)

    def get_bank(self, request):
        user = request.user
        branch_id = user.branch_id
        if user.is_super_admin():
            branch_id = request.query_params.get("branch")
        if not branch_id:
            raise ValidationError({"branch": "A branch is required to access a question bank."})
        branch = get_object_or_404(Branch, pk=branch_id)
        if not user.is_super_admin() and branch.pk != user.branch_id:
            raise ValidationError({"branch": "You can only manage your own branch's question bank."})
        bank, _ = QuestionBank.objects.get_or_create(branch=branch)
        return bank

    def get(self, request):
        bank = self.get_bank(request)
        questions = Question.objects.filter(bank=bank).prefetch_related("options")
        serializer = QuestionBankQuestionSerializer(questions, many=True)
        return Response(serializer.data)

    def post(self, request):
        bank = self.get_bank(request)
        serializer = QuestionBankQuestionSerializer(
            data=request.data,
            context={"request": request, "bank": bank},
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data, status=201)


class QuestionBankQuestionDetailView(APIView):
    permission_classes = (IsAuthenticated, IsAssessmentAuthor)

    def get_question(self, request, question_id):
        user = request.user
        queryset = Question.objects.select_related("bank__branch").prefetch_related("options")
        if not user.is_super_admin():
            queryset = queryset.filter(bank__branch_id=user.branch_id)
        return get_object_or_404(queryset, pk=question_id)

    def get(self, request, question_id):
        return Response(QuestionBankQuestionSerializer(self.get_question(request, question_id)).data)

    def patch(self, request, question_id):
        question = self.get_question(request, question_id)
        serializer = QuestionBankQuestionSerializer(question, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)


class AssessmentListCreateView(AssessmentScopeMixin, APIView):
    permission_classes = (IsAuthenticated, IsAssessmentAuthor)

    def get(self, request):
        assessments = self.get_assessment_queryset()
        return Response(AssessmentSerializer(assessments, many=True, context={"request": request}).data)

    def post(self, request):
        serializer = AssessmentSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        assessment = serializer.save()
        return Response(AssessmentSerializer(assessment, context={"request": request}).data, status=201)


class AssessmentDetailView(AssessmentScopeMixin, APIView):
    permission_classes = (IsAuthenticated, IsAssessmentAuthor)

    def get(self, request, assessment_id):
        assessment = self.get_assessment(assessment_id)
        return Response(AssessmentSerializer(assessment, context={"request": request}).data)

    def patch(self, request, assessment_id):
        assessment = self.get_assessment(assessment_id)
        serializer = AssessmentSerializer(
            assessment,
            data=request.data,
            partial=True,
            context={"request": request},
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(AssessmentSerializer(assessment, context={"request": request}).data)


class AssessmentPublishView(AssessmentScopeMixin, APIView):
    permission_classes = (IsAuthenticated, IsAssessmentAuthor)

    @transaction.atomic
    def post(self, request, assessment_id):
        assessment = self.get_assessment(assessment_id)
        if assessment.status != Assessment.Status.DRAFT:
            raise ValidationError({"status": "Only a draft assessment can be published."})
        items = list(
            AssessmentQuestion.objects.select_related("question")
            .filter(assessment=assessment)
            .order_by("position", "pk")
        )
        if not items:
            raise ValidationError({"questions": "Add at least one question before publishing."})
        if assessment.timing_mode == Assessment.TimingMode.PER_QUESTION and any(not item.time_limit_seconds for item in items):
            raise ValidationError({"questions": "Every question needs a positive time limit."})
        for item in items:
            options = list(QuestionOption.objects.filter(question=item.question).order_by("position", "pk"))
            if len(options) < 2 or not any(option.is_correct for option in options):
                raise ValidationError({"questions": f"Question {getattr(item, 'question_id', None)} needs at least two options and a correct answer."})
            if item.question.question_type == Question.Type.SINGLE and sum(option.is_correct for option in options) != 1:
                raise ValidationError({"questions": f"Question {getattr(item, 'question_id', None)} must have exactly one correct option."})
            item.prompt_snapshot = item.question.prompt
            item.question_type_snapshot = item.question.question_type
            item.options_snapshot = [{"id": option.pk, "text": option.text} for option in options]
            item.correct_option_ids_snapshot = [option.pk for option in options if option.is_correct]
            item.explanation_snapshot = item.question.explanation
            item.save()
        assessment.status = Assessment.Status.PUBLISHED
        assessment.save()
        return Response(AssessmentSerializer(assessment, context={"request": request}).data)


class AssessmentNewVersionView(AssessmentScopeMixin, APIView):
    permission_classes = (IsAuthenticated, IsAssessmentAuthor)

    @transaction.atomic
    def post(self, request, assessment_id):
        original = self.get_assessment(assessment_id)
        if original.status != Assessment.Status.PUBLISHED:
            raise ValidationError({"status": "Only a published assessment can be copied to a new draft."})
        draft = Assessment.objects.create(
            branch=original.branch,
            cohort=original.cohort,
            curriculum_topic=original.curriculum_topic,
            title=original.title,
            description=original.description,
            assessment_type=original.assessment_type,
            timing_mode=original.timing_mode,
            duration_seconds=original.duration_seconds,
            attempt_limit=original.attempt_limit,
            deadline_at=original.deadline_at,
            created_by=request.user,
        )
        for item in AssessmentQuestion.objects.filter(assessment=original):
            AssessmentQuestion.objects.create(
                assessment=draft, question=item.question, position=item.position,
                points=item.points, time_limit_seconds=item.time_limit_seconds,
            )
        return Response(AssessmentSerializer(draft, context={"request": request}).data, status=201)


class AssessmentAttemptListView(AssessmentScopeMixin, APIView):
    permission_classes = (IsAuthenticated, IsAssessmentAuthor)

    def get(self, request, assessment_id):
        assessment = self.get_assessment(assessment_id)
        attempts = AssessmentAttempt.objects.filter(assessment=assessment).select_related("student").order_by(
            "student__last_name", "student__first_name", "attempt_number"
        )
        return Response([
            {
                **dict(AssessmentAttemptSerializer(attempt, context={"request": request}).data),
                "score": attempt.score,
                "max_score": attempt.max_score,
                "student": {
                    "id": getattr(attempt, "student_id", None),
                    "name": attempt.student.get_full_name() or attempt.student.username,
                    "username": attempt.student.username,
                },
                "answers": [
                    {
                        "assessment_question": getattr(answer, "assessment_question_id", None),
                        "prompt": answer.assessment_question.prompt_snapshot,
                        "selected_option_ids": answer.selected_option_ids,
                        "is_correct": answer.is_correct,
                        "points_awarded": answer.points_awarded,
                        "correct_option_ids": answer.assessment_question.correct_option_ids_snapshot,
                        "explanation": answer.assessment_question.explanation_snapshot,
                    }
                    for answer in AssessmentAnswer.objects.filter(attempt=attempt).select_related("assessment_question")
                ],
            }
            for attempt in attempts
        ])


class AssessmentResultsReleaseView(AssessmentScopeMixin, APIView):
    permission_classes = (IsAuthenticated, IsAssessmentAuthor)

    @transaction.atomic
    def post(self, request, assessment_id):
        assessment = self.get_assessment(assessment_id)
        assessment = Assessment.objects.select_for_update().get(pk=assessment.pk)
        if assessment.status != Assessment.Status.PUBLISHED:
            raise ValidationError({"status": "Publish the assessment before releasing results."})
        attempts = AssessmentAttempt.objects.filter(assessment=assessment)
        for attempt in attempts.select_for_update().select_related("assessment"):
            _advance_expired_attempt(attempt)
        if not attempts.exclude(status=AssessmentAttempt.Status.IN_PROGRESS).exists():
            raise ValidationError({"attempts": "There are no submitted attempts to release."})
        if attempts.filter(status=AssessmentAttempt.Status.IN_PROGRESS).exists():
            raise ValidationError({"attempts": "All attempts must be submitted before releasing results."})
        assessment.results_released = True
        assessment.save(update_fields=("results_released", "updated_at"))
        return Response({"assessment_id": assessment.pk, "results_released": True})


class StudentAssessmentListView(APIView):
    permission_classes = (IsAuthenticated,)

    def get(self, request):
        if request.user.application_role != User.ApplicationRole.STUDENT:
            raise ValidationError({"detail": "Only Students can access assessments here."})
        cohort_ids = list(Enrollment.objects.filter(student=request.user).values_list("cohort_id", flat=True))
        curriculum_version_ids = list(Cohort.objects.filter(pk__in=cohort_ids).values_list("curriculum_version_id", flat=True))
        assessments = Assessment.objects.filter(status=Assessment.Status.PUBLISHED).filter(
            Q(cohort_id__in=cohort_ids)
            | Q(curriculum_topic__version_id__in=curriculum_version_ids)
        ).distinct()
        now = timezone.now()
        can_start = {}
        for assessment in assessments:
            attempts = AssessmentAttempt.objects.filter(assessment=assessment, student=request.user)
            with transaction.atomic():
                for attempt in attempts.select_for_update().select_related("assessment"):
                    _advance_expired_attempt(attempt)
            can_start[assessment.pk] = (
                (assessment.deadline_at is None or now < assessment.deadline_at)
                and not assessment.results_released
                and not attempts.filter(status=AssessmentAttempt.Status.IN_PROGRESS).exists()
                and attempts.count() < assessment.attempt_limit
            )
        return Response(AssessmentStudentSerializer(
            assessments,
            many=True,
            context={"request": request, "can_start": can_start},
        ).data)


def _grade_attempt(attempt, status):
    questions = list(AssessmentQuestion.objects.filter(assessment=attempt.assessment).order_by("position", "pk"))
    score = Decimal("0.00")
    max_score = Decimal("0.00")
    for question in questions:
        correct_ids = {int(option_id) for option_id in question.correct_option_ids_snapshot}
        answer, _ = AssessmentAnswer.objects.get_or_create(
            attempt=attempt,
            assessment_question=question,
            defaults={"selected_option_ids": []},
        )
        selected_ids = {int(option_id) for option_id in answer.selected_option_ids}
        answer.is_correct = selected_ids == correct_ids
        answer.points_awarded = question.points if answer.is_correct else Decimal("0.00")
        answer.save(update_fields=("is_correct", "points_awarded"))
        max_score += question.points
        score += answer.points_awarded
    attempt.score = score
    attempt.max_score = max_score
    attempt.status = status
    attempt.submitted_at = timezone.now()
    attempt.save(update_fields=("score", "max_score", "status", "submitted_at"))


def _question_deadline(assessment_question, started_at, assessment_deadline):
    question_deadline = started_at + timedelta(seconds=assessment_question.time_limit_seconds)
    if assessment_deadline is not None:
        return min(question_deadline, assessment_deadline)
    return question_deadline


def _advance_expired_attempt(attempt):
    if attempt.status != AssessmentAttempt.Status.IN_PROGRESS:
        return
    now = timezone.now()
    if attempt.deadline_at and now >= attempt.deadline_at:
        _grade_attempt(attempt, AssessmentAttempt.Status.TIMED_OUT)
        return
    if attempt.assessment.timing_mode != Assessment.TimingMode.PER_QUESTION:
        return
    while attempt.current_question_deadline_at and now >= attempt.current_question_deadline_at:
        next_question = AssessmentQuestion.objects.filter(
            assessment=attempt.assessment,
            position__gt=attempt.current_question_position,
        ).order_by("position", "pk").first()
        if next_question is None:
            _grade_attempt(attempt, AssessmentAttempt.Status.TIMED_OUT)
            return
        started_at = attempt.current_question_deadline_at
        attempt.current_question_position = next_question.position
        attempt.current_question_started_at = started_at
        attempt.current_question_deadline_at = _question_deadline(next_question, started_at, attempt.deadline_at)
        attempt.save(update_fields=(
            "current_question_position", "current_question_started_at", "current_question_deadline_at"
        ))


class StudentAssessmentAttemptStartView(APIView):
    permission_classes = (IsAuthenticated,)

    @transaction.atomic
    def post(self, request, assessment_id):
        student = request.user
        if student.application_role != User.ApplicationRole.STUDENT:
            raise ValidationError({"detail": "Only Students can start assessment attempts."})
        assessment = get_object_or_404(Assessment.objects.select_for_update(), pk=assessment_id, status=Assessment.Status.PUBLISHED)
        enrolled = (
            getattr(assessment, "cohort_id", None) is not None
            and Enrollment.objects.filter(cohort_id=getattr(assessment, "cohort_id", None), student=student).exists()
        )
        if getattr(assessment, "curriculum_topic_id", None):
            enrolled = enrolled or Enrollment.objects.filter(
                student=student,
                cohort__curriculum_version_id=getattr(assessment.curriculum_topic, "version_id", None),
            ).exists()
        if not enrolled:
            raise ValidationError({"assessment": "You are not enrolled in this assessment's cohort."})
        now = timezone.now()
        if assessment.results_released:
            raise ValidationError({"assessment": "Results have been released; new attempts are closed."})
        if assessment.deadline_at and now >= assessment.deadline_at:
            raise ValidationError({"deadline_at": "The assessment deadline has passed."})
        attempts = AssessmentAttempt.objects.select_for_update().filter(assessment=assessment, student=student)
        for attempt in attempts.select_related("assessment"):
            _advance_expired_attempt(attempt)
        if attempts.filter(status=AssessmentAttempt.Status.IN_PROGRESS).exists():
            raise ValidationError({"attempt": "An attempt is already in progress."})
        attempt_number = attempts.count() + 1
        if attempt_number > assessment.attempt_limit:
            raise ValidationError({"attempt_limit": "You have reached the attempt limit."})
        first_question = AssessmentQuestion.objects.filter(assessment=assessment).order_by("position", "pk").first()
        if first_question is None:
            raise ValidationError({"questions": "This assessment has no questions."})
        whole_deadline = (
            now + timedelta(seconds=assessment.duration_seconds)
            if assessment.timing_mode == Assessment.TimingMode.WHOLE and assessment.duration_seconds
            else None
        )
        if assessment.deadline_at:
            whole_deadline = min(whole_deadline, assessment.deadline_at) if whole_deadline else assessment.deadline_at
        question_deadline = None
        if assessment.timing_mode == Assessment.TimingMode.PER_QUESTION:
            question_deadline = _question_deadline(first_question, now, whole_deadline)
        attempt = AssessmentAttempt.objects.create(
            assessment=assessment,
            student=student,
            attempt_number=attempt_number,
            started_at=now,
            deadline_at=whole_deadline,
            current_question_position=first_question.position,
            current_question_started_at=now,
            current_question_deadline_at=question_deadline,
        )
        return Response(AssessmentAttemptSerializer(attempt, context={"request": request}).data, status=201)


class StudentAssessmentAttemptDetailView(APIView):
    permission_classes = (IsAuthenticated,)

    def get_attempt(self, request, attempt_id):
        return get_object_or_404(
            AssessmentAttempt.objects.select_related("assessment"),
            pk=attempt_id,
            student=request.user,
            student__application_role=User.ApplicationRole.STUDENT,
        )

    def get(self, request, attempt_id):
        with transaction.atomic():
            attempt = AssessmentAttempt.objects.select_for_update().select_related("assessment").get(pk=self.get_attempt(request, attempt_id).pk)
            _advance_expired_attempt(attempt)
            attempt.refresh_from_db()
        return Response(AssessmentAttemptSerializer(attempt, context={"request": request}).data)

    @transaction.atomic
    def post(self, request, attempt_id):
        scoped_attempt = self.get_attempt(request, attempt_id)
        if (
            request.user.application_role != User.ApplicationRole.STUDENT
            or getattr(scoped_attempt, "student_id", None) != request.user.pk
        ):
            raise ValidationError({"attempt": "Only the Student who owns this attempt can submit answers."})
        attempt = AssessmentAttempt.objects.select_for_update().select_related("assessment").get(pk=scoped_attempt.pk)
        previous_position = attempt.current_question_position
        _advance_expired_attempt(attempt)
        attempt.refresh_from_db()
        if attempt.status != AssessmentAttempt.Status.IN_PROGRESS or attempt.current_question_position != previous_position:
            return Response(AssessmentAttemptSerializer(attempt, context={"request": request}).data)
        question = AssessmentQuestion.objects.filter(
            assessment=attempt.assessment,
            position=attempt.current_question_position,
        ).first()
        if question is None:
            _grade_attempt(attempt, AssessmentAttempt.Status.SUBMITTED)
            return Response(AssessmentAttemptSerializer(attempt, context={"request": request}).data)
        selected_option_ids = request.data.get("selected_option_ids", [])
        if not isinstance(selected_option_ids, list) or any(not isinstance(value, int) for value in selected_option_ids):
            raise ValidationError({"selected_option_ids": "Provide a list of option IDs."})
        if len(selected_option_ids) != len(set(selected_option_ids)):
            raise ValidationError({"selected_option_ids": "An option cannot be selected more than once."})
        valid_option_ids = {item["id"] for item in question.options_snapshot}
        if not set(selected_option_ids).issubset(valid_option_ids):
            raise ValidationError({"selected_option_ids": "Choose only options belonging to the current question."})
        if question.question_type_snapshot == Question.Type.SINGLE and len(selected_option_ids) > 1:
            raise ValidationError({"selected_option_ids": "Select at most one option for this question."})
        if "assessment_question" in request.data and request.data["assessment_question"] != question.pk:
            raise ValidationError({"assessment_question": "This is not the current question."})
        action = request.data.get("action", "next")
        if action not in ("save", "next", "submit"):
            raise ValidationError({"action": "Choose save, next, or submit."})
        AssessmentAnswer.objects.update_or_create(
            attempt=attempt,
            assessment_question=question,
            defaults={"selected_option_ids": selected_option_ids},
        )
        next_question = AssessmentQuestion.objects.filter(
            assessment=attempt.assessment,
            position__gt=attempt.current_question_position,
        ).order_by("position", "pk").first()
        if action == "submit" or (action == "next" and next_question is None):
            _grade_attempt(attempt, AssessmentAttempt.Status.SUBMITTED)
        elif action == "next" and next_question is not None:
            now = timezone.now()
            attempt.current_question_position = next_question.position
            attempt.current_question_started_at = now
            attempt.current_question_deadline_at = (
                _question_deadline(next_question, now, attempt.deadline_at)
                if attempt.assessment.timing_mode == Assessment.TimingMode.PER_QUESTION
                else None
            )
            attempt.save(update_fields=(
                "current_question_position", "current_question_started_at", "current_question_deadline_at"
            ))
        attempt.refresh_from_db()
        return Response(AssessmentAttemptSerializer(attempt, context={"request": request}).data)
