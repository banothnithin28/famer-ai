from datetime import datetime

from sqlalchemy import ForeignKey, Integer, TEXT, TIMESTAMP, text
from sqlalchemy.orm import Mapped, mapped_column

from database.models.base import Base, INTEGER_64


class CropRecommendation(Base):
    __tablename__ = "crop_recommendations"
    __table_args__ = {"sqlite_autoincrement": True}

    id: Mapped[int] = mapped_column(INTEGER_64, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(
        INTEGER_64, ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    soil_type: Mapped[str] = mapped_column(TEXT, nullable=False)
    season: Mapped[str] = mapped_column(TEXT, nullable=False)
    water_availability: Mapped[str] = mapped_column(TEXT, nullable=False)
    previous_crop: Mapped[str] = mapped_column(TEXT, nullable=False)
    location: Mapped[str] = mapped_column(TEXT, nullable=False)
    recommended_crop: Mapped[str] = mapped_column(TEXT, nullable=False)
    confidence: Mapped[int] = mapped_column(Integer, nullable=False)
    reason: Mapped[str] = mapped_column(TEXT, nullable=False)
    created_at: Mapped[datetime | None] = mapped_column(
        TIMESTAMP, server_default=text("CURRENT_TIMESTAMP")
    )


class Plant(Base):
    __tablename__ = "plants"
    __table_args__ = {"sqlite_autoincrement": True}

    id: Mapped[int] = mapped_column(INTEGER_64, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(
        INTEGER_64, ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    crop_name: Mapped[str] = mapped_column(TEXT, nullable=False)
    field_name: Mapped[str] = mapped_column(TEXT, nullable=False)
    location: Mapped[str] = mapped_column(TEXT, nullable=False)
    notes: Mapped[str | None] = mapped_column(TEXT)
    created_at: Mapped[datetime | None] = mapped_column(
        TIMESTAMP, server_default=text("CURRENT_TIMESTAMP")
    )


class DiseaseScan(Base):
    __tablename__ = "disease_scans"
    __table_args__ = {"sqlite_autoincrement": True}

    id: Mapped[int] = mapped_column(INTEGER_64, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(
        INTEGER_64, ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    plant_id: Mapped[int | None] = mapped_column(
        INTEGER_64, ForeignKey("plants.id", ondelete="SET NULL")
    )
    image_name: Mapped[str] = mapped_column(TEXT, nullable=False)
    disease_name: Mapped[str] = mapped_column(TEXT, nullable=False)
    confidence: Mapped[int] = mapped_column(Integer, nullable=False)
    severity: Mapped[str] = mapped_column(
        TEXT, nullable=False, server_default=text("'Unknown'")
    )
    symptoms: Mapped[str | None] = mapped_column(TEXT)
    suggestions_json: Mapped[str] = mapped_column(TEXT, nullable=False)
    created_at: Mapped[datetime | None] = mapped_column(
        TIMESTAMP, server_default=text("CURRENT_TIMESTAMP")
    )


class Alert(Base):
    __tablename__ = "alerts"
    __table_args__ = {"sqlite_autoincrement": True}

    id: Mapped[int] = mapped_column(INTEGER_64, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(
        INTEGER_64, ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    plant_id: Mapped[int | None] = mapped_column(
        INTEGER_64, ForeignKey("plants.id", ondelete="SET NULL")
    )
    status: Mapped[str] = mapped_column(TEXT, nullable=False)
    message: Mapped[str] = mapped_column(TEXT, nullable=False)
    read: Mapped[int] = mapped_column(
        "read", Integer, nullable=False, server_default=text("0")
    )
    created_at: Mapped[datetime | None] = mapped_column(
        TIMESTAMP, server_default=text("CURRENT_TIMESTAMP")
    )


class IrrigationLog(Base):
    __tablename__ = "irrigation_logs"
    __table_args__ = {"sqlite_autoincrement": True}

    id: Mapped[int] = mapped_column(INTEGER_64, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(
        INTEGER_64, ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    crop_type: Mapped[str] = mapped_column(TEXT, nullable=False)
    moisture_pct: Mapped[int] = mapped_column(Integer, nullable=False)
    weather_condition: Mapped[str] = mapped_column(TEXT, nullable=False)
    water_req: Mapped[str] = mapped_column(TEXT, nullable=False)
    suggestion: Mapped[str] = mapped_column(TEXT, nullable=False)
    created_at: Mapped[datetime | None] = mapped_column(
        TIMESTAMP, server_default=text("CURRENT_TIMESTAMP")
    )


class DecisionScore(Base):
    __tablename__ = "decision_scores"
    __table_args__ = {"sqlite_autoincrement": True}

    id: Mapped[int] = mapped_column(INTEGER_64, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(
        INTEGER_64, ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    crop_name: Mapped[str] = mapped_column(TEXT, nullable=False)
    overall_score: Mapped[int] = mapped_column(Integer, nullable=False)
    soil_score: Mapped[int] = mapped_column(Integer, nullable=False)
    weather_score: Mapped[int] = mapped_column(Integer, nullable=False)
    water_score: Mapped[int] = mapped_column(Integer, nullable=False)
    crop_score: Mapped[int] = mapped_column(Integer, nullable=False)
    created_at: Mapped[datetime | None] = mapped_column(
        TIMESTAMP, server_default=text("CURRENT_TIMESTAMP")
    )
