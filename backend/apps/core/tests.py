from datetime import date, time, timedelta
from typing import cast

from django.db import IntegrityError, transaction
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APITestCase

from apps.accounts.models import User

from .models import (
    Branch,
    Cohort,
    Curriculum,
    CurriculumTopic,
    CurriculumVersion,
    Enrollment,
    Session,
    Attendance,
)


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

    def create_published_curriculum_version(self):
        curriculum = Curriculum.objects.create(
            branch=self.central,
            name="Central Foundations",
        )
        version = CurriculumVersion.objects.create(
            curriculum=curriculum,
            version_number=1,
        )
        CurriculumTopic.objects.create(version=version, title="Introduction")
        version.status = CurriculumVersion.Status.PUBLISHED
        version.save()
        return version

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
        curriculum_version = self.create_published_curriculum_version()
        self.client.force_login(self.branch_admin)

        enroll_response = self.client.post(
            f"/api/cohorts/{cohort.pk}/enrollments/",
            {"student": self.student.pk},
            format="json",
        )
        ready_response = self.client.patch(
            f"/api/cohorts/{cohort.pk}/",
            {
                "status": Cohort.Status.READY,
                "curriculum_version": curriculum_version.pk,
            },
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
        curriculum_version = self.create_published_curriculum_version()
        cohort = self.create_cohort(
            status=Cohort.Status.DRAFT,
            curriculum_version=curriculum_version,
        )
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


class CurriculumAPITests(APITestCase):
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
        self.instructor = User.objects.create_user(
            username="central-instructor",
            password="SecurePass123!",
            application_role=User.ApplicationRole.INSTRUCTOR,
            branch=self.central,
        )
        self.student = User.objects.create_user(
            username="central-student",
            password="SecurePass123!",
            application_role=User.ApplicationRole.STUDENT,
            branch=self.central,
        )

    def create_published_curriculum(self, name="Membership Foundations", branch=None):
        branch = branch or self.central
        admin = self.branch_admin if branch == self.central else self.north_admin
        self.client.force_login(admin)
        curriculum_response = self.client.post(
            "/api/curricula/",
            {"name": name, "description": "Core membership learning."},
            format="json",
        )
        self.assertEqual(curriculum_response.status_code, 201)
        curriculum_id = curriculum_response.json()["id"]

        versions_response = self.client.get(f"/api/curricula/{curriculum_id}/versions/")
        self.assertEqual(versions_response.status_code, 200)
        version_id = versions_response.json()[0]["id"]
        draft_update_response = self.client.patch(
            f"/api/curricula/{curriculum_id}/versions/{version_id}/",
            {
                "topics": [
                    {
                        "title": "The Church",
                        "description": "Understand the church and its mission.",
                        "notes": "Branch-editable facilitator notes.",
                        "position": 0,
                        "objectives": [
                            {"text": "Describe the purpose of the church.", "position": 0}
                        ],
                        "lessons": [
                            {
                                "title": "A shared calling",
                                "description": "An introduction to shared service.",
                                "position": 0,
                                "materials": [
                                    {
                                        "title": "Reading guide",
                                        "url": "https://example.org/reading-guide",
                                        "material_type": "ARTICLE",
                                        "position": 0,
                                    }
                                ],
                            }
                        ],
                    }
                ]
            },
            format="json",
        )
        self.assertEqual(draft_update_response.status_code, 200)
        publish_response = self.client.post(
            f"/api/curricula/{curriculum_id}/versions/{version_id}/publish/",
            format="json",
        )
        self.assertEqual(publish_response.status_code, 200)
        return Curriculum.objects.get(pk=curriculum_id), CurriculumVersion.objects.get(pk=version_id)

    def test_branch_admin_creates_curriculum_and_initial_draft(self):
        self.client.force_login(self.branch_admin)

        curriculum_response = self.client.post(
            "/api/curricula/",
            {"name": "Foundations"},
            format="json",
        )
        curriculum_id = curriculum_response.json()["id"]
        version_response = self.client.get(f"/api/curricula/{curriculum_id}/versions/")

        self.assertEqual(curriculum_response.status_code, 201)
        self.assertEqual(curriculum_response.json()["branch"], self.central.pk)
        self.assertEqual(version_response.status_code, 200)
        self.assertEqual(version_response.json()[0]["version_number"], 1)
        self.assertEqual(version_response.json()[0]["status"], CurriculumVersion.Status.DRAFT)

    def test_branch_admin_cannot_read_other_branch_curriculum(self):
        other = Curriculum.objects.create(branch=self.north, name="North Curriculum")
        self.client.force_login(self.branch_admin)

        response = self.client.get(f"/api/curricula/{other.pk}/")

        self.assertEqual(response.status_code, 404)

    def test_published_version_is_immutable_and_next_version_clones_content(self):
        curriculum, published = self.create_published_curriculum()
        self.client.force_login(self.branch_admin)

        immutable_response = self.client.patch(
            f"/api/curricula/{curriculum.pk}/versions/{published.pk}/",
            {"change_note": "Try to rewrite history"},
            format="json",
        )
        next_version_response = self.client.post(
            f"/api/curricula/{curriculum.pk}/versions/",
            {"change_note": "Updated lesson notes"},
            format="json",
        )

        self.assertEqual(immutable_response.status_code, 400)
        self.assertEqual(next_version_response.status_code, 201)
        self.assertEqual(next_version_response.json()["version_number"], 2)
        self.assertEqual(next_version_response.json()["topics"][0]["title"], "The Church")
        self.assertEqual(next_version_response.json()["topics"][0]["lessons"][0]["materials"][0]["url"], "https://example.org/reading-guide")

    def test_cohort_ready_snapshot_stays_unchanged_after_curriculum_edit(self):
        curriculum, published = self.create_published_curriculum()
        self.client.force_login(self.branch_admin)
        cohort_response = self.client.post(
            "/api/cohorts/",
            {
                "name": "Foundations Cohort",
                "description": "Ready cohort with a frozen learning plan.",
                "start_date": "2026-07-01",
                "end_date": "2026-08-31",
                "instructor": self.instructor.pk,
                "curriculum_version": published.pk,
            },
            format="json",
        )
        cohort_id = cohort_response.json()["id"]
        enrollment_response = self.client.post(
            f"/api/cohorts/{cohort_id}/enrollments/",
            {"student": self.student.pk},
            format="json",
        )
        ready_response = self.client.patch(
            f"/api/cohorts/{cohort_id}/",
            {"status": Cohort.Status.READY},
            format="json",
        )
        self.assertEqual(cohort_response.status_code, 201)
        self.assertEqual(enrollment_response.status_code, 201)
        self.assertEqual(ready_response.status_code, 200)
        cohort = Cohort.objects.get(pk=cohort_id)
        original_snapshot = cast(dict, cohort.curriculum_snapshot)
        self.assertEqual(original_snapshot["topics"][0]["title"], "The Church")

        next_version_response = self.client.post(
            f"/api/curricula/{curriculum.pk}/versions/",
            {"change_note": "Rename topic for future cohorts"},
            format="json",
        )
        next_version_id = next_version_response.json()["id"]
        updated_tree = next_version_response.json()["topics"]
        updated_tree[0]["title"] = "Life in the Church"
        edit_response = self.client.patch(
            f"/api/curricula/{curriculum.pk}/versions/{next_version_id}/",
            {"topics": updated_tree},
            format="json",
        )
        change_cohort_response = self.client.patch(
            f"/api/cohorts/{cohort_id}/",
            {"curriculum_version": next_version_id},
            format="json",
        )

        cohort.refresh_from_db()
        self.assertEqual(next_version_response.status_code, 201)
        self.assertEqual(edit_response.status_code, 200)
        self.assertEqual(change_cohort_response.status_code, 400)
        self.assertEqual(getattr(cohort, "curriculum_version_id", None), published.pk)
        self.assertEqual(cohort.curriculum_snapshot, original_snapshot)

    def test_cohort_cannot_use_another_branches_curriculum(self):
        _, north_version = self.create_published_curriculum(
            name="North Curriculum",
            branch=self.north,
        )
        self.client.force_login(self.branch_admin)

        response = self.client.post(
            "/api/cohorts/",
            {
                "name": "Wrong Curriculum",
                "curriculum_version": north_version.pk,
            },
            format="json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn("curriculum_version", response.json())


class SessionAttendanceAPITests(APITestCase):
    def setUp(self):
        self.branch = Branch.objects.create(name="Central")
        self.other_branch = Branch.objects.create(name="North")
        self.branch_admin = User.objects.create_user(
            username="branch-admin",
            password="SecurePass123!",
            application_role=User.ApplicationRole.BRANCH_ADMIN,
            branch=self.branch,
        )
        self.super_admin = User.objects.create_user(
            username="super-admin",
            password="SecurePass123!",
            application_role=User.ApplicationRole.SUPER_ADMIN,
        )
        self.instructor = User.objects.create_user(
            username="assigned-instructor",
            password="SecurePass123!",
            application_role=User.ApplicationRole.INSTRUCTOR,
            branch=self.branch,
        )
        self.other_instructor = User.objects.create_user(
            username="other-instructor",
            password="SecurePass123!",
            application_role=User.ApplicationRole.INSTRUCTOR,
            branch=self.branch,
        )
        self.student = User.objects.create_user(
            username="student-one",
            password="SecurePass123!",
            application_role=User.ApplicationRole.STUDENT,
            branch=self.branch,
        )
        self.other_student = User.objects.create_user(
            username="student-two",
            password="SecurePass123!",
            application_role=User.ApplicationRole.STUDENT,
            branch=self.branch,
        )
        today = timezone.localdate()
        self.cohort = Cohort.objects.create(
            branch=self.branch,
            name="Attendance cohort",
            description="Session and attendance tests.",
            start_date=today - timedelta(days=2),
            end_date=today + timedelta(days=20),
            instructor=self.instructor,
        )
        self.other_cohort = Cohort.objects.create(
            branch=self.branch,
            name="Other instructor cohort",
            description="Not assigned to the primary instructor.",
            start_date=today - timedelta(days=2),
            end_date=today + timedelta(days=20),
            instructor=self.other_instructor,
        )
        Enrollment.objects.create(cohort=self.cohort, student=self.student)

    def create_session(self, **overrides):
        values = {
            "cohort": self.cohort,
            "title": "Foundations session",
            "description": "A class meeting.",
            "date": timezone.localdate(),
            "start_time": time(18, 0),
            "end_time": time(19, 30),
            "status": Session.Status.SCHEDULED,
            "created_by": self.instructor,
        }
        values.update(overrides)
        return Session.objects.create(**values)

    def test_assigned_instructor_can_create_and_edit_cohort_session(self):
        self.client.force_login(self.instructor)
        create_response = self.client.post(
            f"/api/cohorts/{self.cohort.pk}/sessions/",
            {
                "title": "Foundations session",
                "description": "A class meeting.",
                "date": timezone.localdate().isoformat(),
                "start_time": "18:00",
                "end_time": "19:30",
            },
            format="json",
        )
        session_id = create_response.json()["id"]
        update_response = self.client.patch(
            f"/api/cohorts/{self.cohort.pk}/sessions/{session_id}/",
            {"status": Session.Status.COMPLETED},
            format="json",
        )

        self.assertEqual(create_response.status_code, 201)
        self.assertEqual(create_response.json()["timezone"], "Africa/Accra")
        self.assertEqual(update_response.status_code, 200)
        self.assertEqual(update_response.json()["status"], Session.Status.COMPLETED)

    def test_instructor_cannot_access_an_unassigned_cohort_sessions(self):
        self.client.force_login(self.instructor)

        response = self.client.get(f"/api/cohorts/{self.other_cohort.pk}/sessions/")

        self.assertEqual(response.status_code, 404)

    def test_admin_can_manage_sessions_within_its_branch(self):
        self.client.force_login(self.branch_admin)

        response = self.client.post(
            f"/api/cohorts/{self.cohort.pk}/sessions/",
            {
                "title": "Admin-created session",
                "date": timezone.localdate().isoformat(),
                "start_time": "17:00",
                "end_time": "18:00",
            },
            format="json",
        )

        self.assertEqual(response.status_code, 201)

    def test_invalid_time_order_is_rejected(self):
        self.client.force_login(self.instructor)

        response = self.client.post(
            f"/api/cohorts/{self.cohort.pk}/sessions/",
            {
                "title": "Invalid schedule",
                "date": timezone.localdate().isoformat(),
                "start_time": "19:30",
                "end_time": "18:00",
            },
            format="json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn("end_time", response.json())

    def test_attendance_is_unique_and_can_be_updated(self):
        session = self.create_session(status=Session.Status.COMPLETED)
        self.client.force_login(self.instructor)
        path = f"/api/cohorts/{self.cohort.pk}/sessions/{session.pk}/attendance/"

        first_response = self.client.post(
            path,
            {"student": self.student.pk, "status": Attendance.Status.PRESENT},
            format="json",
        )
        duplicate_response = self.client.post(
            path,
            {"student": self.student.pk, "status": Attendance.Status.ABSENT},
            format="json",
        )
        update_response = self.client.patch(
            f"{path}{self.student.pk}/",
            {"status": Attendance.Status.LATE, "note": "Arrived after class began."},
            format="json",
        )

        self.assertEqual(first_response.status_code, 201)
        self.assertEqual(duplicate_response.status_code, 400)
        self.assertEqual(update_response.status_code, 200)
        self.assertEqual(update_response.json()["status"], Attendance.Status.LATE)
        self.assertEqual(Attendance.objects.filter(session=session, student=self.student).count(), 1)

    def test_attendance_rejects_non_enrolled_students(self):
        session = self.create_session()
        self.client.force_login(self.instructor)

        response = self.client.post(
            f"/api/cohorts/{self.cohort.pk}/sessions/{session.pk}/attendance/",
            {"student": self.other_student.pk, "status": Attendance.Status.PRESENT},
            format="json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertFalse(Attendance.objects.filter(session=session).exists())

    def test_cancelled_session_locks_attendance(self):
        session = self.create_session(status=Session.Status.CANCELLED)
        self.client.force_login(self.instructor)

        response = self.client.post(
            f"/api/cohorts/{self.cohort.pk}/sessions/{session.pk}/attendance/",
            {"student": self.student.pk, "status": Attendance.Status.PRESENT},
            format="json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertFalse(Attendance.objects.filter(session=session).exists())

    def test_cancelled_session_cannot_be_reopened(self):
        session = self.create_session(status=Session.Status.CANCELLED)
        self.client.force_login(self.instructor)

        response = self.client.patch(
            f"/api/cohorts/{self.cohort.pk}/sessions/{session.pk}/",
            {"status": Session.Status.SCHEDULED},
            format="json",
        )

        self.assertEqual(response.status_code, 400)
        session.refresh_from_db()
        self.assertEqual(session.status, Session.Status.CANCELLED)

    def test_attendance_report_counts_present_and_late_excludes_excused_and_future_sessions(self):
        today = timezone.localdate()
        sessions = [
            self.create_session(title=f"Completed {index}", date=today + timedelta(days=index), status=Session.Status.COMPLETED)
            for index in range(4)
        ]
        scheduled = self.create_session(
            title="Future session",
            date=today + timedelta(days=5),
            status=Session.Status.SCHEDULED,
        )
        for session, status in zip(
            sessions,
            (
                Attendance.Status.PRESENT,
                Attendance.Status.LATE,
                Attendance.Status.EXCUSED,
                Attendance.Status.ABSENT,
            ),
        ):
            Attendance.objects.create(session=session, student=self.student, status=status)
        self.client.force_login(self.instructor)

        response = self.client.get(f"/api/cohorts/{self.cohort.pk}/attendance-report/")
        report = response.json()
        student_report = report["students"][0]
        future_report = next(item for item in report["sessions"] if item["id"] == scheduled.pk)

        self.assertEqual(response.status_code, 200)
        self.assertEqual(report["completed_session_count"], 4)
        self.assertEqual(student_report["attended_sessions"], 2)
        self.assertEqual(student_report["excused_sessions"], 1)
        self.assertEqual(student_report["attendance_percentage"], 66.7)
        self.assertEqual(future_report["status"], Session.Status.SCHEDULED)