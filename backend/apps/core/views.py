from typing import cast

from django.db.models import QuerySet
from rest_framework.decorators import api_view
from rest_framework.generics import ListCreateAPIView, RetrieveUpdateAPIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.accounts.models import User
from apps.accounts.permissions import IsSuperAdmin

from .models import Branch
from .serializers import BranchSerializer


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
