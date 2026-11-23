from django.db import IntegrityError, transaction
from django.test import TestCase
from rest_framework.test import APITestCase

from apps.accounts.models import User

from .models import Branch, Cohort, Enrollment


class BranchModelTests(TestCase):
    def test_branch_is_active_by_default(self):
        branch = Branch.objects.create(name="Central")

        self.assertTrue(branch.is_active)

    def test_branch_string_representation_is_name(self):
        branch = Branch(name="North")

        self.assertEqual(str(branch), "North")

    def test_branch_names_must_be_unique(self):
        Branch.objects.create(name="Central")

        with self.assertRaises(IntegrityError):
            with transaction.atomic():
                Branch.objects.create(name="Central")

    def test_branches_are_ordered_by_name(self):
        Branch.objects.create(name="West")
        Branch.objects.create(name="Central")

        self.assertEqual(
            list(Branch.objects.values_list("name", flat=True)),
            ["Central", "West"],
        )


class CohortAPITests(APITestCase):
    def setUp(self):
        self.central = Branch.objects.create(name="Central")
        self.north = Branch.objects.create(name="North")
        self.branch_admin = User.objects.create_user(
            username="central-admin",
            password="SecurePass123!",
            application_role=User.ApplicationRole.BRANCH_ADMIN,
            branch=self.central,
        )
        self.north_admin = User.objects.create_user(
            username="north-admin",
            password="SecurePass123!",
            application_role=User.ApplicationRole.BRANCH_ADMIN,
            branch=self.north,
        )
        self.super_admin = User.objects.create_user(
            username="super-admin",
            password="SecurePass123!",
            application_role=User.ApplicationRole.SUPER_ADMIN,
        )
        self.instructor = User.objects.create_user(
            username="central-instructor",
            password="SecurePass123!",
            application_role=User.ApplicationRole.INSTRUCTOR,
            branch=self.central,
        )
        self.north_instructor = User.objects.create_user(
            username="north-instructor",
            password="SecurePass123!",
            application_role=User.ApplicationRole.INSTRUCTOR,
            branch=self.north,
        )
        self.student = User.objects.create_user(
            username="central-student",
            password="SecurePass123!",
            application_role=User.ApplicationRole.STUDENT,
            branch=self.central,
        )
        self.north_student = User.objects.create_user(
            username="north-student",
            password="SecurePass123!",
            application_role=User.ApplicationRole.STUDENT,
            branch=self.north,
        )

    def create_cohort(self, **overrides):
        values = {
            "branch": self.central,
            "name": "July Membership Class",
            "description": "A cohort for the July membership class.",
            "start_date": "2026-07-01",
            "end_date": "2026-07-31",
            "instructor": self.instructor,
        }
        values.update(overrides)
        return Cohort.objects.create(**values)

    def test_branch_admin_creates_cohort_in_assigned_branch(self):
        self.client.force_login(self.branch_admin)

        response = self.client.post(
            "/api/cohorts/",
            {
                "name": "July Membership Class",
                "description": "A cohort for the July membership class.",
                "start_date": "2026-07-01",
                "end_date": "2026-07-31",
                "instructor": self.instructor.pk,
            },
            format="json",
        )

        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.json()["branch"], self.central.pk)
        self.assertEqual(response.json()["status"], Cohort.Status.DRAFT)

    def test_branch_admin_can_save_incomplete_draft(self):
        self.client.force_login(self.branch_admin)

        response = self.client.post("/api/cohorts/", {}, format="json")

        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.json()["name"], "")
        self.assertEqual(response.json()["status"], Cohort.Status.DRAFT)

    def test_branch_admin_cannot_create_cohort_for_another_branch(self):
        self.client.force_login(self.branch_admin)

        response = self.client.post(
            "/api/cohorts/",
            {
                "branch": self.north.pk,
                "name": "North Membership Class",
                "description": "A cohort in another branch.",
            },
            format="json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertFalse(Cohort.objects.exists())

    def test_branch_admin_lists_and_filters_only_own_cohorts(self):
        central_cohort = self.create_cohort()
        north_cohort = self.create_cohort(
            branch=self.north,
            name="North Membership Class",
            instructor=self.north_instructor,
        )
        self.client.force_login(self.branch_admin)

        response = self.client.get("/api/cohorts/?status=DRAFT&search=July")

        self.assertEqual(response.status_code, 200)
        ids = {cohort["id"] for cohort in response.json()}
        self.assertEqual(ids, {central_cohort.pk})
        self.assertNotIn(north_cohort.pk, ids)

    def test_invalid_cohort_filter_returns_bad_request(self):
        self.client.force_login(self.branch_admin)

        response = self.client.get("/api/cohorts/?start_date_after=not-a-date")

        self.assertEqual(response.status_code, 400)

    def test_branch_admin_cannot_read_other_branch_cohort_detail(self):
        cohort = self.create_cohort(
            branch=self.north,
            name="North Membership Class",
            instructor=self.north_instructor,
        )
        self.client.force_login(self.branch_admin)

        response = self.client.get(f"/api/cohorts/{cohort.pk}/")

        self.assertEqual(response.status_code, 404)

    def test_instructor_must_be_assigned_to_cohort_branch(self):
        self.client.force_login(self.branch_admin)

        response = self.client.post(
            "/api/cohorts/",
            {
                "name": "Wrong Instructor Cohort",
                "instructor": self.north_instructor.pk,
            },
            format="json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn("instructor", response.json())

    def test_ready_status_requires_details_instructor_and_student(self):
        cohort = self.create_cohort(instructor=None)
        self.client.force_login(self.branch_admin)

        response = self.client.patch(
            f"/api/cohorts/{cohort.pk}/",
            {"status": Cohort.Status.READY},
            format="json",
        )

        self.assertEqual(response.status_code, 400)
        cohort.refresh_from_db()
        self.assertEqual(cohort.status, Cohort.Status.DRAFT)

    def test_cohort_becomes_ready_after_enrolling_same_branch_student(self):
        cohort = self.create_cohort()
        self.client.force_login(self.branch_admin)

        enroll_response = self.client.post(
            f"/api/cohorts/{cohort.pk}/enrollments/",
            {"student": self.student.pk},
            format="json",
        )
        ready_response = self.client.patch(
            f"/api/cohorts/{cohort.pk}/",
            {"status": Cohort.Status.READY},
            format="json",
        )

        self.assertEqual(enroll_response.status_code, 201)
        self.assertEqual(ready_response.status_code, 200)
        self.assertEqual(ready_response.json()["status"], Cohort.Status.READY)
        self.assertEqual(ready_response.json()["student_count"], 1)

    def test_cross_branch_student_cannot_be_enrolled(self):
        cohort = self.create_cohort()
        self.client.force_login(self.branch_admin)

        response = self.client.post(
            f"/api/cohorts/{cohort.pk}/enrollments/",
            {"student": self.north_student.pk},
            format="json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertFalse(Enrollment.objects.filter(cohort=cohort).exists())

    def test_non_student_cannot_be_enrolled(self):
        cohort = self.create_cohort()
        self.client.force_login(self.branch_admin)

        response = self.client.post(
            f"/api/cohorts/{cohort.pk}/enrollments/",
            {"student": self.instructor.pk},
            format="json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertFalse(Enrollment.objects.filter(cohort=cohort).exists())

    def test_ready_cohort_cannot_remove_its_last_student(self):
        cohort = self.create_cohort(status=Cohort.Status.DRAFT)
        Enrollment.objects.create(cohort=cohort, student=self.student)
        cohort.status = Cohort.Status.READY
        cohort.save()
        self.client.force_login(self.branch_admin)

        response = self.client.delete(
            f"/api/cohorts/{cohort.pk}/enrollments/{self.student.pk}/"
        )

        self.assertEqual(response.status_code, 400)
        self.assertTrue(Enrollment.objects.filter(cohort=cohort, student=self.student).exists())

    def test_super_admin_can_list_cohorts_across_branches(self):
        central_cohort = self.create_cohort()
        north_cohort = self.create_cohort(
            branch=self.north,
            name="North Membership Class",
            instructor=self.north_instructor,
        )
        self.client.force_login(self.super_admin)

        response = self.client.get("/api/cohorts/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            {cohort["id"] for cohort in response.json()},
            {central_cohort.pk, north_cohort.pk},
        )