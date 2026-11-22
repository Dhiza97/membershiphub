from django.urls import path

from .views import (
    CurrentUserView,
    LoginView,
    LogoutView,
    ManagedUserDetailView,
    ManagedUserListCreateView,
    PasswordChangeView,
)


urlpatterns = [
    path("login/", LoginView.as_view(), name="login"),
    path("logout/", LogoutView.as_view(), name="logout"),
    path("me/", CurrentUserView.as_view(), name="current-user"),
    path("password/change/", PasswordChangeView.as_view(), name="password-change"),
    path("users/", ManagedUserListCreateView.as_view(), name="managed-user-list-create"),
    path("users/<int:pk>/", ManagedUserDetailView.as_view(), name="managed-user-detail"),
]