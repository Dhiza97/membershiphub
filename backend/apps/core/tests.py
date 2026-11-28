from datetime import date, time, timedelta
from decimal import Decimal
from typing import cast

from django.core.exceptions import ValidationError as DjangoValidationError
from django.core.files.uploadedfile import SimpleUploadedFile
from django.db import IntegrityError, transaction
from django.test import Client, TestCase
from django.utils import timezone
from rest_framework.test import APITestCase

from apps.accounts.models import User

from .models import (
    Certificate,
    Assessment,
    AssessmentAttempt,
    AssessmentAnswer,
    AssessmentQuestion,
    Question,
    QuestionBank,
    QuestionOption,
    Branch,
    Cohort,
    Curriculum,
    CurriculumTopic,
    CurriculumVersion,
    Enrollment,
    Session,
    Attendance,
    GraduationRequirements,
)


class AssessmentAPITests(APITestCase):
    def setUp(self):
        self.branch = Branch.objects.create(name="Assessment branch")
        self.instructor = User.objects.create_user(username="assessment-instructor", application_role=User.ApplicationRole.INSTRUCTOR, branch=self.branch)
        self.student = User.objects.create_user(username="assessment-student", application_role=User.ApplicationRole.STUDENT, branch=self.branch)
        self.cohort = Cohort.objects.create(branch=self.branch, name="Assessment cohort", instructor=self.instructor)
        Enrollment.objects.create(cohort=self.cohort, student=self.student)

    def test_instructor_can_only_read_assigned_cohorts(self):
        other = Cohort.objects.create(branch=self.branch, name="Other cohort")
        self.client.force_login(self.instructor)
        response = self.client.get("/api/cohorts/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual([item["id"] for item in response.json()], [self.cohort.pk])
        self.assertEqual(self.client.get(f"/api/cohorts/{other.pk}/").status_code, 404)
        self.assertEqual(self.client.patch(f"/api/cohorts/{self.cohort.pk}/", {"name": "Changed"}).status_code, 403)
        self.assertEqual(self.client.post("/api/cohorts/", {"name": "Created"}).status_code, 403)

    def test_session_login_and_mutation_with_csrf_cookie(self):
        self.instructor.set_password("test-password-123")
        self.instructor.save()
        client = Client(enforce_csrf_checks=True)
        response = client.get("/api/health/")
        self.assertEqual(response.status_code, 200)
        token = response.cookies["csrftoken"].value
        response = client.post("/api/accounts/login/", {"username": self.instructor.username, "password": "test-password-123"}, HTTP_X_CSRFTOKEN=token)
        self.assertEqual(response.status_code, 200)
        token = client.cookies["csrftoken"].value
        self.assertEqual(client.post("/api/accounts/logout/", HTTP_X_CSRFTOKEN=token).status_code, 204)

    def test_logout_accepts_matching_browser_origin_and_rejects_other_origins(self):
        client = Client(enforce_csrf_checks=True, HTTP_HOST="testserver:5173")
        client.force_login(self.instructor)
        token = client.get("/api/health/").cookies["csrftoken"].value
        rejected = client.post("/api/accounts/logout/", HTTP_X_CSRFTOKEN=token, HTTP_ORIGIN="http://other.example")
        self.assertEqual(rejected.status_code, 403)
        self.assertTrue(client.get("/api/accounts/me/").json()["id"] == self.instructor.pk)
        accepted = client.post("/api/accounts/logout/", HTTP_X_CSRFTOKEN=token, HTTP_ORIGIN="http://testserver:5173")
        self.assertEqual(accepted.status_code, 204)
        self.assertIn(client.get("/api/accounts/me/").status_code, (401, 403))

    def published_assessment(self, timing_mode=Assessment.TimingMode.WHOLE, count=1):
        bank = QuestionBank.objects.create(branch=self.branch)
        assessment = Assessment.objects.create(
            branch=self.branch, cohort=self.cohort, title="Test assessment", timing_mode=timing_mode,
            duration_seconds=300 if timing_mode == Assessment.TimingMode.WHOLE else None,
        )
        for position in range(count):
            question = Question.objects.create(bank=bank, prompt=f"Question {position}")
            correct = QuestionOption.objects.create(question=question, text="Correct", position=0, is_correct=True)
            other = QuestionOption.objects.create(question=question, text="Other", position=1)
            AssessmentQuestion.objects.create(
                assessment=assessment, question=question, position=position, time_limit_seconds=10,
                prompt_snapshot=question.prompt, question_type_snapshot=question.question_type,
                options_snapshot=[{"id": correct.pk, "text": correct.text}, {"id": other.pk, "text": other.text}],
                correct_option_ids_snapshot=[correct.pk],
            )
        assessment.status = Assessment.Status.PUBLISHED
        assessment.save()
        return assessment

    def test_per_question_timeout_does_not_apply_late_answer_to_next_question(self):
        assessment = self.published_assessment(Assessment.TimingMode.PER_QUESTION, count=2)
        self.client.force_login(self.student)
        response = self.client.post(f"/api/student/assessments/{assessment.pk}/attempts/")
        attempt = AssessmentAttempt.objects.get(pk=response.json()["id"])
        attempt.current_question_deadline_at = timezone.now() - timedelta(seconds=1)
        attempt.save(update_fields=("current_question_deadline_at",))
        option_id = response.json()["question"]["options"][0]["id"]
        response = self.client.post(f"/api/student/attempts/{attempt.pk}/", {"selected_option_ids": [option_id]}, format="json")
        self.assertEqual(response.status_code, 200, response.json())
        self.assertEqual(response.json()["current_question_position"], 1)
        self.assertFalse(AssessmentAnswer.objects.filter(attempt=attempt).exists())
        attempt.refresh_from_db()
        attempt.current_question_deadline_at = timezone.now() - timedelta(seconds=30)
        attempt.save(update_fields=("current_question_deadline_at",))
        response = self.client.get(f"/api/student/attempts/{attempt.pk}/")
        self.assertEqual(response.json()["status"], AssessmentAttempt.Status.TIMED_OUT)
        self.assertEqual(AssessmentAnswer.objects.filter(attempt=attempt).count(), 2)

    def test_enrollment_attempt_limit_and_release_lock(self):
        assessment = self.published_assessment()
        outsider = User.objects.create_user(username="outsider", application_role=User.ApplicationRole.STUDENT, branch=self.branch)
        self.client.force_login(outsider)
        self.assertEqual(self.client.post(f"/api/student/assessments/{assessment.pk}/attempts/").status_code, 400)
        self.client.force_login(self.student)
        started = self.client.post(f"/api/student/assessments/{assessment.pk}/attempts/").json()
        self.client.force_login(self.instructor)
        self.assertEqual(self.client.post(f"/api/assessments/{assessment.pk}/release-results/").status_code, 400)
        self.assertEqual(self.client.get(f"/api/student/attempts/{started['id']}/").status_code, 404)
        self.client.force_login(self.student)
        self.client.post(f"/api/student/attempts/{started['id']}/", {"action": "submit"}, format="json")
        self.assertEqual(self.client.post(f"/api/student/assessments/{assessment.pk}/attempts/").status_code, 400)
        self.client.force_login(self.instructor)
        self.assertEqual(self.client.post(f"/api/assessments/{assessment.pk}/release-results/").status_code, 200)
        self.client.force_login(self.student)
        self.assertEqual(self.client.post(f"/api/student/assessments/{assessment.pk}/attempts/").status_code, 400)

    def test_published_snapshot_is_unchanged_when_question_bank_is_edited(self):
        assessment = self.published_assessment()
        item = AssessmentQuestion.objects.get(assessment=assessment)
        self.client.force_login(self.instructor)
        response = self.client.patch(f"/api/question-bank/questions/{item.question.pk}/", {"prompt": "Changed prompt"}, format="json")
        self.assertEqual(response.status_code, 200, response.json())
        response = self.client.patch(f"/api/assessments/{assessment.pk}/", {"title": "Changed"}, format="json")
        self.assertEqual(response.status_code, 400)
        self.client.force_login(self.student)
        response = self.client.post(f"/api/student/assessments/{assessment.pk}/attempts/")
        self.assertEqual(response.json()["question"]["prompt"], "Question 0")

    def test_isolation_and_new_draft_version(self):
        assessment = self.published_assessment()
        other_branch = Branch.objects.create(name="Other branch")
        other_admin = User.objects.create_user(username="other-admin", application_role=User.ApplicationRole.BRANCH_ADMIN, branch=other_branch)
        other_instructor = User.objects.create_user(username="other-teacher", application_role=User.ApplicationRole.INSTRUCTOR, branch=self.branch)
        self.client.force_login(other_admin)
        self.assertEqual(self.client.get(f"/api/assessments/{assessment.pk}/").status_code, 404)
        self.assertEqual(self.client.get(f"/api/question-bank/questions/{AssessmentQuestion.objects.get(assessment=assessment).question.pk}/").status_code, 404)
        self.client.force_login(other_instructor)
        self.assertEqual(self.client.get(f"/api/assessments/{assessment.pk}/").status_code, 404)
        self.client.force_login(self.instructor)
        response = self.client.post(f"/api/assessments/{assessment.pk}/new-version/")
        self.assertEqual(response.status_code, 201, response.json())
        self.assertEqual(response.json()["status"], Assessment.Status.DRAFT)
        self.assertEqual(len(response.json()["question_details"]), 1)
        self.assertNotEqual(response.json()["id"], assessment.pk)

    def test_deadline_and_author_review_score(self):
        assessment = self.published_assessment()
        self.client.force_login(self.student)
        response = self.client.post(f"/api/student/assessments/{assessment.pk}/attempts/")
        attempt = response.json()
        self.client.post(f"/api/student/attempts/{attempt['id']}/", {
            "selected_option_ids": [attempt["question"]["options"][0]["id"]],
        }, format="json")
        self.client.force_login(self.instructor)
        review = self.client.get(f"/api/assessments/{assessment.pk}/attempts/")
        self.assertEqual(review.json()[0]["score"], 1)
        self.assertEqual(review.json()[0]["answers"][0]["is_correct"], True)
        Assessment.objects.filter(pk=assessment.pk).update(deadline_at=timezone.now() - timedelta(seconds=1), attempt_limit=2)
        self.client.force_login(self.student)
        self.assertEqual(self.client.post(f"/api/student/assessments/{assessment.pk}/attempts/").status_code, 400)

    def test_answer_cannot_reference_another_assessments_question(self):
        assessment = self.published_assessment()
        question = AssessmentQuestion.objects.get(assessment=assessment)
        other = Assessment.objects.create(branch=self.branch, cohort=self.cohort, title="Other", duration_seconds=60)
        other_question = AssessmentQuestion.objects.create(assessment=other, question=question.question)
        attempt = AssessmentAttempt.objects.create(assessment=assessment, student=self.student, attempt_number=1)
        with self.assertRaises(DjangoValidationError):
            AssessmentAnswer.objects.create(attempt=attempt, assessment_question=other_question)

    def test_author_publish_attempt_and_release(self):
        self.client.force_login(self.instructor)
        question_response = self.client.post("/api/question-bank/questions/", {
            "prompt": "Select both correct answers",
            "question_type": "MULTIPLE",
            "options": [
                {"text": "First", "is_correct": True},
                {"text": "Second", "is_correct": True},
                {"text": "Third", "is_correct": False},
            ],
        }, format="json")
        self.assertEqual(question_response.status_code, 201, question_response.json())
        question = question_response.json()
        response = self.client.post("/api/assessments/", {
            "title": "Quiz", "cohort": self.cohort.pk, "duration_seconds": 300,
            "questions": [{"question": question["id"]}],
        }, format="json")
        self.assertEqual(response.status_code, 201, response.json())
        assessment_id = response.json()["id"]
        response = self.client.post(f"/api/assessments/{assessment_id}/publish/")
        self.assertEqual(response.status_code, 200, response.json())

        self.client.force_login(self.student)
        response = self.client.post(f"/api/student/assessments/{assessment_id}/attempts/")
        self.assertEqual(response.status_code, 201, response.json())
        attempt = response.json()
        self.assertNotIn("correct_option_ids", attempt["question"])
        response = self.client.post(f"/api/student/attempts/{attempt['id']}/", {
            "selected_option_ids": [question["options"][0]["id"]],
        }, format="json")
        self.assertEqual(response.status_code, 200, response.json())
        self.assertIsNone(response.json()["score"])
        self.assertIsNone(response.json()["answers"][0]["correct_option_ids"])
        self.assertEqual(AssessmentAttempt.objects.get(pk=attempt["id"]).score, 0)

        self.client.force_login(self.instructor)
        response = self.client.post(f"/api/assessments/{assessment_id}/release-results/")
        self.assertEqual(response.status_code, 200, response.json())
        self.client.force_login(self.student)
        response = self.client.get(f"/api/student/attempts/{attempt['id']}/")
        self.assertEqual(response.json()["score"], "0.00")
        self.assertEqual(Assessment.objects.get(pk=assessment_id).status, Assessment.Status.PUBLISHED)


class CertificateAPITests(APITestCase):
    def setUp(self):
        self.branch = Branch.objects.create(name="Certificate branch")
        self.admin = User.objects.create_user(
            username="certificate-admin",
            application_role=User.ApplicationRole.BRANCH_ADMIN,
            branch=self.branch,
        )
        self.student = User.objects.create_user(
            username="certificate-student",
            first_name="Amina",
            last_name="Mensah",
            application_role=User.ApplicationRole.STUDENT,
            branch=self.branch,
        )
        self.instructor = User.objects.create_user(
            username="certificate-instructor",
            application_role=User.ApplicationRole.INSTRUCTOR,
            branch=self.branch,
        )
        self.cohort = Cohort.objects.create(
            branch=self.branch,
            name="Certificate cohort",
            instructor=self.instructor,
        )
        Enrollment.objects.create(cohort=self.cohort, student=self.student)
        session = Session.objects.create(
            cohort=self.cohort,
            title="Completed class",
            date=timezone.localdate(),
            start_time=time(10),
            end_time=time(11),
            status=Session.Status.COMPLETED,
        )
        Attendance.objects.create(
            session=session,
            student=self.student,
            status=Attendance.Status.PRESENT,
        )

        bank = QuestionBank.objects.create(branch=self.branch)
        question = Question.objects.create(bank=bank, prompt="Certificate result question")
        self.assessment = Assessment.objects.create(
            branch=self.branch,
            cohort=self.cohort,
            title="Required quiz",
            duration_seconds=300,
        )
        AssessmentQuestion.objects.create(assessment=self.assessment, question=question)
        self.assessment.status = Assessment.Status.PUBLISHED
        self.assessment.save()
        AssessmentAttempt.objects.create(
            assessment=self.assessment,
            student=self.student,
            attempt_number=1,
            status=AssessmentAttempt.Status.SUBMITTED,
            score=90,
            max_score=100,
        )
        requirements = GraduationRequirements.objects.create(
            cohort=self.cohort,
            minimum_attendance=80,
            minimum_assessment_score=70,
        )
        requirements.required_assessments.add(self.assessment)
        self.client.force_login(self.admin)

    def certificate_path(self):
        return f"/api/cohorts/{self.cohort.pk}/certificates/"

    def upload(self, student_id=None, content=b"%PDF-1.4\n%%EOF\n"):
        return self.client.post(self.certificate_path(), {
            "student": student_id or self.student.pk,
            "file": SimpleUploadedFile("certificate.pdf", content, content_type="application/pdf"),
        }, format="multipart")

    def test_instructor_can_upload_for_enrolled_student_without_requirements(self):
        GraduationRequirements.objects.filter(cohort=self.cohort).delete()
        self.client.force_login(self.instructor)
        response = self.upload()
        self.assertEqual(response.status_code, 201, response.json())
        certificate = Certificate.objects.get(cohort=self.cohort, student=self.student)
        self.assertEqual(certificate.student_name, "Amina Mensah")
        self.assertTrue(response.json()["has_uploaded_pdf"])
        self.assertIsNone(response.json()["verification_url"])
        self.assertEqual(self.client.get(self.certificate_path()).status_code, 200)
        self.assertEqual(self.upload().status_code, 400)
        with self.assertRaises(DjangoValidationError):
            certificate.delete()

    def test_uploaded_pdf_download_is_scoped(self):
        response = self.upload()
        self.assertEqual(response.status_code, 201, response.json())
        certificate = Certificate.objects.get(pk=response.json()["id"])
        self.client.force_login(self.student)
        self.assertEqual(len(self.client.get("/api/student/certificates/").json()), 1)
        download = self.client.get(f"/api/certificates/{certificate.pk}/download/")
        self.assertEqual(download.status_code, 200)
        self.assertEqual(download["Content-Type"], "application/pdf")
        self.assertEqual(b"".join(getattr(download, "streaming_content")), b"%PDF-1.4\n%%EOF\n")
        self.client.force_login(self.instructor)
        self.assertEqual(self.client.get(f"/api/certificates/{certificate.pk}/download/").status_code, 200)
        outsider = User.objects.create_user(username="certificate-outsider", application_role=User.ApplicationRole.STUDENT, branch=self.branch)
        self.client.force_login(outsider)
        self.assertEqual(self.client.get(f"/api/certificates/{certificate.pk}/download/").status_code, 403)
        self.client.logout()
        self.assertEqual(self.client.get(f"/api/certificates/verify/{certificate.verification_code}/").status_code, 404)

    def test_upload_rejects_invalid_file_unenrolled_student_and_other_roles(self):
        self.assertEqual(self.upload(content=b"not a PDF").status_code, 400)
        self.assertEqual(self.upload(content=b"%PDF-" + b"x" * (10 * 1024 * 1024)).status_code, 400)
        outsider = User.objects.create_user(username="unenrolled", application_role=User.ApplicationRole.STUDENT, branch=self.branch)
        self.assertEqual(self.upload(student_id=outsider.pk).status_code, 400)
        self.client.force_login(self.student)
        self.assertEqual(self.upload().status_code, 403)
        other_instructor = User.objects.create_user(username="other-instructor", application_role=User.ApplicationRole.INSTRUCTOR, branch=self.branch)
        self.client.force_login(other_instructor)
        self.assertEqual(self.upload().status_code, 404)

    def test_legacy_generated_certificates_remain_downloadable_and_verifiable(self):
        certificate = Certificate.objects.create(
            cohort=self.cohort, student=self.student, student_name="Amina Mensah", cohort_name=self.cohort.name,
            branch_name=self.branch.name, attendance_percentage=90, assessment_average=90,
            minimum_attendance=80, minimum_assessment_score=70, issued_by=self.admin,
        )
        self.client.force_login(self.student)
        response = self.client.get(f"/api/certificates/{certificate.pk}/download/")
        self.assertEqual(response.status_code, 200)
        self.assertTrue(b"".join(getattr(response, "streaming_content")).startswith(b"%PDF-"))
        self.client.logout()
        self.assertEqual(self.client.get(f"/api/certificates/verify/{certificate.verification_code}/").status_code, 200)


class GraduationResultsAPITests(APITestCase):
    def setUp(self):
        self.branch = Branch.objects.create(name="Results branch")
        self.admin = User.objects.create_user(username="results-admin", application_role=User.ApplicationRole.BRANCH_ADMIN, branch=self.branch)
        self.instructor = User.objects.create_user(username="results-instructor", application_role=User.ApplicationRole.INSTRUCTOR, branch=self.branch)
        self.student = User.objects.create_user(username="results-student", application_role=User.ApplicationRole.STUDENT, branch=self.branch)
        self.cohort = Cohort.objects.create(branch=self.branch, name="Results cohort", instructor=self.instructor)
        Enrollment.objects.create(cohort=self.cohort, student=self.student)
        bank = QuestionBank.objects.create(branch=self.branch)
        question = Question.objects.create(bank=bank, prompt="Results question")
        self.assessment = Assessment.objects.create(branch=self.branch, cohort=self.cohort, title="Test assessment", duration_seconds=300)
        AssessmentQuestion.objects.create(assessment=self.assessment, question=question)
        self.assessment.status = Assessment.Status.PUBLISHED
        self.assessment.save()
        self.session = Session.objects.create(
            cohort=self.cohort, title="Class", date=timezone.localdate(),
            start_time=time(10), end_time=time(11), status=Session.Status.COMPLETED,
        )
        Attendance.objects.create(session=self.session, student=self.student, status=Attendance.Status.PRESENT)
        self.client.force_login(self.admin)

    def configure(self):
        return self.client.put(f"/api/cohorts/{self.cohort.pk}/graduation-requirements/", {
            "minimum_attendance": "80.00", "minimum_assessment_score": "70.00",
            "required_assessments": [self.assessment.pk],
        }, format="json")

    def test_latest_score_and_finalized_history(self):
        self.assertEqual(self.configure().status_code, 200)
        AssessmentAttempt.objects.create(assessment=self.assessment, student=self.student, attempt_number=1,
                                         status=AssessmentAttempt.Status.SUBMITTED, score=90, max_score=100)
        latest = AssessmentAttempt.objects.create(assessment=self.assessment, student=self.student, attempt_number=2,
                                                  status=AssessmentAttempt.Status.SUBMITTED, score=60, max_score=100)
        report_path = f"/api/cohorts/{self.cohort.pk}/results/"
        response = self.client.get(report_path)
        self.assertEqual(response.status_code, 200, response.json())
        row = response.json()["students"][0]
        self.assertEqual(row["assessment_average"], 60.0)
        self.assertEqual(row["attendance_percentage"], 100.0)
        self.assertEqual(row["eligibility"], "INELIGIBLE")
        frozen = self.client.post(f"{report_path}finalize/")
        self.assertEqual(frozen.status_code, 201, frozen.json())
        latest.score = Decimal("95")
        latest.save()
        self.assertEqual(self.client.get(report_path).json()["students"][0]["eligibility"], "ELIGIBLE")
        history = self.client.get(f"{report_path}history/")
        self.assertEqual(history.json()[0]["report"]["students"][0]["assessment_average"], 60.0)
        self.assertEqual(self.client.post(f"{report_path}finalize/").status_code, 201)
        self.assertEqual(len(self.client.get(f"{report_path}history/").json()), 2)

    def test_missing_data_and_authorization(self):
        self.assertEqual(self.configure().status_code, 200)
        path = f"/api/cohorts/{self.cohort.pk}/results/"
        self.assertEqual(self.client.get(path).json()["students"][0]["eligibility"], "INCOMPLETE")
        self.client.force_login(self.instructor)
        self.assertEqual(self.client.get(path).status_code, 200)
        self.assertEqual(self.configure().status_code, 403)
        self.assertEqual(self.client.post(f"{path}finalize/").status_code, 403)
        other_branch = Branch.objects.create(name="Other results branch")
        other_admin = User.objects.create_user(username="other-results-admin", application_role=User.ApplicationRole.BRANCH_ADMIN, branch=other_branch)
        self.client.force_login(other_admin)
        self.assertEqual(self.client.get(path).status_code, 404)
        self.client.force_login(self.student)
        self.assertEqual(self.client.get(path).status_code, 403)

    def test_requirements_reject_other_cohort_assessments_and_invalid_thresholds(self):
        other = Cohort.objects.create(branch=self.branch, name="Other cohort")
        other_assessment = Assessment.objects.create(branch=self.branch, cohort=other, title="Other", duration_seconds=60)
        response = self.client.put(f"/api/cohorts/{self.cohort.pk}/graduation-requirements/", {
            "minimum_attendance": 101, "minimum_assessment_score": 70, "required_assessments": [other_assessment.pk],
        }, format="json")
        self.assertEqual(response.status_code, 400)
        response = self.client.put(f"/api/cohorts/{self.cohort.pk}/graduation-requirements/", {
            "minimum_attendance": 80, "minimum_assessment_score": 70, "required_assessments": [other_assessment.pk],
        }, format="json")
        self.assertEqual(response.status_code, 400)

    def test_student_summary_excludes_excused_and_requires_attendance(self):
        self.assertEqual(self.configure().status_code, 200)
        AssessmentAttempt.objects.create(assessment=self.assessment, student=self.student, attempt_number=1,
                                         status=AssessmentAttempt.Status.SUBMITTED, score=75, max_score=100)
        excused = Session.objects.create(
            cohort=self.cohort, title="Excused", date=timezone.localdate(),
            start_time=time(12), end_time=time(13), status=Session.Status.COMPLETED,
        )
        Attendance.objects.create(session=excused, student=self.student, status=Attendance.Status.EXCUSED)
        path = f"/api/cohorts/{self.cohort.pk}/results/students/{self.student.pk}/"
        response = self.client.get(path)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["student"]["attendance_percentage"], 100.0)
        self.assertEqual(response.json()["student"]["eligibility"], "ELIGIBLE")
        Attendance.objects.filter(session=self.session).update(status=Attendance.Status.EXCUSED)
        response = self.client.get(path)
        self.assertIsNone(response.json()["student"]["attendance_percentage"])
        self.assertEqual(response.json()["student"]["eligibility"], "INCOMPLETE")

    def test_equal_assessment_weight_and_published_assessment_scope(self):
        other = Cohort.objects.create(branch=self.branch, name="Another cohort")
        question = AssessmentQuestion.objects.get(assessment=self.assessment).question
        other_assessment = Assessment.objects.create(branch=self.branch, cohort=other, title="Other published", duration_seconds=60)
        AssessmentQuestion.objects.create(assessment=other_assessment, question=question)
        other_assessment.status = Assessment.Status.PUBLISHED
        other_assessment.save()
        path = f"/api/cohorts/{self.cohort.pk}/graduation-requirements/"
        response = self.client.put(path, {
            "minimum_attendance": 100, "minimum_assessment_score": 75, "required_assessments": [other_assessment.pk],
        }, format="json")
        self.assertEqual(response.status_code, 400)
        second = Assessment.objects.create(branch=self.branch, cohort=self.cohort, title="Second", duration_seconds=60)
        AssessmentQuestion.objects.create(assessment=second, question=question)
        second.status = Assessment.Status.PUBLISHED
        second.save()
        response = self.client.put(path, {
            "minimum_attendance": 100, "minimum_assessment_score": 75, "required_assessments": [self.assessment.pk, second.pk],
        }, format="json")
        self.assertEqual(response.status_code, 200, response.json())
        AssessmentAttempt.objects.create(assessment=self.assessment, student=self.student, attempt_number=1,
                                         status=AssessmentAttempt.Status.SUBMITTED, score=1, max_score=2)
        AssessmentAttempt.objects.create(assessment=second, student=self.student, attempt_number=1,
                                         status=AssessmentAttempt.Status.TIMED_OUT, score=10, max_score=10)
        row = self.client.get(f"/api/cohorts/{self.cohort.pk}/results/").json()["students"][0]
        self.assertEqual(row["assessment_average"], 75.0)
        self.assertEqual(row["eligibility"], "ELIGIBLE")

    def test_curriculum_change_invalidates_topic_requirement(self):
        curriculum = Curriculum.objects.create(branch=self.branch, name="Results curriculum")
        version = CurriculumVersion.objects.create(curriculum=curriculum, version_number=1)
        topic = CurriculumTopic.objects.create(version=version, title="Topic")
        version.status = CurriculumVersion.Status.PUBLISHED
        version.save()
        self.cohort.curriculum_version = version
        self.cohort.save()
        question = AssessmentQuestion.objects.get(assessment=self.assessment).question
        topic_assessment = Assessment.objects.create(branch=self.branch, curriculum_topic=topic, title="Topic quiz", duration_seconds=60)
        AssessmentQuestion.objects.create(assessment=topic_assessment, question=question)
        topic_assessment.status = Assessment.Status.PUBLISHED
        topic_assessment.save()
        response = self.client.put(f"/api/cohorts/{self.cohort.pk}/graduation-requirements/", {
            "minimum_attendance": 80, "minimum_assessment_score": 70, "required_assessments": [topic_assessment.pk],
        }, format="json")
        self.assertEqual(response.status_code, 200, response.json())
        AssessmentAttempt.objects.create(assessment=topic_assessment, student=self.student, attempt_number=1,
                                         status=AssessmentAttempt.Status.SUBMITTED, score=100, max_score=100)
        self.cohort.curriculum_version = None
        self.cohort.save()
        row = self.client.get(f"/api/cohorts/{self.cohort.pk}/results/").json()["students"][0]
        self.assertEqual(row["eligibility"], "INCOMPLETE")
        self.assertIsNone(row["assessments"][0]["score_percentage"])


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