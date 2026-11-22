from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from apps.accounts.models import User


class Command(BaseCommand):
    help = "Initialize an existing account as a MembershipHub Super Admin"

    def add_arguments(self, parser):
        parser.add_argument("identifier", help="Exact username or unique email address")

    @transaction.atomic
    def handle(self, *args, **options):
        identifier = options["identifier"].strip()
        if not identifier:
            raise CommandError("Account identifier cannot be empty.")

        matches = list(
            User.objects.filter(username=identifier)
        )
        if not matches:
            matches = list(User.objects.filter(email__iexact=identifier))

        if not matches:
            raise CommandError(f"No account found for identifier: {identifier}")
        if len(matches) > 1:
            raise CommandError(
                f"Identifier is ambiguous: {identifier}. Use an exact username."
            )

        user = matches[0]
        user.application_role = User.ApplicationRole.SUPER_ADMIN
        user.branch = None
        user.is_staff = True
        user.is_superuser = True
        user.save(update_fields=[
            "application_role",
            "branch",
            "is_staff",
            "is_superuser",
        ])

        self.stdout.write(
            self.style.SUCCESS(
                f"Initialized {user.username} as a MembershipHub Super Admin."
            )
        )