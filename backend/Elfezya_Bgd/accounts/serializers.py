# accounts/serializers.py
from rest_framework import serializers
from django.contrib.auth import get_user_model

User = get_user_model()


class LoginSerializer(serializers.Serializer):
    """
    Login serializer that accepts either email OR username
    """
    identifier = serializers.CharField(
        required=True,
        help_text="Email address or username"
    )
    password = serializers.CharField(
        write_only=True,
        required=True,
        style={'input_type': 'password'}
    )

    def validate_identifier(self, value):
        """Clean and normalize the identifier"""
        return value.strip()


class UserSerializer(serializers.ModelSerializer):
    """Serializer for returning user info (no password)."""
    full_name = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            "id",
            "username",
            "email",
            "first_name",
            "middle_name",
            "last_name",
            "full_name",
            "phone",
            "national_id",
            "gender",
            "grade",
            "division",
            "parent_email",
            "parent_phone",
            "governorate",
            "city",
            "parent_job",
            "role",
        ]
        read_only_fields = ["id", "username", "role"]

    def get_full_name(self, obj):
        """Return full name of user"""
        return obj.full_name()


class SignupSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=6)
    password_confirm = serializers.CharField(write_only=True, required=False)

    class Meta:
        model = User
        fields = [
            "first_name",
            "middle_name",
            "last_name",
            "email",
            "phone",
            "national_id",
            "gender",
            "grade",
            "division",
            "parent_email",
            "parent_phone",
            "governorate",
            "city",
            "parent_job",
            "password",
            "password_confirm",
        ]

    def validate_email(self, value):
        """Ensure email is unique"""
        if User.objects.filter(email__iexact=value).exists():
            raise serializers.ValidationError("هذا البريد الإلكتروني مسجل بالفعل.")
        return value.lower()

    def validate(self, attrs):
        """Validate password confirmation if provided"""
        pw = attrs.get("password")
        pwc = attrs.pop("password_confirm", None)

        if pwc is not None and pw != pwc:
            raise serializers.ValidationError({
                "password_confirm": "كلمات المرور غير متطابقة."
            })

        return attrs

    def create(self, validated_data):
        """Create user with proper username generation"""
        email = validated_data.get("email", "")
        password = validated_data.pop("password")

        # Generate username from email
        base_username = email.split("@")[0] if email else "user"
        username = base_username

        # Ensure username is unique
        counter = 1
        while User.objects.filter(username=username).exists():
            username = f"{base_username}{counter}"
            counter += 1

        # Create user
        user = User(**validated_data)
        user.username = username
        user.set_password(password)
        user.save()

        return user