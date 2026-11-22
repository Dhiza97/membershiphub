from django.core.exceptions import ValidationError
from django.contrib.auth.models import AbstractUser
from django.db import models


class User(AbstractUser):
    class ApplicationRole(models.TextChoices):
        SUPER_ADMIN = "SUPER_ADMIN", "Super Admin"
        BRANCH_ADMIN = "BRANCH_ADMIN", "Branch Admin"
        INSTRUCTOR = "INSTRUCTOR", "Instructor"
        STUDENT = "STUDENT", "Student"

    application_role = models.CharField(
        max_length=20,
        choices=ApplicationRole.choices,
        default=ApplicationRole.STUDENT,
    )
    branch = models.ForeignKey(
        "core.Branch",
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="users",
    )

    def clean(self):
        super().clean()

        roles_requiring_branch = {
            self.ApplicationRole.BRANCH_ADMIN,
            self.ApplicationRole.INSTRUCTOR,
            self.ApplicationRole.STUDENT,
        }
        if self.application_role == self.ApplicationRole.SUPER_ADMIN and self.branch is not None:
            raise ValidationError({"branch": "Super Admin accounts cannot belong to a branch."})
        if self.application_role in roles_requiring_branch and self.branch is None:
            role_labels = {
                "BRANCH_ADMIN": "Branch Admin",
                "INSTRUCTOR": "Instructor",
                "STUDENT": "Student",
            }
            role_label = role_labels[self.application_role]
            raise ValidationError({"branch": f"{role_label} accounts require a branch."})
        if self.branch is not None and not self.branch.is_active:
            raise ValidationError({"branch": "Inactive branches cannot receive user accounts."})

    def save(self, *args, **kwargs):
        self.clean()
        super().save(*args, **kwargs)

    def is_super_admin(self):
        return self.application_role == self.ApplicationRole.SUPER_ADMIN

    def is_branch_admin(self):
        return self.application_role == self.ApplicationRole.BRANCH_ADMIN
