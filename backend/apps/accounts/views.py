from django.contrib.auth import login, logout, update_session_auth_hash
from rest_framework import status
from rest_framework.generics import ListCreateAPIView, RetrieveUpdateAPIView
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import User
from .permissions import IsSameBranchUser, filter_users_for_request
from .serializers import (
    LoginSerializer,
    ManagedUserCreateSerializer,
    ManagedUserSerializer,
    ManagedUserUpdateSerializer,
    PasswordChangeSerializer,
    UserProfileSerializer,
)


class LoginView(APIView):
    permission_classes = (AllowAny,)

    def post(self, request):
        serializer = LoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.validated_data["user"]
        login(request, user)
        return Response(UserProfileSerializer(user).data)


class LogoutView(APIView):
    permission_classes = (IsAuthenticated,)

    def post(self, request):
        logout(request)
        return Response(status=status.HTTP_204_NO_CONTENT)


class CurrentUserView(APIView):
    permission_classes = (IsAuthenticated,)

    def get(self, request):
        return Response(UserProfileSerializer(request.user).data)


class PasswordChangeView(APIView):
    permission_classes = (IsAuthenticated,)

    def post(self, request):
        serializer = PasswordChangeSerializer(
            data=request.data,
            context={"request": request},
        )
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        update_session_auth_hash(request, user)
        return Response({"detail": "Password changed successfully."})


class ManagedUserListCreateView(ListCreateAPIView):
    permission_classes = (IsAuthenticated,)

    def get_queryset(self):
        return filter_users_for_request(self.request, User.objects.select_related("branch"))

    def get_serializer_class(self):
        if self.request.method == "POST":
            return ManagedUserCreateSerializer
        return ManagedUserSerializer

    def get_serializer_context(self):
        context = super().get_serializer_context()
        context["request"] = self.request
        return context


class ManagedUserDetailView(RetrieveUpdateAPIView):
    permission_classes = (IsAuthenticated, IsSameBranchUser)

    queryset = User.objects.select_related("branch")

    def get_queryset(self):
        return filter_users_for_request(self.request, self.queryset)

    def get_serializer_class(self):
        if self.request.method in ("PUT", "PATCH"):
            return ManagedUserUpdateSerializer
        return ManagedUserSerializer
