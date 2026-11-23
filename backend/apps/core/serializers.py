from rest_framework import serializers

from apps.accounts.models import User

from .models import Branch, Cohort, Enrollment


class BranchSerializer(serializers.ModelSerializer):
    class Meta:
        model = Branch
        fields = (
            "id",
            "name",
            "is_active",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "created_at", "updated_at")

    def validate_name(self, value):
        name = value.strip()
        if not name:
            raise serializers.ValidationError("Branch name cannot be blank.")
        queryset = Branch.objects.filter(name__iexact=name)
        if self.instance:
            queryset = queryset.exclude(pk=self.instance.pk)
        if queryset.exists():
            raise serializers.ValidationError("A branch with this name already exists.")
        return name


class CohortSerializer(serializers.ModelSerializer):
    branch = serializers.PrimaryKeyRelatedField(
        queryset=Branch.objects.all(),
        required=False,
    )
    instructor = serializers.PrimaryKeyRelatedField(
        queryset=User.objects.all(),
        required=False,
        allow_null=True,
    )
    branch_name = serializers.CharField(source="branch.name", read_only=True)
    instructor_name = serializers.SerializerMethodField()
    students = serializers.SerializerMethodField()
    student_count = serializers.SerializerMethodField()

    class Meta:
        model = Cohort
        fields = (
            "id",
            "branch",
            "branch_name",
            "name",
            "description",
            "start_date",
            "end_date",
            "status",
            "instructor",
            "instructor_name",
            "students",
            "student_count",
            "created_at",
            "updated_at",
        )
        read_only_fields = (
            "id",
            "branch_name",
            "instructor_name",
            "students",
            "student_count",
            "created_at",
            "updated_at",
        )

    def get_instructor_name(self, obj):
        if obj.instructor is None:
            return None
        return obj.instructor.get_full_name() or obj.instructor.username

    def get_students(self, obj):
        return [
            {
                "id": enrollment.student_id,
                "username": enrollment.student.username,
                "first_name": enrollment.student.first_name,
                "last_name": enrollment.student.last_name,
            }
            for enrollment in obj.enrollments.all()
        ]

    def get_student_count(self, obj):
        return len(obj.enrollments.all())

    def validate_name(self, value):
        return value.strip()

    def validate(self, attrs):
        request = self.context["request"]
        actor = request.user
        creating = self.instance is None
        current_branch = self.instance.branch if self.instance else None
        branch = attrs.get("branch", current_branch)

        if actor.is_branch_admin():
            assigned_branch = actor.branch
            if assigned_branch is None or not assigned_branch.is_active:
                raise serializers.ValidationError("The Branch Admin needs an active assigned branch.")
            if branch is not None and branch.pk != assigned_branch.pk:
                raise serializers.ValidationError({
                    "branch": "Branch Admins can only manage cohorts in their assigned branch."
                })
            if creating:
                attrs["branch"] = assigned_branch
                branch = assigned_branch
            else:
                attrs.pop("branch", None)
                branch = current_branch
        elif creating:
            if branch is None:
                raise serializers.ValidationError({"branch": "A branch is required."})
            if not branch.is_active:
                raise serializers.ValidationError({"branch": "Cohorts cannot be created for inactive branches."})
            attrs["branch"] = branch
        elif branch is not None and branch.pk != current_branch.pk:
            raise serializers.ValidationError({
                "branch": "A cohort cannot be moved to another branch."
            })

        if creating:
            existing_names = Cohort.objects.filter(branch=branch, name__iexact=attrs.get("name", ""))
        else:
            existing_names = Cohort.objects.filter(
                branch=current_branch,
                name__iexact=attrs.get("name", self.instance.name),
            ).exclude(pk=self.instance.pk)
        if existing_names.exists():
            raise serializers.ValidationError({"name": "A cohort with this name already exists in this branch."})

        instructor = attrs.get("instructor", self.instance.instructor if self.instance else None)
        if instructor is not None:
            if instructor.application_role != User.ApplicationRole.INSTRUCTOR:
                raise serializers.ValidationError({"instructor": "The assigned user must be an Instructor."})
            if instructor.branch_id != branch.pk:
                raise serializers.ValidationError({"instructor": "The Instructor must belong to this branch."})
            if not instructor.is_active:
                raise serializers.ValidationError({"instructor": "Inactive users cannot be assigned."})

        name = attrs.get("name", self.instance.name if self.instance else "")
        description = attrs.get("description", self.instance.description if self.instance else "")
        start_date = attrs.get("start_date", self.instance.start_date if self.instance else None)
        end_date = attrs.get("end_date", self.instance.end_date if self.instance else None)
        if start_date and end_date and end_date < start_date:
            raise serializers.ValidationError({"end_date": "The end date must be on or after the start date."})

        status = attrs.get("status", self.instance.status if self.instance else Cohort.Status.DRAFT)
        if status == Cohort.Status.READY:
            errors = {}
            if not name.strip():
                errors["name"] = "A cohort name is required before a cohort can be Ready."
            if not description.strip():
                errors["description"] = "A description is required before a cohort can be Ready."
            if start_date is None:
                errors["start_date"] = "A start date is required before a cohort can be Ready."
            if end_date is None:
                errors["end_date"] = "An end date is required before a cohort can be Ready."
            if instructor is None:
                errors["instructor"] = "An Instructor must be assigned before a cohort can be Ready."
            has_students = (
                self.instance.enrollments.exists()
                if self.instance is not None
                else False
            )
            if not has_students:
                errors["students"] = "At least one student must be enrolled before a cohort can be Ready."
            if errors:
                raise serializers.ValidationError(errors)

        return attrs


class CohortFilterSerializer(serializers.Serializer):
    status = serializers.ChoiceField(choices=Cohort.Status.choices, required=False)
    branch = serializers.PrimaryKeyRelatedField(
        queryset=Branch.objects.all(),
        required=False,
    )
    instructor = serializers.PrimaryKeyRelatedField(
        queryset=User.objects.all(),
        required=False,
    )
    search = serializers.CharField(required=False, allow_blank=True)
    start_date_after = serializers.DateField(required=False)
    start_date_before = serializers.DateField(required=False)

    def validate(self, attrs):
        start_after = attrs.get("start_date_after")
        start_before = attrs.get("start_date_before")
        if start_after and start_before and start_before < start_after:
            raise serializers.ValidationError({
                "start_date_before": "The upper date bound must be on or after the lower date bound."
            })
        return attrs


class EnrollmentSerializer(serializers.ModelSerializer):
    student = serializers.SerializerMethodField()

    class Meta:
        model = Enrollment
        fields = ("id", "student", "created_at")
        read_only_fields = fields

    def get_student(self, obj):
        return {
            "id": obj.student_id,
            "username": obj.student.username,
            "first_name": obj.student.first_name,
            "last_name": obj.student.last_name,
        }


class EnrollmentCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Enrollment
        fields = ("student",)

    def validate_student(self, student):
        cohort = self.context["cohort"]
        if student.application_role != User.ApplicationRole.STUDENT:
            raise serializers.ValidationError("Only Students can be enrolled in a cohort.")
        if student.branch_id != cohort.branch_id:
            raise serializers.ValidationError("Students can only enroll in cohorts in their branch.")
        if cohort.enrollments.filter(student=student).exists():
            raise serializers.ValidationError("This Student is already enrolled in the cohort.")
        return student

    def create(self, validated_data):
        return Enrollment.objects.create(
            cohort=self.context["cohort"],
            **validated_data,
        )
