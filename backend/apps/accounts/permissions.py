from rest_framework.permissions import BasePermission


class IsSuperAdmin(BasePermission):
    def has_permission(self, request, view):
        user = request.user
        return bool(user and user.is_authenticated and user.is_super_admin())


class IsBranchAdmin(BasePermission):
    def has_permission(self, request, view):
        user = request.user
        return bool(user and user.is_authenticated and user.is_branch_admin())


class IsInstructor(BasePermission):
    def has_permission(self, request, view):
        user = request.user
        return bool(
            user
            and user.is_authenticated
            and user.application_role == user.ApplicationRole.INSTRUCTOR
        )


class IsStudent(BasePermission):
    def has_permission(self, request, view):
        user = request.user
        return bool(
            user
            and user.is_authenticated
            and user.application_role == user.ApplicationRole.STUDENT
        )


class IsSameBranchUser(BasePermission):
    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated)

    def has_object_permission(self, request, view, obj):
        user = request.user
        if user.is_super_admin():
            return True
        if user.is_branch_admin():
            return obj.branch_id == user.branch_id
        if request.method in ("GET", "HEAD", "OPTIONS"):
            return obj.pk == user.pk
        return False


def filter_users_for_request(request, queryset):
    user = request.user
    if user.is_super_admin():
        return queryset
    if user.is_branch_admin():
        return queryset.filter(branch_id=user.branch_id)
    return queryset.filter(pk=user.pk)
