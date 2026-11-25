from datetime import datetime

from sqlalchemy import ForeignKey, Index, Integer, TEXT, TIMESTAMP, text
from sqlalchemy.orm import Mapped, mapped_column

from database.models.base import Base, FLOAT_64, INTEGER_64


class User(Base):
    __tablename__ = "users"
    __table_args__ = {"sqlite_autoincrement": True}

    id: Mapped[int] = mapped_column(INTEGER_64, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(TEXT, nullable=False)
    email: Mapped[str] = mapped_column(TEXT, nullable=False, unique=True)
    password_hash: Mapped[str] = mapped_column(TEXT, nullable=False)
    location: Mapped[str] = mapped_column(
        TEXT, nullable=False, server_default=text("'Telangana'")
    )
    language: Mapped[str] = mapped_column(TEXT, nullable=False, server_default=text("'en'"))
    created_at: Mapped[datetime | None] = mapped_column(
        TIMESTAMP, server_default=text("CURRENT_TIMESTAMP")
    )
    last_login_at: Mapped[datetime | None] = mapped_column(TIMESTAMP)


class FarmerProfile(Base):
    __tablename__ = "farmer_profiles"

    user_id: Mapped[int] = mapped_column(
        INTEGER_64, ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )
    farm_size_acres: Mapped[float | None] = mapped_column(
        FLOAT_64, server_default=text("5.0")
    )
    soil_type: Mapped[str | None] = mapped_column(TEXT, server_default=text("'Black'"))
    primary_crop: Mapped[str | None] = mapped_column(TEXT, server_default=text("'Cotton'"))


class PasswordResetOtp(Base):
    __tablename__ = "password_reset_otps"
    __table_args__ = (
        Index("idx_password_reset_otps_user", "user_id", "is_used"),
        Index("idx_password_reset_otps_email", "email", "is_used"),
        {"sqlite_autoincrement": True},
    )

    id: Mapped[int] = mapped_column(INTEGER_64, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(
        INTEGER_64, ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    email: Mapped[str] = mapped_column(TEXT, nullable=False)
    otp_hash: Mapped[str] = mapped_column(TEXT, nullable=False)
    created_at: Mapped[datetime | None] = mapped_column(
        TIMESTAMP, server_default=text("CURRENT_TIMESTAMP")
    )
    expires_at: Mapped[datetime] = mapped_column(TIMESTAMP, nullable=False)
    verification_attempts: Mapped[int] = mapped_column(
        Integer, nullable=False, server_default=text("0")
    )
    max_attempts: Mapped[int] = mapped_column(
        Integer, nullable=False, server_default=text("5")
    )
    is_used: Mapped[int] = mapped_column(
        Integer, nullable=False, server_default=text("0")
    )
    used_at: Mapped[datetime | None] = mapped_column(TIMESTAMP)
    reset_token_hash: Mapped[str | None] = mapped_column(TEXT)
    reset_token_expires_at: Mapped[datetime | None] = mapped_column(TIMESTAMP)


class UserSession(Base):
    __tablename__ = "user_sessions"
    __table_args__ = (
        Index("idx_user_sessions_lookup", "session_token_hash", "is_active"),
        Index("idx_user_sessions_user", "user_id", "is_active"),
        {"sqlite_autoincrement": True},
    )

    id: Mapped[int] = mapped_column(INTEGER_64, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(
        INTEGER_64, ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    session_token_hash: Mapped[str] = mapped_column(TEXT, nullable=False, unique=True)
    ip_address: Mapped[str | None] = mapped_column(TEXT)
    user_agent: Mapped[str | None] = mapped_column(TEXT)
    created_at: Mapped[datetime | None] = mapped_column(
        TIMESTAMP, server_default=text("CURRENT_TIMESTAMP")
    )
    expires_at: Mapped[datetime] = mapped_column(TIMESTAMP, nullable=False)
    last_activity_at: Mapped[datetime | None] = mapped_column(
        TIMESTAMP, server_default=text("CURRENT_TIMESTAMP")
    )
    is_active: Mapped[int] = mapped_column(
        Integer, nullable=False, server_default=text("1")
    )
    revoked_at: Mapped[datetime | None] = mapped_column(TIMESTAMP)
