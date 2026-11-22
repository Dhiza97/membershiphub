from collections.abc import Mapping
from typing import cast

from django.contrib.auth import authenticate
from django.contrib.auth.password_validation import validate_password
from django.db import transaction
from rest_framework import serializers

from apps.core.models import Branch

from .models import User


class LoginSerializer(serializers.Serializer):
    username = serializers.CharField()
    password = serializers.CharField(write_only=True, trim_whitespace=False)

    def validate(self, attrs):
        user = authenticate(
            username=attrs["username"],
            password=attrs["password"],
        )
        if user is None:
            raise serializers.ValidationError("Invalid username or password.")
        if not user.is_active:
            raise serializers.ValidationError("This account is inactive.")
        attrs["user"] = user
        return attrs


class UserProfileSerializer(serializers.ModelSerializer):
    branch = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = (
            "id",
            "username",
            "email",
            "first_name",
            "last_name",
            "application_role",
            "branch",
        )
        read_only_fields = fields

    def get_branch(self, obj):
        if obj.branch is None:
            return None
        return {
            "id": obj.branch.id,
            "name": obj.branch.name,
            "is_active": obj.branch.is_active,
        }


class PasswordChangeSerializer(serializers.Serializer):
    old_password = serializers.CharField(write_only=True, trim_whitespace=False)
    new_password = serializers.CharField(write_only=True, trim_whitespace=False)

    def validate_old_password(self, value):
        user = self.context["request"].user
        if not user.check_password(value):
            raise serializers.ValidationError("The current password is incorrect.")
        return value

    def validate_new_password(self, value):
        validate_password(value, self.context["request"].user)
        return value

    def create(self, validated_data):
        user = self.context["request"].user
        user.set_password(validated_data["new_password"])
        user.save(update_fields=["password"])
        return user


class ManagedUserSerializer(serializers.ModelSerializer):
    branch = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = (
            "id",
            "username",
            "email",
            "first_name",
            "last_name",
            "application_role",
            "branch",
            "is_active",
        )
        read_only_fields = (
            "id",
            "username",
            "application_role",
            "branch",
        )

    def get_branch(self, obj):
        if obj.branch is None:
            return None
        return {"id": obj.branch_id, "name": obj.branch.name}


class ManagedUserCreateSerializer(serializers.Serializer):
    username = serializers.CharField(max_length=150)
    email = serializers.EmailField(required=False, allow_blank=True)
    first_name = serializers.CharField(required=False, allow_blank=True, max_length=150)
    last_name = serializers.CharField(required=False, allow_blank=True, max_length=150)
    password = serializers.CharField(write_only=True, trim_whitespace=False)
    application_role = serializers.ChoiceField(
        choices=(
            (User.ApplicationRole.BRANCH_ADMIN, "Branch Admin"),
            (User.ApplicationRole.INSTRUCTOR, "Instructor"),
            (User.ApplicationRole.STUDENT, "Student"),
        )
    )
    branch = serializers.PrimaryKeyRelatedField(
        queryset=Branch.objects.filter(is_active=True),
        required=False,
    )

    def validate_username(self, value):
        username = value.strip()
        if not username:
            raise serializers.ValidationError("Username cannot be blank.")
        if User.objects.filter(username__iexact=username).exists():
            raise serializers.ValidationError("A user with this username already exists.")
        return username

    def validate_email(self, value):
        email = value.strip().lower()
        if email and User.objects.filter(email__iexact=email).exists():
            raise serializers.ValidationError("A user with this email already exists.")
        return email

    def validate_password(self, value):
        validate_password(value)
        return value

    def validate(self, attrs):
        request = self.context["request"]
        actor = request.user
        role = attrs["application_role"]

        if actor.is_branch_admin():
            if role not in (User.ApplicationRole.STUDENT, User.ApplicationRole.INSTRUCTOR):
                raise serializers.ValidationError({
                    "application_role": "Branch Admins can only register Students or Instructors."
                })
            if actor.branch is None:
                raise serializers.ValidationError("The Branch Admin has no assigned branch.")
            if not actor.branch.is_active:
                raise serializers.ValidationError("The Branch Admin's branch is inactive.")
            attrs["branch"] = actor.branch

        elif actor.is_super_admin():
            if role == User.ApplicationRole.BRANCH_ADMIN:
                branch = attrs.get("branch")
                if branch is None:
                    raise serializers.ValidationError({"branch": "Branch Admin accounts require a branch."})
            elif role in (User.ApplicationRole.STUDENT, User.ApplicationRole.INSTRUCTOR):
                branch = attrs.get("branch")
                if branch is None:
                    raise serializers.ValidationError({"branch": "This account role requires a branch."})
        else:
            raise serializers.ValidationError("You are not authorized to create accounts.")

        return attrs

    def create(self, validated_data):
        password = validated_data.pop("password")
        with transaction.atomic():
            user = User(**validated_data)
            user.set_password(password)
            user.save()
        return user


class ManagedUserUpdateSerializer(serializers.ModelSerializer):
    application_role = serializers.ChoiceField(
        choices=(
            (User.ApplicationRole.BRANCH_ADMIN, "Branch Admin"),
            (User.ApplicationRole.INSTRUCTOR, "Instructor"),
            (User.ApplicationRole.STUDENT, "Student"),
        ),
        required=False,
    )
    branch = serializers.PrimaryKeyRelatedField(
        queryset=Branch.objects.filter(is_active=True),
        required=False,
    )

    class Meta:
        model = User
        fields = (
            "email",
            "first_name",
            "last_name",
            "is_active",
            "application_role",
            "branch",
        )

    def validate(self, attrs):
        actor = self.context["request"].user
        raw_data = cast(Mapping[str, object], self.initial_data)
        instance = cast(User, self.instance)
        role_was_submitted = "application_role" in raw_data
        branch_was_submitted = "branch" in raw_data

        if not actor.is_super_admin() and (role_was_submitted or branch_was_submitted):
            raise serializers.ValidationError(
                "Only Super Admins can change a user's role or branch."
            )

        if actor.is_super_admin():
            role = attrs.get("application_role", instance.application_role)
            branch = attrs.get("branch", instance.branch)

            if role == User.ApplicationRole.INSTRUCTOR and instance.application_role == User.ApplicationRole.STUDENT:
                raise serializers.ValidationError({
                    "application_role": "Existing Students cannot be promoted to Instructors."
                })
            if role == User.ApplicationRole.SUPER_ADMIN and branch is not None:
                raise serializers.ValidationError({
                    "branch": "Super Admin accounts cannot be assigned to a branch."
                })
            if role != User.ApplicationRole.SUPER_ADMIN and branch is None:
                raise serializers.ValidationError({
                    "branch": "This account role requires an assigned branch."
                })

        return attrs
