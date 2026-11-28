import getpass
import uuid

from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError
from django.core.management.base import BaseCommand, CommandError
from django.core.validators import validate_email
from django.db.models import Q

from apps.accounts.models import User


class Command(BaseCommand):
    help = "Create a MembershipHub Super Admin without Django admin access"

    def add_arguments(self, parser):
        parser.add_argument("email", help="Email address for the application Super Admin")

    def handle(self, *args, **options):
        email = options["email"].strip().lower()
        try:
            validate_email(email)
        except ValidationError as error:
            raise CommandError("Enter a valid email address.") from error
        if len(email) > User._meta.get_field("email").max_length:
            raise CommandError("The email address is too long.")
        if User.objects.filter(Q(email__iexact=email) | Q(username=email)).exists():
            raise CommandError("That email address is already associated with an account.")

        password = getpass.getpass("Password: ")
        confirmation = getpass.getpass("Password (again): ")
        if password != confirmation:
            raise CommandError("The passwords do not match.")

        user = User(username=f"app-admin-{uuid.uuid4().hex}", email=email, application_role=User.ApplicationRole.SUPER_ADMIN)
        try:
            validate_password(password, user)
        except ValidationError as error:
            raise CommandError(" ".join(error.messages)) from error
        user.set_password(password)
        user.save()
        self.stdout.write(self.style.SUCCESS(f"Created application Super Admin: {email}"))