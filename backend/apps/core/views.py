from typing import cast
from typing import Any

from django.db.models import QuerySet
from django.shortcuts import get_object_or_404
from rest_framework.decorators import api_view
from rest_framework.exceptions import ValidationError
from rest_framework.generics import ListCreateAPIView, RetrieveUpdateAPIView
from rest_framework.permissions import BasePermission, IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.models import User
from apps.accounts.permissions import IsSuperAdmin

from .models import Branch, Cohort, Enrollment
from .serializers import (
    BranchSerializer,
    CohortFilterSerializer,
    CohortSerializer,
    EnrollmentCreateSerializer,
    EnrollmentSerializer,
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


class CohortScopeMixin:
    def get_cohort_queryset(self):
        request = cast(Request, getattr(self, "request"))
        user = request.user
        queryset = Cohort.objects.select_related("branch", "instructor").prefetch_related(
            "enrollments__student"
        )
        if user.is_super_admin():
            return queryset
        if user.is_branch_admin() and user.branch_id:
            return queryset.filter(branch_id=user.branch_id)
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
