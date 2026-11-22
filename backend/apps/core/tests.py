from django.db import IntegrityError, transaction
from django.test import TestCase

from .models import Branch


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