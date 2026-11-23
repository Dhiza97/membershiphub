from decimal import Decimal
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from django.db import transaction
from rest_framework import serializers

from apps.accounts.models import User

from .models import (
    Branch,
    Cohort,
    Curriculum,
    CurriculumLesson,
    CurriculumObjective,
    CurriculumTopic,
    CurriculumVersion,
    Enrollment,
    LearningMaterial,
    Session,
    Attendance,
    Assessment,
    AssessmentAnswer,
    AssessmentAttempt,
    AssessmentQuestion,
    Question,
    QuestionBank,
    QuestionOption,
)


class BranchSerializer(serializers.ModelSerializer):
    class Meta:
        model = Branch
        fields = (
            "id",
            "name",
            "timezone",
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

    def validate_timezone(self, value):
        try:
            ZoneInfo(value)
        except ZoneInfoNotFoundError as error:
            raise serializers.ValidationError("Enter a valid IANA timezone.") from error
        return value


class CurriculumSerializer(serializers.ModelSerializer):
    branch = serializers.PrimaryKeyRelatedField(queryset=Branch.objects.all(), required=False)
    branch_name = serializers.CharField(source="branch.name", read_only=True)
    latest_version_number = serializers.SerializerMethodField()

    class Meta:
        model = Curriculum
        fields = (
            "id",
            "branch",
            "branch_name",
            "name",
            "description",
            "is_active",
            "latest_version_number",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "branch_name", "latest_version_number", "created_at", "updated_at")

    def get_latest_version_number(self, obj):
        latest = obj.versions.order_by("-version_number").first()
        return latest.version_number if latest else None

    def validate_name(self, value):
        name = value.strip()
        if not name:
            raise serializers.ValidationError("Curriculum name cannot be blank.")
        return name

    def validate(self, attrs):
        actor = self.context["request"].user
        creating = self.instance is None
        current_branch = self.instance.branch if self.instance else None
        branch = attrs.get("branch", current_branch)

        if actor.is_branch_admin():
            assigned_branch = actor.branch
            if assigned_branch is None or not assigned_branch.is_active:
                raise serializers.ValidationError("The Branch Admin needs an active assigned branch.")
            if branch is not None and branch.pk != assigned_branch.pk:
                raise serializers.ValidationError({
                    "branch": "Branch Admins can only manage curricula in their assigned branch."
                })
            if creating:
                attrs["branch"] = assigned_branch
            else:
                attrs.pop("branch", None)
        elif creating and branch is None:
            raise serializers.ValidationError({"branch": "A branch is required."})
        elif not creating and branch is not None and branch.pk != current_branch.pk:
            raise serializers.ValidationError({"branch": "A curriculum cannot be moved to another branch."})

        target_branch = attrs.get("branch", current_branch)
        if target_branch is not None:
            duplicate = Curriculum.objects.filter(branch=target_branch, name__iexact=attrs.get("name", self.instance.name if self.instance else ""))
            if self.instance:
                duplicate = duplicate.exclude(pk=self.instance.pk)
            if duplicate.exists():
                raise serializers.ValidationError({"name": "A curriculum with this name already exists in this branch."})
        return attrs

    @transaction.atomic
    def create(self, validated_data):
        curriculum = Curriculum.objects.create(**validated_data)
        CurriculumVersion.objects.create(
            curriculum=curriculum,
            version_number=1,
            created_by=self.context["request"].user,
        )
        return curriculum


class CurriculumMaterialInputSerializer(serializers.Serializer):
    title = serializers.CharField(max_length=180)
    url = serializers.URLField(max_length=500)
    material_type = serializers.ChoiceField(choices=LearningMaterial.Type.choices, default=LearningMaterial.Type.OTHER)
    description = serializers.CharField(max_length=500, required=False, allow_blank=True)
    position = serializers.IntegerField(min_value=0, required=False, default=0)


class CurriculumLessonInputSerializer(serializers.Serializer):
    title = serializers.CharField(max_length=180)
    description = serializers.CharField(required=False, allow_blank=True)
    notes = serializers.CharField(required=False, allow_blank=True)
    position = serializers.IntegerField(min_value=0, required=False, default=0)
    materials = CurriculumMaterialInputSerializer(many=True, required=False, default=list)


class CurriculumObjectiveInputSerializer(serializers.Serializer):
    text = serializers.CharField(max_length=500)
    position = serializers.IntegerField(min_value=0, required=False, default=0)


class CurriculumTopicInputSerializer(serializers.Serializer):
    title = serializers.CharField(max_length=180)
    description = serializers.CharField(required=False, allow_blank=True)
    notes = serializers.CharField(required=False, allow_blank=True)
    position = serializers.IntegerField(min_value=0, required=False, default=0)
    objectives = CurriculumObjectiveInputSerializer(many=True, required=False, default=list)
    lessons = CurriculumLessonInputSerializer(many=True, required=False, default=list)


class CurriculumMaterialSerializer(serializers.ModelSerializer):
    class Meta:
        model = LearningMaterial
        fields = ("id", "title", "url", "material_type", "description", "position")


class CurriculumLessonSerializer(serializers.ModelSerializer):
    materials = CurriculumMaterialSerializer(many=True, read_only=True)

    class Meta:
        model = CurriculumLesson
        fields = ("id", "title", "description", "notes", "position", "materials")


class CurriculumObjectiveSerializer(serializers.ModelSerializer):
    class Meta:
        model = CurriculumObjective
        fields = ("id", "text", "position")


class CurriculumTopicSerializer(serializers.ModelSerializer):
    objectives = CurriculumObjectiveSerializer(many=True, read_only=True)
    lessons = CurriculumLessonSerializer(many=True, read_only=True)

    class Meta:
        model = CurriculumTopic
        fields = ("id", "title", "description", "notes", "position", "objectives", "lessons")


class CurriculumVersionSummarySerializer(serializers.ModelSerializer):
    class Meta:
        model = CurriculumVersion
        fields = ("id", "version_number", "status", "change_note", "created_at", "published_at")


class CurriculumVersionDetailSerializer(CurriculumVersionSummarySerializer):
    topics = CurriculumTopicSerializer(many=True, read_only=True)

    class Meta(CurriculumVersionSummarySerializer.Meta):
        fields = CurriculumVersionSummarySerializer.Meta.fields + ("topics",)


class CurriculumVersionDraftSerializer(serializers.ModelSerializer):
    topics = CurriculumTopicInputSerializer(many=True, required=False)

    class Meta:
        model = CurriculumVersion
        fields = ("change_note", "topics")

    def validate(self, attrs):
        if self.instance.status != CurriculumVersion.Status.DRAFT:
            raise serializers.ValidationError("Published curriculum versions are immutable. Create a new draft version to edit.")
        return attrs

    def update(self, instance, validated_data):
        topics_data = validated_data.pop("topics", None)
        for field, value in validated_data.items():
            setattr(instance, field, value)
        instance.save()

        if topics_data is not None:
            instance.topics.all().delete()
            for topic_data in topics_data:
                objectives = topic_data.pop("objectives", [])
                lessons = topic_data.pop("lessons", [])
                topic = CurriculumTopic.objects.create(version=instance, **topic_data)
                for objective in objectives:
                    CurriculumObjective.objects.create(topic=topic, **objective)
                for lesson_data in lessons:
                    materials = lesson_data.pop("materials", [])
                    lesson = CurriculumLesson.objects.create(topic=topic, **lesson_data)
                    for material in materials:
                        LearningMaterial.objects.create(lesson=lesson, **material)
        return instance


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
    curriculum_version = serializers.PrimaryKeyRelatedField(
        queryset=CurriculumVersion.objects.filter(
            status=CurriculumVersion.Status.PUBLISHED,
            curriculum__is_active=True,
        ),
        required=False,
        allow_null=True,
    )
    branch_name = serializers.CharField(source="branch.name", read_only=True)
    instructor_name = serializers.SerializerMethodField()
    curriculum_name = serializers.SerializerMethodField()
    curriculum_snapshot = serializers.JSONField(read_only=True)
    curriculum_snapshot_at = serializers.DateTimeField(read_only=True)
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
            "curriculum_version",
            "curriculum_name",
            "curriculum_snapshot",
            "curriculum_snapshot_at",
            "students",
            "student_count",
            "created_at",
            "updated_at",
        )
        read_only_fields = (
            "id",
            "branch_name",
            "instructor_name",
            "curriculum_name",
            "curriculum_snapshot",
            "curriculum_snapshot_at",
            "students",
            "student_count",
            "created_at",
            "updated_at",
        )

    def get_instructor_name(self, obj):
        if obj.instructor is None:
            return None
        return obj.instructor.get_full_name() or obj.instructor.username

    def get_curriculum_name(self, obj):
        version = obj.curriculum_version
        if version is None:
            return None
        return f"{version.curriculum.name} v{version.version_number}"

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

        curriculum_version = attrs.get(
            "curriculum_version",
            self.instance.curriculum_version if self.instance else None,
        )
        if curriculum_version is not None:
            if curriculum_version.curriculum.branch_id != branch.pk:
                raise serializers.ValidationError({"curriculum_version": "Choose a curriculum from this branch."})
            if curriculum_version.status != CurriculumVersion.Status.PUBLISHED:
                raise serializers.ValidationError({"curriculum_version": "Choose a published curriculum version."})
            if (
                self.instance is not None
                and self.instance.curriculum_snapshot is not None
                and curriculum_version.pk != self.instance.curriculum_version_id
            ):
                raise serializers.ValidationError({
                    "curriculum_version": "A cohort's curriculum cannot change after its snapshot is created."
                })
        elif attrs.get("status", self.instance.status if self.instance else Cohort.Status.DRAFT) == Cohort.Status.READY:
            legacy_ready = (
                self.instance is not None
                and self.instance.status == Cohort.Status.READY
                and self.instance.curriculum_version_id is None
                and "status" not in attrs
            )
            if not legacy_ready:
                raise serializers.ValidationError({"curriculum_version": "Select a published curriculum before marking the cohort Ready."})

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


class SessionSerializer(serializers.ModelSerializer):
    timezone = serializers.CharField(source="cohort.branch.timezone", read_only=True)

    class Meta:
        model = Session
        fields = (
            "id",
            "cohort",
            "title",
            "description",
            "date",
            "start_time",
            "end_time",
            "timezone",
            "status",
            "created_by",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "cohort", "timezone", "created_by", "created_at", "updated_at")

    def validate(self, attrs):
        cohort = self.context.get("cohort", self.instance.cohort if self.instance else None)
        session_date = attrs.get("date", self.instance.date if self.instance else None)
        start_time = attrs.get("start_time", self.instance.start_time if self.instance else None)
        end_time = attrs.get("end_time", self.instance.end_time if self.instance else None)
        status = attrs.get("status", self.instance.status if self.instance else Session.Status.SCHEDULED)
        if (
            self.instance is not None
            and self.instance.status == Session.Status.CANCELLED
            and status != Session.Status.CANCELLED
        ):
            raise serializers.ValidationError({"status": "Cancelled sessions cannot be reopened."})
        if start_time and end_time and end_time <= start_time:
            raise serializers.ValidationError({"end_time": "The end time must be after the start time."})
        if cohort is not None and session_date is not None:
            if cohort.start_date and session_date < cohort.start_date:
                raise serializers.ValidationError({"date": "A session cannot be before the cohort start date."})
            if cohort.end_date and session_date > cohort.end_date:
                raise serializers.ValidationError({"date": "A session cannot be after the cohort end date."})
        return attrs

    def create(self, validated_data):
        return Session.objects.create(
            cohort=self.context["cohort"],
            created_by=self.context["request"].user,
            **validated_data,
        )


class AttendanceSerializer(serializers.ModelSerializer):
    student_name = serializers.SerializerMethodField()
    student_username = serializers.CharField(source="student.username", read_only=True)

    class Meta:
        model = Attendance
        fields = ("id", "student", "student_name", "student_username", "status", "note", "marked_by", "updated_at")
        read_only_fields = fields

    def get_student_name(self, obj):
        return obj.student.get_full_name() or obj.student.username


class AttendanceCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Attendance
        fields = ("student", "status", "note")
        extra_kwargs = {"note": {"required": False, "allow_blank": True}}

    def validate(self, attrs):
        session = self.context["session"]
        student = attrs["student"]
        if session.status == Session.Status.CANCELLED:
            raise serializers.ValidationError({"session": "Attendance cannot be recorded for a cancelled session."})
        if not Enrollment.objects.filter(cohort=session.cohort, student=student).exists():
            raise serializers.ValidationError({"student": "Only students enrolled in this cohort can have attendance records."})
        if Attendance.objects.filter(session=session, student=student).exists():
            raise serializers.ValidationError({"student": "Attendance has already been recorded for this student."})
        return attrs

    def create(self, validated_data):
        return Attendance.objects.create(
            session=self.context["session"],
            marked_by=self.context["request"].user,
            **validated_data,
        )


class AttendanceUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Attendance
        fields = ("status", "note")
        extra_kwargs = {"note": {"required": False, "allow_blank": True}}

    def validate(self, attrs):
        if self.instance.session.status == Session.Status.CANCELLED:
            raise serializers.ValidationError({"session": "Attendance for cancelled sessions is locked."})
        return attrs


class QuestionOptionInputSerializer(serializers.ModelSerializer):
    class Meta:
        model = QuestionOption
        fields = ("id", "text", "position", "is_correct")
        read_only_fields = ("id",)


class QuestionBankQuestionSerializer(serializers.ModelSerializer):
    options = QuestionOptionInputSerializer(many=True)
    branch = serializers.IntegerField(source="bank.branch_id", read_only=True)

    class Meta:
        model = Question
        fields = (
            "id",
            "branch",
            "question_type",
            "prompt",
            "explanation",
            "options",
            "is_active",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "branch", "created_at", "updated_at")

    def validate(self, attrs):
        question_type = attrs.get("question_type", self.instance.question_type if self.instance else Question.Type.SINGLE)
        options = attrs.get("options")
        if options is None and self.instance is not None:
            options = [
                {"text": option.text, "is_correct": option.is_correct, "position": option.position}
                for option in QuestionOption.objects.filter(question=self.instance)
            ]
        if options is None or len(options) < 2:
            raise serializers.ValidationError({"options": "A multiple-choice question needs at least two answer options."})
        if any(not option["text"].strip() for option in options):
            raise serializers.ValidationError({"options": "Answer option text cannot be blank."})
        correct_count = sum(bool(option.get("is_correct", False)) for option in options)
        if question_type == Question.Type.SINGLE and correct_count != 1:
            raise serializers.ValidationError({"options": "Single-answer questions need exactly one correct option."})
        if question_type == Question.Type.MULTIPLE and correct_count < 1:
            raise serializers.ValidationError({"options": "Select at least one correct option."})
        return attrs

    @transaction.atomic
    def create(self, validated_data):
        options = validated_data.pop("options")
        question = Question.objects.create(
            bank=self.context["bank"],
            created_by=self.context["request"].user,
            **validated_data,
        )
        self._replace_options(question, options)
        return question

    @transaction.atomic
    def update(self, instance, validated_data):
        options = validated_data.pop("options", None)
        for field, value in validated_data.items():
            setattr(instance, field, value)
        instance.save()
        if options is not None:
            self._replace_options(instance, options)
        return instance

    def _replace_options(self, question, options):
        QuestionOption.objects.filter(question=question).delete()
        for position, option in enumerate(options):
            option.pop("id", None)
            option["position"] = position
            QuestionOption.objects.create(question=question, **option)


class AssessmentQuestionInputSerializer(serializers.Serializer):
    question = serializers.PrimaryKeyRelatedField(queryset=Question.objects.filter(is_active=True))
    points = serializers.DecimalField(max_digits=7, decimal_places=2, min_value=Decimal("0.01"), default=Decimal("1.00"))
    position = serializers.IntegerField(min_value=0, required=False)
    time_limit_seconds = serializers.IntegerField(min_value=1, required=False, allow_null=True)


class AssessmentQuestionAdminSerializer(serializers.ModelSerializer):
    prompt = serializers.SerializerMethodField()
    question_type = serializers.SerializerMethodField()
    options = serializers.SerializerMethodField()
    correct_option_ids = serializers.SerializerMethodField()
    explanation = serializers.SerializerMethodField()

    class Meta:
        model = AssessmentQuestion
        fields = (
            "id",
            "question",
            "prompt",
            "question_type",
            "options",
            "correct_option_ids",
            "explanation",
            "points",
            "position",
            "time_limit_seconds",
        )

    def get_prompt(self, obj):
        return obj.prompt_snapshot or obj.question.prompt

    def get_question_type(self, obj):
        return obj.question_type_snapshot or obj.question.question_type

    def get_options(self, obj):
        if obj.prompt_snapshot:
            return obj.options_snapshot
        return [
            {"id": option.pk, "text": option.text}
            for option in QuestionOption.objects.filter(question=obj.question)
        ]

    def get_correct_option_ids(self, obj):
        if obj.prompt_snapshot:
            return obj.correct_option_ids_snapshot
        return list(QuestionOption.objects.filter(question=obj.question, is_correct=True).values_list("id", flat=True))

    def get_explanation(self, obj):
        return obj.explanation_snapshot if obj.prompt_snapshot else obj.question.explanation


class AssessmentSerializer(serializers.ModelSerializer):
    questions = AssessmentQuestionInputSerializer(many=True, required=False, write_only=True)
    question_details = AssessmentQuestionAdminSerializer(source="assessment_questions", many=True, read_only=True)
    cohort_name = serializers.CharField(source="cohort.name", read_only=True)
    curriculum_topic_title = serializers.CharField(source="curriculum_topic.title", read_only=True)
    attempt_count = serializers.SerializerMethodField()

    class Meta:
        model = Assessment
        fields = (
            "id",
            "branch",
            "cohort",
            "cohort_name",
            "curriculum_topic",
            "curriculum_topic_title",
            "title",
            "description",
            "assessment_type",
            "status",
            "timing_mode",
            "duration_seconds",
            "attempt_limit",
            "deadline_at",
            "results_released",
            "questions",
            "question_details",
            "attempt_count",
            "published_at",
            "created_at",
            "updated_at",
        )
        read_only_fields = (
            "id",
            "branch",
            "cohort_name",
            "curriculum_topic_title",
            "status",
            "results_released",
            "question_details",
            "attempt_count",
            "published_at",
            "created_at",
            "updated_at",
        )

    def get_attempt_count(self, obj):
        return AssessmentAttempt.objects.filter(assessment=obj).count()

    def validate(self, attrs):
        actor = self.context["request"].user
        cohort = attrs.get("cohort", self.instance.cohort if self.instance else None)
        topic = attrs.get("curriculum_topic", self.instance.curriculum_topic if self.instance else None)
        branch = cohort.branch if cohort else topic.version.curriculum.branch if topic else None
        if (cohort is None) == (topic is None):
            raise serializers.ValidationError({"cohort": "Choose exactly one cohort or curriculum topic."})
        if branch is None:
            raise serializers.ValidationError({"cohort": "Assessment needs a valid cohort or curriculum topic."})
        if actor.is_branch_admin() and actor.branch_id != branch.pk:
            raise serializers.ValidationError("Branch Admins can only manage assessments in their branch.")
        if actor.application_role == User.ApplicationRole.INSTRUCTOR:
            if actor.branch_id != branch.pk:
                raise serializers.ValidationError("Instructors can only manage assessments in their branch.")
            if cohort is None or cohort.instructor_id != actor.pk:
                raise serializers.ValidationError("Instructors can only manage assessments in their assigned cohorts.")
        if self.instance and self.instance.status != Assessment.Status.DRAFT:
            raise serializers.ValidationError("Published assessments are immutable.")

        timing_mode = attrs.get("timing_mode", self.instance.timing_mode if self.instance else Assessment.TimingMode.WHOLE)
        duration = attrs.get("duration_seconds", self.instance.duration_seconds if self.instance else None)
        if timing_mode == Assessment.TimingMode.WHOLE and (duration is None or duration < 1):
            raise serializers.ValidationError({"duration_seconds": "Set a positive whole-assessment time limit."})
        attempt_limit = attrs.get("attempt_limit", self.instance.attempt_limit if self.instance else 1)
        if attempt_limit < 1:
            raise serializers.ValidationError({"attempt_limit": "Attempt limit must be at least one."})

        questions = attrs.get("questions")
        if questions is not None:
            question_ids = [item["question"].pk for item in questions]
            if len(question_ids) != len(set(question_ids)):
                raise serializers.ValidationError({"questions": "A question can only appear once in an assessment."})
            positions = [item.get("position", index) for index, item in enumerate(questions)]
            if len(positions) != len(set(positions)):
                raise serializers.ValidationError({"questions": "Question positions must be unique."})
            if any(item["question"].bank.branch_id != branch.pk for item in questions):
                raise serializers.ValidationError({"questions": "Questions must come from this branch's question bank."})
            if timing_mode == Assessment.TimingMode.PER_QUESTION and any(not item.get("time_limit_seconds") for item in questions):
                raise serializers.ValidationError({"questions": "Set a time limit for every question in per-question mode."})
        return attrs

    @transaction.atomic
    def create(self, validated_data):
        questions = validated_data.pop("questions", [])
        actor = self.context["request"].user
        cohort = validated_data.get("cohort")
        topic = validated_data.get("curriculum_topic")
        branch = cohort.branch if cohort else topic.version.curriculum.branch
        assessment = Assessment.objects.create(branch=branch, created_by=actor, **validated_data)
        self._replace_questions(assessment, questions)
        return assessment

    @transaction.atomic
    def update(self, instance, validated_data):
        questions = validated_data.pop("questions", None)
        for field, value in validated_data.items():
            setattr(instance, field, value)
        instance.save()
        if questions is not None:
            self._replace_questions(instance, questions)
        return instance

    def _replace_questions(self, assessment, questions):
        AssessmentQuestion.objects.filter(assessment=assessment).delete()
        for position, item in enumerate(questions):
            AssessmentQuestion.objects.create(
                assessment=assessment,
                question=item["question"],
                points=item["points"],
                position=item.get("position", position),
                time_limit_seconds=item.get("time_limit_seconds"),
            )


class AssessmentStudentSerializer(serializers.ModelSerializer):
    question_count = serializers.SerializerMethodField()
    my_attempts = serializers.SerializerMethodField()
    attempt_details = serializers.SerializerMethodField()
    can_start = serializers.SerializerMethodField()

    class Meta:
        model = Assessment
        fields = (
            "id",
            "title",
            "description",
            "assessment_type",
            "timing_mode",
            "duration_seconds",
            "attempt_limit",
            "deadline_at",
            "question_count",
            "my_attempts",
            "attempt_details",
            "can_start",
            "results_released",
        )

    def get_question_count(self, obj):
        return AssessmentQuestion.objects.filter(assessment=obj).count()

    def get_my_attempts(self, obj):
        return AssessmentAttempt.objects.filter(assessment=obj, student=self.context["request"].user).count()

    def get_attempt_details(self, obj):
        attempts = AssessmentAttempt.objects.filter(assessment=obj, student=self.context["request"].user)
        return AssessmentAttemptSerializer(attempts, many=True, context=self.context).data

    def get_can_start(self, obj):
        return self.context["can_start"].get(obj.pk, False)


class AssessmentQuestionStudentSerializer(serializers.ModelSerializer):
    prompt = serializers.CharField(source="prompt_snapshot", read_only=True)
    options = serializers.SerializerMethodField()

    class Meta:
        model = AssessmentQuestion
        fields = ("id", "prompt", "question_type_snapshot", "options", "points", "position", "time_limit_seconds")

    def get_options(self, obj):
        return obj.options_snapshot


class AssessmentAttemptSerializer(serializers.ModelSerializer):
    assessment_title = serializers.CharField(source="assessment.title", read_only=True)
    question = serializers.SerializerMethodField()
    question_count = serializers.SerializerMethodField()
    answers = serializers.SerializerMethodField()
    score_percent = serializers.SerializerMethodField()
    results_released = serializers.BooleanField(source="assessment.results_released", read_only=True)

    class Meta:
        model = AssessmentAttempt
        fields = (
            "id",
            "assessment",
            "assessment_title",
            "attempt_number",
            "status",
            "started_at",
            "deadline_at",
            "current_question_position",
            "current_question_started_at",
            "current_question_deadline_at",
            "submitted_at",
            "score",
            "max_score",
            "score_percent",
            "question_count",
            "question",
            "answers",
            "results_released",
        )
        read_only_fields = fields

    def get_question_count(self, obj):
        return AssessmentQuestion.objects.filter(assessment=obj.assessment).count()

    def get_question(self, obj):
        current = AssessmentQuestion.objects.filter(
            assessment=obj.assessment,
            position=obj.current_question_position,
        ).first()
        if current is None or obj.status != AssessmentAttempt.Status.IN_PROGRESS:
            return None
        return AssessmentQuestionStudentSerializer(current).data

    def get_answers(self, obj):
        released = obj.assessment.results_released
        return [
            {
                "assessment_question": answer.assessment_question_id,
                "selected_option_ids": answer.selected_option_ids,
                "is_correct": answer.is_correct if released else None,
                "points_awarded": answer.points_awarded if released else None,
                "correct_option_ids": answer.assessment_question.correct_option_ids_snapshot if released else None,
                "explanation": answer.assessment_question.explanation_snapshot if released else None,
            }
            for answer in AssessmentAnswer.objects.filter(attempt=obj).select_related("assessment_question")
        ]

    def get_score_percent(self, obj):
        if not obj.assessment.results_released or obj.score is None or not obj.max_score:
            return None
        return round(float(obj.score / obj.max_score * 100), 1)

    def to_representation(self, instance):
        data = super().to_representation(instance)
        if not instance.assessment.results_released:
            data["score"] = None
            data["max_score"] = None
        return data
