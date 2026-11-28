from typing import cast
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError
from decimal import Decimal
from uuid import uuid4

from django.core.exceptions import ValidationError
from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models, transaction
from django.db.models.functions import Lower
from django.utils import timezone

from apps.accounts.models import User


class Branch(models.Model):
    name = models.CharField(max_length=150, unique=True)
    timezone = models.CharField(max_length=64, default="Africa/Accra")
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("name",)
        verbose_name = "branch"
        verbose_name_plural = "branches"

    def __str__(self):
        return self.name

    def clean(self):
        super().clean()
        try:
            ZoneInfo(self.timezone)
        except ZoneInfoNotFoundError as error:
            raise ValidationError({"timezone": "Enter a valid IANA timezone."}) from error


class Curriculum(models.Model):
    branch = models.ForeignKey(
        Branch,
        on_delete=models.PROTECT,
        related_name="curricula",
    )
    name = models.CharField(max_length=180)
    description = models.TextField(blank=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("name",)
        constraints = [
            models.UniqueConstraint(
                Lower("name"),
                "branch",
                name="unique_curriculum_name_per_branch_ci",
            ),
        ]

    def __str__(self):
        return self.name

    def save(self, *args, **kwargs):
        self.full_clean()
        super().save(*args, **kwargs)


class CurriculumVersion(models.Model):
    class Status(models.TextChoices):
        DRAFT = "DRAFT", "Draft"
        PUBLISHED = "PUBLISHED", "Published"
        ARCHIVED = "ARCHIVED", "Archived"

    curriculum = models.ForeignKey(
        Curriculum,
        on_delete=models.PROTECT,
        related_name="versions",
    )
    version_number = models.PositiveIntegerField()
    status = models.CharField(
        max_length=12,
        choices=Status.choices,
        default=Status.DRAFT,
    )
    change_note = models.CharField(max_length=240, blank=True)
    created_by = models.ForeignKey(
        "accounts.User",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="created_curriculum_versions",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    published_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ("-version_number",)
        constraints = [
            models.UniqueConstraint(
                fields=("curriculum", "version_number"),
                name="unique_curriculum_version_number",
            ),
            models.UniqueConstraint(
                fields=("curriculum",),
                condition=models.Q(status="DRAFT"),
                name="one_draft_version_per_curriculum",
            ),
        ]

    def __str__(self):
        return f"{self.curriculum.name} v{self.version_number}"

    def clean(self):
        super().clean()
        if self.pk:
            existing = CurriculumVersion.objects.filter(pk=self.pk).first()
            if existing and existing.status != self.Status.DRAFT:
                status_only_archive = (
                    existing.status == self.Status.PUBLISHED
                    and self.status == self.Status.ARCHIVED
                    and getattr(existing, "curriculum_id", None) == getattr(self, "curriculum_id", None)
                    and existing.version_number == self.version_number
                    and existing.change_note == self.change_note
                    and getattr(existing, "created_by_id", None) == getattr(self, "created_by_id", None)
                )
                if not status_only_archive:
                    raise ValidationError("Published curriculum versions are immutable. Create a new draft version to edit.")

        if self.status == self.Status.PUBLISHED and (
            self.pk is None or not CurriculumTopic.objects.filter(version_id=self.pk).exists()
        ):
            raise ValidationError({"status": "A curriculum version needs at least one topic before publication."})

    def save(self, *args, **kwargs):
        if self.status == self.Status.PUBLISHED and self.published_at is None:
            self.published_at = timezone.now()
        self.full_clean()
        super().save(*args, **kwargs)

    def build_snapshot(self):
        return {
            "curriculum_id": getattr(self, "curriculum_id", None),
            "curriculum_name": self.curriculum.name,
            "version_id": self.pk,
            "version_number": self.version_number,
            "published_at": self.published_at.isoformat() if self.published_at else None,
            "topics": [
                {
                    "id": topic.pk,
                    "title": topic.title,
                    "description": topic.description,
                    "notes": topic.notes,
                    "position": topic.position,
                    "objectives": [
                        {"id": objective.pk, "text": objective.text, "position": objective.position}
                        for objective in CurriculumObjective.objects.filter(topic=topic)
                    ],
                    "lessons": [
                        {
                            "id": lesson.pk,
                            "title": lesson.title,
                            "description": lesson.description,
                            "notes": lesson.notes,
                            "position": lesson.position,
                            "materials": [
                                {
                                    "id": material.pk,
                                    "title": material.title,
                                    "url": material.url,
                                    "material_type": material.material_type,
                                    "description": material.description,
                                    "position": material.position,
                                }
                                for material in LearningMaterial.objects.filter(lesson=lesson)
                            ],
                        }
                        for lesson in CurriculumLesson.objects.filter(topic=topic)
                    ],
                }
                for topic in CurriculumTopic.objects.filter(version=self)
            ],
        }


def validate_draft_version(version):
    if version.status != CurriculumVersion.Status.DRAFT:
        raise ValidationError("Published curriculum versions are immutable. Create a new draft version to edit.")


class CurriculumTopic(models.Model):
    version = models.ForeignKey(
        CurriculumVersion,
        on_delete=models.CASCADE,
        related_name="topics",
    )
    title = models.CharField(max_length=180)
    description = models.TextField(blank=True)
    notes = models.TextField(blank=True)
    position = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ("position", "pk")
        constraints = [
            models.UniqueConstraint(fields=("version", "position"), name="unique_topic_position_per_version"),
        ]

    def clean(self):
        super().clean()
        version_id = getattr(self, "version_id", None)
        if version_id:
            validate_draft_version(self.version)

    def save(self, *args, **kwargs):
        self.full_clean()
        super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):
        validate_draft_version(self.version)
        return super().delete(*args, **kwargs)


class CurriculumObjective(models.Model):
    topic = models.ForeignKey(
        CurriculumTopic,
        on_delete=models.CASCADE,
        related_name="objectives",
    )
    text = models.CharField(max_length=500)
    position = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ("position", "pk")
        constraints = [
            models.UniqueConstraint(fields=("topic", "position"), name="unique_objective_position_per_topic"),
        ]

    def clean(self):
        super().clean()
        if getattr(self, "topic_id", None):
            validate_draft_version(self.topic.version)

    def save(self, *args, **kwargs):
        self.full_clean()
        super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):
        validate_draft_version(self.topic.version)
        return super().delete(*args, **kwargs)


class CurriculumLesson(models.Model):
    topic = models.ForeignKey(
        CurriculumTopic,
        on_delete=models.CASCADE,
        related_name="lessons",
    )
    title = models.CharField(max_length=180)
    description = models.TextField(blank=True)
    notes = models.TextField(blank=True)
    position = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ("position", "pk")
        constraints = [
            models.UniqueConstraint(fields=("topic", "position"), name="unique_lesson_position_per_topic"),
        ]

    def clean(self):
        super().clean()
        if getattr(self, "topic_id", None):
            validate_draft_version(self.topic.version)

    def save(self, *args, **kwargs):
        self.full_clean()
        super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):
        validate_draft_version(self.topic.version)
        return super().delete(*args, **kwargs)


class LearningMaterial(models.Model):
    class Type(models.TextChoices):
        ARTICLE = "ARTICLE", "Article"
        VIDEO = "VIDEO", "Video"
        DOCUMENT = "DOCUMENT", "Document"
        OTHER = "OTHER", "Other"

    lesson = models.ForeignKey(
        CurriculumLesson,
        on_delete=models.CASCADE,
        related_name="materials",
    )
    title = models.CharField(max_length=180)
    url = models.URLField(max_length=500)
    material_type = models.CharField(max_length=12, choices=Type.choices, default=Type.OTHER)
    description = models.CharField(max_length=500, blank=True)
    position = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ("position", "pk")
        constraints = [
            models.UniqueConstraint(fields=("lesson", "position"), name="unique_material_position_per_lesson"),
        ]

    def clean(self):
        super().clean()
        if getattr(self, "lesson_id", None):
            validate_draft_version(self.lesson.topic.version)

    def save(self, *args, **kwargs):
        self.full_clean()
        super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):
        validate_draft_version(self.lesson.topic.version)
        return super().delete(*args, **kwargs)

class Cohort(models.Model):
    class Status(models.TextChoices):
        DRAFT = "DRAFT", "Draft"
        READY = "READY", "Ready"
        ACTIVE = "ACTIVE", "Active"
        COMPLETED = "COMPLETED", "Completed"
        ARCHIVED = "ARCHIVED", "Archived"

    branch = models.ForeignKey(
        Branch,
        on_delete=models.PROTECT,
        related_name="cohorts",
    )
    name = models.CharField(max_length=150, blank=True)
    description = models.TextField(blank=True)
    start_date = models.DateField(null=True, blank=True)
    end_date = models.DateField(null=True, blank=True)
    status = models.CharField(
        max_length=12,
        choices=Status.choices,
        default=Status.DRAFT,
    )
    instructor = models.ForeignKey(
        "accounts.User",
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="instructed_cohorts",
    )
    curriculum_version = models.ForeignKey(
        CurriculumVersion,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="cohorts",
    )
    curriculum_snapshot = models.JSONField(null=True, blank=True)
    curriculum_snapshot_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("-start_date", "name")
        constraints = [
            models.UniqueConstraint(
                Lower("name"),
                "branch",
                condition=~models.Q(name=""),
                name="unique_cohort_name_per_branch_ci",
            ),
        ]

    def __str__(self):
        return self.name

    def clean(self):
        super().clean()
        errors = {}

        if self.start_date and self.end_date and self.end_date < self.start_date:
            errors["end_date"] = "The end date must be on or after the start date."

        instructor_id = getattr(self, "instructor_id", None)
        instructor = cast(User | None, getattr(self, "instructor", None))
        branch_id = getattr(self, "branch_id", None)
        if instructor_id and instructor is not None:
            if instructor.application_role != instructor.ApplicationRole.INSTRUCTOR:
                errors["instructor"] = "The assigned user must have the Instructor role."
            elif getattr(instructor, "branch_id", None) != branch_id:
                errors["instructor"] = "The Instructor must belong to the cohort's branch."
            elif not instructor.is_active:
                errors["instructor"] = "Inactive users cannot be assigned as instructors."

        curriculum_version_id = getattr(self, "curriculum_version_id", None)
        curriculum_version = cast(
            CurriculumVersion | None,
            getattr(self, "curriculum_version", None),
        )
        if curriculum_version_id and curriculum_version is not None:
            if getattr(curriculum_version.curriculum, "branch_id", None) != branch_id:
                errors["curriculum_version"] = "The curriculum must belong to the cohort's branch."
            elif curriculum_version.status != CurriculumVersion.Status.PUBLISHED:
                errors["curriculum_version"] = "Only published curriculum versions can be assigned to cohorts."

        if self.status == self.Status.READY:
            legacy_ready_without_curriculum = (
                self.pk is not None
                and Cohort.objects.filter(
                    pk=self.pk,
                    status=self.Status.READY,
                    curriculum_version__isnull=True,
                ).exists()
            )
            if not self.name.strip():
                errors["name"] = "A cohort name is required before a cohort can be Ready."
            if not self.description.strip():
                errors["description"] = "A description is required before a cohort can be Ready."
            if self.start_date is None:
                errors["start_date"] = "A start date is required before a cohort can be Ready."
            if self.end_date is None:
                errors["end_date"] = "An end date is required before a cohort can be Ready."
            if instructor_id is None:
                errors["instructor"] = "An Instructor must be assigned before a cohort can be Ready."
            if curriculum_version_id is None and not legacy_ready_without_curriculum:
                errors["curriculum_version"] = "A published curriculum must be assigned before a cohort can be Ready."
            if self.pk is None or not Enrollment.objects.filter(cohort_id=self.pk).exists():
                errors["students"] = "At least one student must be enrolled before a cohort can be Ready."

        if errors:
            raise ValidationError(errors)

    def save(self, *args, **kwargs):
        previous = None
        if self.pk:
            previous = Cohort.objects.filter(pk=self.pk).values(
                "curriculum_version_id",
                "curriculum_snapshot",
                "curriculum_snapshot_at",
            ).first()

        if previous and previous["curriculum_snapshot"] is not None:
            if getattr(self, "curriculum_version_id", None) != previous["curriculum_version_id"]:
                raise ValidationError({"curriculum_version": "A cohort's curriculum cannot change after its snapshot is created."})
            self.curriculum_snapshot = previous["curriculum_snapshot"]
            self.curriculum_snapshot_at = previous["curriculum_snapshot_at"]
        elif self.status == self.Status.READY and getattr(self, "curriculum_version_id", None):
            curriculum_version = cast(CurriculumVersion, self.curriculum_version)
            self.curriculum_snapshot = curriculum_version.build_snapshot()
            self.curriculum_snapshot_at = timezone.now()

        self.full_clean()
        super().save(*args, **kwargs)


class Enrollment(models.Model):
    cohort = models.ForeignKey(
        Cohort,
        on_delete=models.CASCADE,
        related_name="enrollments",
    )
    student = models.ForeignKey(
        "accounts.User",
        on_delete=models.PROTECT,
        related_name="cohort_enrollments",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ("created_at", "pk")
        constraints = [
            models.UniqueConstraint(
                fields=("cohort", "student"),
                name="unique_student_per_cohort",
            ),
        ]

    def clean(self):
        super().clean()
        cohort_id = getattr(self, "cohort_id", None)
        student_id = getattr(self, "student_id", None)
        cohort = cast(Cohort | None, getattr(self, "cohort", None))
        student = cast(User | None, getattr(self, "student", None))
        if cohort_id and student_id and cohort is not None and student is not None:
            if student.application_role != student.ApplicationRole.STUDENT:
                raise ValidationError({"student": "Only Students can be enrolled in a cohort."})
            if getattr(student, "branch_id", None) != getattr(cohort, "branch_id", None):
                raise ValidationError({"student": "Students can only enroll in cohorts in their branch."})

    def save(self, *args, **kwargs):
        self.full_clean()
        super().save(*args, **kwargs)


class Session(models.Model):
    class Status(models.TextChoices):
        SCHEDULED = "SCHEDULED", "Scheduled"
        COMPLETED = "COMPLETED", "Completed"
        CANCELLED = "CANCELLED", "Cancelled"

    cohort = models.ForeignKey(
        Cohort,
        on_delete=models.CASCADE,
        related_name="sessions",
    )
    title = models.CharField(max_length=180)
    description = models.TextField(blank=True)
    date = models.DateField()
    start_time = models.TimeField()
    end_time = models.TimeField()
    status = models.CharField(
        max_length=12,
        choices=Status.choices,
        default=Status.SCHEDULED,
    )
    created_by = models.ForeignKey(
        "accounts.User",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="created_sessions",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("date", "start_time", "pk")

    def __str__(self):
        return f"{self.title} ({self.date})"

    def clean(self):
        super().clean()
        errors = {}
        if (
            self.pk
            and self.status != self.Status.CANCELLED
            and Session.objects.filter(pk=self.pk, status=self.Status.CANCELLED).exists()
        ):
            errors["status"] = "Cancelled sessions cannot be reopened."
        if self.start_time and self.end_time and self.end_time <= self.start_time:
            errors["end_time"] = "The end time must be after the start time."

        cohort = cast(Cohort | None, getattr(self, "cohort", None))
        if cohort is not None and self.date:
            if cohort.start_date and self.date < cohort.start_date:
                errors["date"] = "A session cannot be before the cohort start date."
            elif cohort.end_date and self.date > cohort.end_date:
                errors["date"] = "A session cannot be after the cohort end date."

        if errors:
            raise ValidationError(errors)

    def save(self, *args, **kwargs):
        self.full_clean()
        super().save(*args, **kwargs)


class Attendance(models.Model):
    class Status(models.TextChoices):
        PRESENT = "PRESENT", "Present"
        ABSENT = "ABSENT", "Absent"
        LATE = "LATE", "Late"
        EXCUSED = "EXCUSED", "Excused"

    session = models.ForeignKey(
        Session,
        on_delete=models.CASCADE,
        related_name="attendance_records",
    )
    student = models.ForeignKey(
        "accounts.User",
        on_delete=models.PROTECT,
        related_name="attendance_records",
    )
    status = models.CharField(max_length=8, choices=Status.choices)
    note = models.CharField(max_length=500, blank=True)
    marked_by = models.ForeignKey(
        "accounts.User",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="marked_attendance_records",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("student__last_name", "student__first_name", "pk")
        constraints = [
            models.UniqueConstraint(
                fields=("session", "student"),
                name="unique_attendance_per_session_student",
            ),
        ]

    def clean(self):
        super().clean()
        session = cast(Session | None, getattr(self, "session", None))
        student = cast(User | None, getattr(self, "student", None))
        if session is not None:
            if session.status == Session.Status.CANCELLED:
                raise ValidationError({"session": "Attendance cannot be recorded for a cancelled session."})
            if student is not None and not Enrollment.objects.filter(
                cohort=session.cohort,
                student=student,
            ).exists():
                raise ValidationError({"student": "Only students enrolled in this cohort can have attendance records."})

    def save(self, *args, **kwargs):
        self.full_clean()
        super().save(*args, **kwargs)


class QuestionBank(models.Model):
    branch = models.OneToOneField(
        Branch,
        on_delete=models.PROTECT,
        related_name="question_bank",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.branch.name} Question Bank"


class Question(models.Model):
    class Type(models.TextChoices):
        SINGLE = "SINGLE", "Single answer"
        MULTIPLE = "MULTIPLE", "Multiple answers"

    bank = models.ForeignKey(
        QuestionBank,
        on_delete=models.CASCADE,
        related_name="questions",
    )
    question_type = models.CharField(max_length=8, choices=Type.choices, default=Type.SINGLE)
    prompt = models.TextField()
    explanation = models.TextField(blank=True)
    is_active = models.BooleanField(default=True)
    created_by = models.ForeignKey(
        "accounts.User",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="created_questions",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("-updated_at", "pk")

    def __str__(self):
        return self.prompt[:80]

    def clean(self):
        super().clean()
        if not self.prompt.strip():
            raise ValidationError({"prompt": "Question text cannot be blank."})

    def save(self, *args, **kwargs):
        self.full_clean()
        super().save(*args, **kwargs)


class QuestionOption(models.Model):
    question = models.ForeignKey(
        Question,
        on_delete=models.CASCADE,
        related_name="options",
    )
    text = models.CharField(max_length=500)
    position = models.PositiveIntegerField(default=0)
    is_correct = models.BooleanField(default=False)

    class Meta:
        ordering = ("position", "pk")
        constraints = [
            models.UniqueConstraint(fields=("question", "position"), name="unique_question_option_position"),
        ]

    def clean(self):
        super().clean()
        if not self.text.strip():
            raise ValidationError({"text": "Answer option cannot be blank."})

    def save(self, *args, **kwargs):
        self.full_clean()
        super().save(*args, **kwargs)


class Assessment(models.Model):
    class Type(models.TextChoices):
        QUIZ = "QUIZ", "Quiz"
        EXAM = "EXAM", "Examination"

    class Status(models.TextChoices):
        DRAFT = "DRAFT", "Draft"
        PUBLISHED = "PUBLISHED", "Published"

    class TimingMode(models.TextChoices):
        WHOLE = "WHOLE", "Whole assessment"
        PER_QUESTION = "PER_QUESTION", "Per question"

    branch = models.ForeignKey(Branch, on_delete=models.PROTECT, related_name="assessments")
    cohort = models.ForeignKey(
        Cohort,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="assessments",
    )
    curriculum_topic = models.ForeignKey(
        CurriculumTopic,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="assessments",
    )
    title = models.CharField(max_length=180)
    description = models.TextField(blank=True)
    assessment_type = models.CharField(max_length=8, choices=Type.choices, default=Type.QUIZ)
    status = models.CharField(max_length=12, choices=Status.choices, default=Status.DRAFT)
    timing_mode = models.CharField(max_length=16, choices=TimingMode.choices, default=TimingMode.WHOLE)
    duration_seconds = models.PositiveIntegerField(null=True, blank=True)
    attempt_limit = models.PositiveSmallIntegerField(default=1)
    deadline_at = models.DateTimeField(null=True, blank=True)
    results_released = models.BooleanField(default=False)
    created_by = models.ForeignKey(
        "accounts.User",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="created_assessments",
    )
    published_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("-created_at", "pk")

    def __str__(self):
        return self.title

    def clean(self):
        super().clean()
        errors = {}
        if not self.title.strip():
            errors["title"] = "Assessment title cannot be blank."
        if self.attempt_limit < 1:
            errors["attempt_limit"] = "Attempt limit must be at least one."
        cohort_id = getattr(self, "cohort_id", None)
        topic_id = getattr(self, "curriculum_topic_id", None)
        cohort = cast(Cohort | None, getattr(self, "cohort", None))
        topic = cast(CurriculumTopic | None, getattr(self, "curriculum_topic", None))
        branch_id = getattr(self, "branch_id", None)
        if (cohort_id is None) == (topic_id is None):
            errors["cohort"] = "Choose exactly one cohort or curriculum topic for this assessment."
        if cohort_id and cohort is not None and getattr(cohort, "branch_id", None) != branch_id:
            errors["cohort"] = "The cohort must belong to the assessment branch."
        if topic_id and topic is not None:
            topic_branch_id = getattr(topic.version.curriculum, "branch_id", None)
            if topic_branch_id != branch_id:
                errors["curriculum_topic"] = "The curriculum topic must belong to the assessment branch."
        if self.timing_mode == self.TimingMode.WHOLE and (self.duration_seconds is None or self.duration_seconds < 1):
            errors["duration_seconds"] = "Whole-assessment timing requires a positive duration."
        if self.status == self.Status.PUBLISHED:
            has_questions = self.pk is not None and AssessmentQuestion.objects.filter(assessment_id=self.pk).exists()
            if not has_questions:
                errors["questions"] = "Add at least one question before publishing."
            elif self.timing_mode == self.TimingMode.PER_QUESTION and AssessmentQuestion.objects.filter(
                assessment_id=self.pk,
                time_limit_seconds__isnull=True,
            ).exists():
                errors["questions"] = "Every question needs a time limit in per-question timing mode."
        if errors:
            raise ValidationError(errors)

    def save(self, *args, **kwargs):
        if self.status == self.Status.PUBLISHED and self.published_at is None:
            self.published_at = timezone.now()
        if self.pk:
            previous = Assessment.objects.filter(pk=self.pk).first()
            if previous and previous.status == self.Status.PUBLISHED:
                immutable_fields = (
                    "branch_id",
                    "cohort_id",
                    "curriculum_topic_id",
                    "title",
                    "description",
                    "assessment_type",
                    "status",
                    "timing_mode",
                    "duration_seconds",
                    "attempt_limit",
                    "deadline_at",
                    "published_at",
                    "created_by_id",
                )
                if any(getattr(previous, field, None) != getattr(self, field, None) for field in immutable_fields):
                    raise ValidationError("Published assessments are immutable.")
        self.full_clean()
        super().save(*args, **kwargs)


class AssessmentQuestion(models.Model):
    assessment = models.ForeignKey(
        Assessment,
        on_delete=models.CASCADE,
        related_name="assessment_questions",
    )
    question = models.ForeignKey(Question, on_delete=models.PROTECT, related_name="assessment_uses")
    position = models.PositiveIntegerField(default=0)
    points = models.DecimalField(max_digits=7, decimal_places=2, default=Decimal("1.00"))
    time_limit_seconds = models.PositiveIntegerField(null=True, blank=True)
    prompt_snapshot = models.TextField(blank=True)
    question_type_snapshot = models.CharField(max_length=8, choices=Question.Type.choices, blank=True)
    options_snapshot = models.JSONField(default=list, blank=True)
    correct_option_ids_snapshot = models.JSONField(default=list, blank=True)
    explanation_snapshot = models.TextField(blank=True)

    class Meta:
        ordering = ("position", "pk")
        constraints = [
            models.UniqueConstraint(fields=("assessment", "position"), name="unique_assessment_question_position"),
            models.UniqueConstraint(fields=("assessment", "question"), name="unique_question_per_assessment"),
        ]

    def clean(self):
        super().clean()
        if self.points <= 0:
            raise ValidationError({"points": "Question points must be greater than zero."})
        assessment_id = getattr(self, "assessment_id", None)
        assessment = cast(Assessment | None, getattr(self, "assessment", None))
        question_id = getattr(self, "question_id", None)
        question = cast(Question | None, getattr(self, "question", None))
        if assessment_id and assessment is not None and assessment.status != Assessment.Status.DRAFT:
            raise ValidationError("Published assessments are immutable.")
        if question_id and assessment_id and question is not None and assessment is not None:
            question_branch_id = getattr(question.bank, "branch_id", None)
            if question_branch_id != getattr(assessment, "branch_id", None):
                raise ValidationError({"question": "Question and assessment must belong to the same branch."})

    def save(self, *args, **kwargs):
        self.full_clean()
        super().save(*args, **kwargs)


class AssessmentAttempt(models.Model):
    class Status(models.TextChoices):
        IN_PROGRESS = "IN_PROGRESS", "In progress"
        SUBMITTED = "SUBMITTED", "Submitted"
        TIMED_OUT = "TIMED_OUT", "Timed out"

    assessment = models.ForeignKey(Assessment, on_delete=models.PROTECT, related_name="attempts")
    student = models.ForeignKey("accounts.User", on_delete=models.PROTECT, related_name="assessment_attempts")
    attempt_number = models.PositiveSmallIntegerField()
    status = models.CharField(max_length=12, choices=Status.choices, default=Status.IN_PROGRESS)
    started_at = models.DateTimeField(default=timezone.now)
    deadline_at = models.DateTimeField(null=True, blank=True)
    current_question_position = models.PositiveIntegerField(default=0)
    current_question_started_at = models.DateTimeField(null=True, blank=True)
    current_question_deadline_at = models.DateTimeField(null=True, blank=True)
    submitted_at = models.DateTimeField(null=True, blank=True)
    score = models.DecimalField(max_digits=8, decimal_places=2, null=True, blank=True)
    max_score = models.DecimalField(max_digits=8, decimal_places=2, null=True, blank=True)

    class Meta:
        ordering = ("attempt_number",)
        constraints = [
            models.UniqueConstraint(fields=("assessment", "student", "attempt_number"), name="unique_assessment_attempt_number"),
        ]


class AssessmentAnswer(models.Model):
    attempt = models.ForeignKey(AssessmentAttempt, on_delete=models.CASCADE, related_name="answers")
    assessment_question = models.ForeignKey(AssessmentQuestion, on_delete=models.PROTECT, related_name="answers")
    selected_option_ids = models.JSONField(default=list, blank=True)
    is_correct = models.BooleanField(null=True, blank=True)
    points_awarded = models.DecimalField(max_digits=7, decimal_places=2, default=Decimal("0.00"))
    submitted_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=("attempt", "assessment_question"), name="unique_answer_per_attempt_question"),
        ]

    def clean(self):
        super().clean()
        attempt = cast(AssessmentAttempt | None, getattr(self, "attempt", None))
        question = cast(AssessmentQuestion | None, getattr(self, "assessment_question", None))
        if attempt is not None and question is not None and attempt.assessment != question.assessment:
            raise ValidationError({"assessment_question": "The question must belong to the attempt's assessment."})

    def save(self, *args, **kwargs):
        self.full_clean()
        super().save(*args, **kwargs)


class GraduationRequirements(models.Model):
    cohort = models.OneToOneField(Cohort, on_delete=models.PROTECT, related_name="graduation_requirements")
    minimum_attendance = models.DecimalField(
        max_digits=5, decimal_places=2, validators=[MinValueValidator(0), MaxValueValidator(100)]
    )
    minimum_assessment_score = models.DecimalField(
        max_digits=5, decimal_places=2, validators=[MinValueValidator(0), MaxValueValidator(100)]
    )
    required_assessments = models.ManyToManyField(Assessment, related_name="graduation_requirements", blank=True)
    updated_at = models.DateTimeField(auto_now=True)

    def save(self, *args, **kwargs):
        self.full_clean()
        super().save(*args, **kwargs)


class GraduationResultSnapshot(models.Model):
    cohort = models.ForeignKey(Cohort, on_delete=models.PROTECT, related_name="result_snapshots")
    finalized_by = models.ForeignKey(
        "accounts.User", on_delete=models.SET_NULL, null=True, related_name="finalized_result_snapshots"
    )
    finalized_at = models.DateTimeField(auto_now_add=True)
    report = models.JSONField()

    class Meta:
        ordering = ("-finalized_at", "-pk")

    def save(self, *args, **kwargs):
        if self.pk and GraduationResultSnapshot.objects.filter(pk=self.pk).exists():
            raise ValidationError("Finalized result snapshots cannot be changed.")
        super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):
        raise ValidationError("Finalized result snapshots cannot be deleted.")


class Certificate(models.Model):
    cohort = models.ForeignKey(Cohort, on_delete=models.PROTECT, related_name="certificates")
    student = models.ForeignKey("accounts.User", on_delete=models.PROTECT, related_name="certificates")
    certificate_number = models.CharField(max_length=32, unique=True, null=True, blank=True, editable=False)
    verification_code = models.UUIDField(default=uuid4, unique=True, editable=False)
    student_name = models.CharField(max_length=240)
    cohort_name = models.CharField(max_length=150)
    branch_name = models.CharField(max_length=150)
    attendance_percentage = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)
    assessment_average = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)
    minimum_attendance = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)
    minimum_assessment_score = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)
    pdf_data = models.BinaryField(null=True, editable=False)
    issued_by = models.ForeignKey(
        "accounts.User",
        on_delete=models.SET_NULL,
        null=True,
        related_name="issued_certificates",
    )
    issued_at = models.DateTimeField(default=timezone.now)

    class Meta:
        ordering = ("-issued_at", "-pk")
        constraints = [
            models.UniqueConstraint(fields=("cohort", "student"), name="unique_certificate_per_student_cohort"),
        ]

    def __str__(self):
        return self.certificate_number or f"Certificate {self.pk}"

    @transaction.atomic
    def save(self, *args, **kwargs):
        if self.pk is not None:
            raise ValidationError("Issued certificates cannot be changed.")
        self.full_clean()
        super().save(*args, **kwargs)
        self.certificate_number = f"MH-{timezone.localtime(self.issued_at).year}-{self.pk:06d}"
        type(self).objects.filter(pk=self.pk).update(certificate_number=self.certificate_number)

    def delete(self, *args, **kwargs):
        raise ValidationError("Issued certificates cannot be deleted.")