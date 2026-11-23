from typing import cast

from django.core.exceptions import ValidationError
from django.db import models
from django.db.models.functions import Lower

from apps.accounts.models import User


class Branch(models.Model):
    name = models.CharField(max_length=150, unique=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("name",)
        verbose_name = "branch"
        verbose_name_plural = "branches"

    def __str__(self):
        return self.name


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

        if self.status == self.Status.READY:
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
            if self.pk is None or not Enrollment.objects.filter(cohort_id=self.pk).exists():
                errors["students"] = "At least one student must be enrolled before a cohort can be Ready."

        if errors:
            raise ValidationError(errors)

    def save(self, *args, **kwargs):
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