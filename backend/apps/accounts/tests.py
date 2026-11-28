from io import StringIO
from unittest.mock import patch

from django.core.exceptions import ValidationError
from django.core.management import call_command
from django.core.management.base import CommandError
from django.test import TestCase
from rest_framework.test import APITestCase

from apps.core.models import Branch

from .models import User
from .permissions import (
    IsBranchAdmin,
    IsSuperAdmin,
    filter_users_for_request,
)


class UserRoleFoundationTests(TestCase):
    def setUp(self):
        self.branch = Branch.objects.create(name="Central")

    def test_user_creation_defaults_to_student(self):
        user = User.objects.create_user(
            username="new-user",
            password="secure-pass-123",
            branch=self.branch,
        )

        self.assertEqual(user.application_role, User.ApplicationRole.STUDENT)

    def test_branch_admin_requires_branch(self):
        user = User(
            username="branch-admin",
            password="secure-pass-123",
            application_role=User.ApplicationRole.BRANCH_ADMIN,
        )

        with self.assertRaises(ValidationError):
            user.full_clean()

    def test_instructor_requires_branch(self):
        user = User(
            username="instructor",
            password="secure-pass-123",
            application_role=User.ApplicationRole.INSTRUCTOR,
        )

        with self.assertRaises(ValidationError):
            user.full_clean()

    def test_student_requires_branch(self):
        user = User(
            username="student",
            password="secure-pass-123",
            application_role=User.ApplicationRole.STUDENT,
        )

        with self.assertRaises(ValidationError):
            user.full_clean()

    def test_super_admin_can_operate_without_branch(self):
        user = User(
            username="super-admin",
            password="secure-pass-123",
            application_role=User.ApplicationRole.SUPER_ADMIN,
        )

        user.full_clean()

        self.assertIsNone(user.branch)

    def test_technical_flags_do_not_grant_application_privileges(self):
        user = User.objects.create_user(
            username="staff-account",
            password="secure-pass-123",
            is_staff=True,
            is_superuser=False,
            application_role=User.ApplicationRole.STUDENT,
            branch=self.branch,
        )

        self.assertTrue(user.is_staff)
        self.assertFalse(user.is_superuser)
        self.assertFalse(user.is_super_admin())

    def test_branch_admin_accepts_a_branch(self):
        user = User(
            username="branch-admin",
            password="secure-pass-123",
            application_role=User.ApplicationRole.BRANCH_ADMIN,
            branch=self.branch,
        )

        user.full_clean()

    def test_instructor_accepts_a_branch(self):
        user = User(
            username="instructor",
            password="secure-pass-123",
            application_role=User.ApplicationRole.INSTRUCTOR,
            branch=self.branch,
        )

        user.full_clean()

    def test_student_accepts_a_branch(self):
        user = User(
            username="student",
            password="secure-pass-123",
            application_role=User.ApplicationRole.STUDENT,
            branch=self.branch,
        )

        user.full_clean()


class AuthenticationTests(APITestCase):
    def setUp(self):
        self.branch = Branch.objects.create(name="Central")
        self.user = User.objects.create_user(
            username="student-user",
            email="student@example.com",
            password="OldPassword123!",
            application_role=User.ApplicationRole.STUDENT,
            branch=self.branch,
        )

    def test_login_returns_current_user_profile(self):
        response = self.client.post(
            "/api/accounts/login/",
            {"username": "student-user", "password": "OldPassword123!"},
        )

        payload = response.json()
        self.assertEqual(response.status_code, 200)
        self.assertEqual(payload["application_role"], "STUDENT")
        self.assertEqual(payload["branch"]["id"], self.branch.pk)

    def test_login_rejects_invalid_credentials(self):
        response = self.client.post(
            "/api/accounts/login/",
            {"username": "student-user", "password": "wrong-password"},
        )

        self.assertEqual(response.status_code, 400)

    def test_login_accepts_email_case_insensitively(self):
        response = self.client.post(
            "/api/accounts/login/",
            {"username": "STUDENT@example.com", "password": "OldPassword123!"},
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["id"], self.user.pk)

    def test_login_rejects_ambiguous_identifier(self):
        User.objects.create_user(
            username="other-user", email="STUDENT@example.com", password="OldPassword123!", branch=self.branch,
        )
        response = self.client.post(
            "/api/accounts/login/",
            {"username": "student@example.com", "password": "OldPassword123!"},
        )
        self.assertEqual(response.status_code, 400)

    def test_profile_requires_authentication(self):
        response = self.client.get("/api/accounts/me/")

        self.assertIn(response.status_code, (401, 403))

    def test_authenticated_user_can_read_profile(self):
        self.client.force_login(self.user)

        response = self.client.get("/api/accounts/me/")

        payload = response.json()
        self.assertEqual(response.status_code, 200)
        self.assertEqual(payload["username"], "student-user")

    def test_password_change_updates_password(self):
        self.client.force_login(self.user)

        response = self.client.post(
            "/api/accounts/password/change/",
            {
                "old_password": "OldPassword123!",
                "new_password": "NewPassword123!",
            },
        )

        self.assertEqual(response.status_code, 200)
        self.refresh_user()
        self.assertTrue(self.user.check_password("NewPassword123!"))

    def test_logout_ends_session(self):
        self.client.force_login(self.user)

        response = self.client.post("/api/accounts/logout/")

        self.assertIn(response.status_code, (200, 204))
        profile = self.client.get("/api/accounts/me/")
        self.assertIn(profile.status_code, (401, 403))

    def refresh_user(self):
        self.user.refresh_from_db()


class CreateAppSuperAdminTests(TestCase):
    @patch("apps.accounts.management.commands.create_app_super_admin.getpass.getpass")
    def test_creates_application_admin_without_django_admin_access(self, password_prompt):
        password_prompt.side_effect = ["SecurePass123!", "SecurePass123!"]
        call_command("create_app_super_admin", "ADMIN@example.com", stdout=StringIO())
        user = User.objects.get(email="admin@example.com")
        self.assertEqual(user.application_role, User.ApplicationRole.SUPER_ADMIN)
        self.assertFalse(user.is_staff)
        self.assertFalse(user.is_superuser)
        self.assertTrue(user.check_password("SecurePass123!"))
        response = self.client.post("/api/accounts/login/", {"username": "admin@example.com", "password": "SecurePass123!"})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["application_role"], "SUPER_ADMIN")

    @patch("apps.accounts.management.commands.create_app_super_admin.getpass.getpass")
    def test_rejects_mismatched_passwords(self, password_prompt):
        password_prompt.side_effect = ["SecurePass123!", "OtherPass123!"]
        with self.assertRaises(CommandError):
            call_command("create_app_super_admin", "admin@example.com", stdout=StringIO())
        self.assertFalse(User.objects.filter(email="admin@example.com").exists())

    def test_rejects_duplicate_email_before_prompting(self):
        branch = Branch.objects.create(name="Existing branch")
        User.objects.create_user(username="existing", email="admin@example.com", password="SecurePass123!", branch=branch)
        with self.assertRaises(CommandError):
            call_command("create_app_super_admin", "ADMIN@example.com", stdout=StringIO())


class ApplicationAuthorizationTests(APITestCase):
    def setUp(self):
        self.central = Branch.objects.create(name="Central")
        self.north = Branch.objects.create(name="North")

        self.super_admin = User.objects.create_user(
            username="super-admin",
            password="SecurePass123!",
            application_role=User.ApplicationRole.SUPER_ADMIN,
            is_staff=True,
            is_superuser=True,
        )
        self.branch_admin = User.objects.create_user(
            username="central-admin",
            password="SecurePass123!",
            application_role=User.ApplicationRole.BRANCH_ADMIN,
            branch=self.central,
        )
        self.staff_without_role = User.objects.create_user(
            username="staff-only",
            password="SecurePass123!",
            is_staff=True,
            application_role=User.ApplicationRole.STUDENT,
            branch=self.central,
        )

    def test_super_admin_permission_is_application_role_based(self):
        request = type("Request", (), {"user": self.super_admin})()

        self.assertTrue(IsSuperAdmin().has_permission(request, None))

    def test_staff_flag_does_not_grant_super_admin_permission(self):
        request = type("Request", (), {"user": self.staff_without_role})()

        self.assertFalse(IsSuperAdmin().has_permission(request, None))

    def test_branch_admin_permission_requires_application_role(self):
        request = type("Request", (), {"user": self.branch_admin})()

        self.assertTrue(IsBranchAdmin().has_permission(request, None))

    def test_branch_admin_queryset_is_limited_to_own_branch(self):
        central_student = User.objects.create_user(
            username="central-student",
            password="SecurePass123!",
            application_role=User.ApplicationRole.STUDENT,
            branch=self.central,
        )
        north_student = User.objects.create_user(
            username="north-student",
            password="SecurePass123!",
            application_role=User.ApplicationRole.STUDENT,
            branch=self.north,
        )

        request = type("Request", (), {"user": self.branch_admin})()
        filtered = filter_users_for_request(request, User.objects.all())

        self.assertIn(central_student, filtered)
        self.assertNotIn(north_student, filtered)

    def test_super_admin_queryset_spans_all_branches(self):
        request = type("Request", (), {"user": self.super_admin})()

        filtered = filter_users_for_request(request, User.objects.all())

        self.assertEqual(filtered.count(), User.objects.count())


class BranchAndUserProvisioningTests(APITestCase):
    def setUp(self):
        self.central = Branch.objects.create(name="Central")
        self.north = Branch.objects.create(name="North")
        self.super_admin = User.objects.create_user(
            username="super-admin",
            password="SecurePass123!",
            application_role=User.ApplicationRole.SUPER_ADMIN,
            is_staff=True,
            is_superuser=True,
        )
        self.branch_admin = User.objects.create_user(
            username="central-admin",
            password="SecurePass123!",
            application_role=User.ApplicationRole.BRANCH_ADMIN,
            branch=self.central,
        )

    def test_account_username_cannot_match_an_existing_email(self):
        User.objects.create_user(username="existing", email="admin@example.com", password="SecurePass123!", branch=self.central)
        self.client.force_login(self.branch_admin)
        response = self.client.post("/api/accounts/users/", {
            "username": "admin@example.com", "password": "SecurePass123!", "application_role": "STUDENT",
        }, format="json")
        self.assertEqual(response.status_code, 400)

    def test_account_email_cannot_match_an_existing_username(self):
        User.objects.create_user(username="admin@example.com", password="SecurePass123!", branch=self.central)
        self.client.force_login(self.branch_admin)
        response = self.client.patch(f"/api/accounts/users/{self.branch_admin.pk}/", {"email": "admin@example.com"}, format="json")
        self.assertEqual(response.status_code, 400)

    def test_super_admin_can_create_and_edit_branch(self):
        self.client.force_login(self.super_admin)

        create_response = self.client.post(
            "/api/branches/",
            {"name": "East", "is_active": True},
            format="json",
        )
        self.assertEqual(create_response.status_code, 201)

        branch_id = create_response.json()["id"]
        update_response = self.client.patch(
            f"/api/branches/{branch_id}/",
            {"name": "East Campus", "is_active": False},
            format="json",
        )
        self.assertEqual(update_response.status_code, 200)

    def test_staff_without_super_admin_role_cannot_create_branch(self):
        staff = User.objects.create_user(
            username="staff-only",
            password="SecurePass123!",
            is_staff=True,
            application_role=User.ApplicationRole.STUDENT,
            branch=self.central,
        )
        self.client.force_login(staff)

        response = self.client.post(
            "/api/branches/",
            {"name": "East", "is_active": True},
            format="json",
        )

        self.assertIn(response.status_code, (403, 404))

    def test_super_admin_can_create_branch_admin(self):
        self.client.force_login(self.super_admin)

        response = self.client.post(
            "/api/accounts/users/",
            {
                "username": "north-admin",
                "email": "north-admin@example.com",
                "password": "SecurePass123!",
                "application_role": "BRANCH_ADMIN",
                "branch": self.north.pk,
            },
            format="json",
        )

        self.assertEqual(response.status_code, 201)
        created = User.objects.get(username="north-admin")
        self.assertEqual(created.application_role, User.ApplicationRole.BRANCH_ADMIN)
        self.assertEqual(created.branch, self.north)

    def test_branch_admin_can_create_student_in_own_branch(self):
        self.client.force_login(self.branch_admin)

        response = self.client.post(
            "/api/accounts/users/",
            {
                "username": "central-student",
                "email": "central-student@example.com",
                "password": "SecurePass123!",
                "application_role": "STUDENT",
                "branch": self.north.pk,
            },
            format="json",
        )

        self.assertEqual(response.status_code, 201)
        created = User.objects.get(username="central-student")
        self.assertEqual(created.application_role, User.ApplicationRole.STUDENT)
        self.assertEqual(created.branch, self.central)

    def test_branch_admin_can_create_instructor_in_own_branch(self):
        self.client.force_login(self.branch_admin)

        response = self.client.post(
            "/api/accounts/users/",
            {
                "username": "central-instructor",
                "email": "central-instructor@example.com",
                "password": "SecurePass123!",
                "application_role": "INSTRUCTOR",
            },
            format="json",
        )

        self.assertEqual(response.status_code, 201)
        created = User.objects.get(username="central-instructor")
        self.assertEqual(created.branch, self.central)

    def test_branch_admin_cannot_create_branch_admin(self):
        self.client.force_login(self.branch_admin)

        response = self.client.post(
            "/api/accounts/users/",
            {
                "username": "another-admin",
                "password": "SecurePass123!",
                "application_role": "BRANCH_ADMIN",
                "branch": self.central.pk,
            },
            format="json",
        )

        self.assertIn(response.status_code, (400, 403))

    def test_branch_admin_cannot_view_other_branch_users(self):
        north_user = User.objects.create_user(
            username="north-student",
            password="SecurePass123!",
            application_role=User.ApplicationRole.STUDENT,
            branch=self.north,
        )
        self.client.force_login(self.branch_admin)

        response = self.client.get("/api/accounts/users/")

        self.assertEqual(response.status_code, 200)
        usernames = {user["username"] for user in response.json()}
        self.assertNotIn(north_user.username, usernames)

    def test_branch_admin_cannot_promote_student_to_instructor(self):
        student = User.objects.create_user(
            username="student-account",
            password="SecurePass123!",
            application_role=User.ApplicationRole.STUDENT,
            branch=self.central,
        )
        self.client.force_login(self.branch_admin)

        response = self.client.patch(
            f"/api/accounts/users/{student.pk}/",
            {"application_role": "INSTRUCTOR", "branch": self.north.pk},
            format="json",
        )

        student.refresh_from_db()
        self.assertEqual(response.status_code, 400)
        self.assertEqual(student.application_role, User.ApplicationRole.STUDENT)
        self.assertEqual(student.branch, self.central)

    def test_super_admin_can_change_user_role_and_branch(self):
        student = User.objects.create_user(
            username="reassigned-user",
            password="SecurePass123!",
            application_role=User.ApplicationRole.STUDENT,
            branch=self.central,
        )
        self.client.force_login(self.super_admin)

        response = self.client.patch(
            f"/api/accounts/users/{student.pk}/",
            {
                "application_role": "BRANCH_ADMIN",
                "branch": self.north.pk,
            },
            format="json",
        )

        student.refresh_from_db()
        self.assertEqual(response.status_code, 200)
        self.assertEqual(student.application_role, User.ApplicationRole.BRANCH_ADMIN)
        self.assertEqual(student.branch, self.north)

    def test_super_admin_cannot_promote_existing_student_to_instructor(self):
        student = User.objects.create_user(
            username="student-account",
            password="SecurePass123!",
            application_role=User.ApplicationRole.STUDENT,
            branch=self.central,
        )
        self.client.force_login(self.super_admin)

        response = self.client.patch(
            f"/api/accounts/users/{student.pk}/",
            {"application_role": "INSTRUCTOR"},
            format="json",
        )

        student.refresh_from_db()
        self.assertEqual(response.status_code, 400)
        self.assertEqual(student.application_role, User.ApplicationRole.STUDENT)

    def test_super_admin_account_cannot_be_assigned_to_a_branch(self):
        self.client.force_login(self.super_admin)

        response = self.client.patch(
            f"/api/accounts/users/{self.super_admin.pk}/",
            {"branch": self.central.pk},
            format="json",
        )

        self.super_admin.refresh_from_db()
        self.assertEqual(response.status_code, 400)
        self.assertIsNone(self.super_admin.branch)

    def test_branch_admin_cannot_change_user_role_or_branch(self):
        student = User.objects.create_user(
            username="branch-student",
            password="SecurePass123!",
            application_role=User.ApplicationRole.STUDENT,
            branch=self.central,
        )
        self.client.force_login(self.branch_admin)

        response = self.client.patch(
            f"/api/accounts/users/{student.pk}/",
            {
                "application_role": "BRANCH_ADMIN",
                "branch": self.north.pk,
            },
            format="json",
        )

        student.refresh_from_db()
        self.assertEqual(response.status_code, 400)
        self.assertEqual(student.application_role, User.ApplicationRole.STUDENT)
        self.assertEqual(student.branch, self.central)

    def test_inactive_branch_cannot_receive_new_user(self):
        self.central.is_active = False
        self.central.save()
        self.client.force_login(self.super_admin)

        response = self.client.post(
            "/api/accounts/users/",
            {
                "username": "inactive-student",
                "password": "SecurePass123!",
                "application_role": "STUDENT",
                "branch": self.central.pk,
            },
            format="json",
        )

        self.assertIn(response.status_code, (400, 404))
