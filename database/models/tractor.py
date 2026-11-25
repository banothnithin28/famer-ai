from datetime import datetime

from sqlalchemy import ForeignKey, Index, TEXT, TIMESTAMP, text
from sqlalchemy.orm import Mapped, mapped_column

from database.models.base import Base, FLOAT_64, INTEGER_64


class TractorJob(Base):
    __tablename__ = "tractor_jobs"
    __table_args__ = (
        Index("idx_tractor_jobs_job_id", "job_id"),
        Index("idx_tractor_jobs_join_token", "join_token"),
        Index("idx_tractor_jobs_farmer", "farmer_id", "status"),
        Index("idx_tractor_jobs_driver", "driver_id", "status"),
        Index("idx_tractor_jobs_date", "work_date"),
        {"sqlite_autoincrement": True},
    )

    id: Mapped[int] = mapped_column(INTEGER_64, primary_key=True, autoincrement=True)
    job_id: Mapped[str] = mapped_column(TEXT, nullable=False, unique=True)
    join_token: Mapped[str] = mapped_column(TEXT, nullable=False, unique=True)
    farmer_id: Mapped[int] = mapped_column(
        INTEGER_64, ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    driver_id: Mapped[int | None] = mapped_column(
        INTEGER_64, ForeignKey("users.id", ondelete="SET NULL")
    )
    driver_name: Mapped[str | None] = mapped_column(TEXT)
    driver_phone: Mapped[str | None] = mapped_column(TEXT)
    tractor_number: Mapped[str | None] = mapped_column(TEXT)
    crop: Mapped[str] = mapped_column(TEXT, nullable=False)
    field_name: Mapped[str] = mapped_column(TEXT, nullable=False)
    work_type: Mapped[str] = mapped_column(TEXT, nullable=False)
    work_date: Mapped[str] = mapped_column(TEXT, nullable=False)
    field_size: Mapped[float | None] = mapped_column(FLOAT_64, server_default=text("0.0"))
    rate: Mapped[float] = mapped_column(FLOAT_64, nullable=False)
    rate_unit: Mapped[str] = mapped_column(
        TEXT, nullable=False, server_default=text("'per_hour'")
    )
    status: Mapped[str] = mapped_column(
        TEXT, nullable=False, server_default=text("'CREATED'")
    )
    total_working_seconds: Mapped[int] = mapped_column(
        INTEGER_64, nullable=False, server_default=text("0")
    )
    calculated_amount: Mapped[float] = mapped_column(
        FLOAT_64, nullable=False, server_default=text("0.0")
    )
    final_amount: Mapped[float] = mapped_column(
        FLOAT_64, nullable=False, server_default=text("0.0")
    )
    expense_id: Mapped[int | None] = mapped_column(
        INTEGER_64, ForeignKey("farm_expenses.id", ondelete="SET NULL")
    )
    notes: Mapped[str | None] = mapped_column(TEXT)
    created_at: Mapped[datetime | None] = mapped_column(
        TIMESTAMP, server_default=text("CURRENT_TIMESTAMP")
    )
    updated_at: Mapped[datetime | None] = mapped_column(
        TIMESTAMP, server_default=text("CURRENT_TIMESTAMP")
    )


class TractorWorkEvent(Base):
    __tablename__ = "tractor_work_events"
    __table_args__ = (
        Index("idx_tractor_events_job", "tractor_job_id", "id"),
        Index("idx_tractor_events_type", "event_type"),
        {"sqlite_autoincrement": True},
    )

    id: Mapped[int] = mapped_column(INTEGER_64, primary_key=True, autoincrement=True)
    tractor_job_id: Mapped[int] = mapped_column(
        INTEGER_64, ForeignKey("tractor_jobs.id", ondelete="CASCADE"), nullable=False
    )
    event_type: Mapped[str] = mapped_column(TEXT, nullable=False)
    performed_by: Mapped[int] = mapped_column(
        INTEGER_64, ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    server_timestamp: Mapped[str] = mapped_column(TEXT, nullable=False)
    notes: Mapped[str | None] = mapped_column(TEXT)
    created_at: Mapped[datetime | None] = mapped_column(
        TIMESTAMP, server_default=text("CURRENT_TIMESTAMP")
    )


class TractorDispute(Base):
    __tablename__ = "tractor_disputes"
    __table_args__ = (
        Index("idx_tractor_disputes_job", "tractor_job_id", "status"),
        {"sqlite_autoincrement": True},
    )

    id: Mapped[int] = mapped_column(INTEGER_64, primary_key=True, autoincrement=True)
    tractor_job_id: Mapped[int] = mapped_column(
        INTEGER_64, ForeignKey("tractor_jobs.id", ondelete="CASCADE"), nullable=False
    )
    raised_by: Mapped[int] = mapped_column(
        INTEGER_64, ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    reason: Mapped[str] = mapped_column(TEXT, nullable=False)
    description: Mapped[str | None] = mapped_column(TEXT)
    status: Mapped[str] = mapped_column(TEXT, nullable=False, server_default=text("'OPEN'"))
    resolution: Mapped[str | None] = mapped_column(TEXT)
    created_at: Mapped[datetime | None] = mapped_column(
        TIMESTAMP, server_default=text("CURRENT_TIMESTAMP")
    )
    resolved_at: Mapped[datetime | None] = mapped_column(TIMESTAMP)
