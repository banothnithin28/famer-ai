from datetime import datetime

from sqlalchemy import ForeignKey, Index, Integer, TEXT, TIMESTAMP, text
from sqlalchemy.orm import Mapped, mapped_column

from database.models.base import Base, FLOAT_64, INTEGER_64


class LabourJob(Base):
    __tablename__ = "labour_jobs"
    __table_args__ = (
        Index("idx_labour_jobs_job_id", "job_id"),
        Index("idx_labour_jobs_join_token", "join_token"),
        Index("idx_labour_jobs_farmer", "farmer_id", "status"),
        Index("idx_labour_jobs_worker", "worker_id", "status"),
        Index("idx_labour_jobs_date", "work_date"),
        {"sqlite_autoincrement": True},
    )

    id: Mapped[int] = mapped_column(INTEGER_64, primary_key=True, autoincrement=True)
    job_id: Mapped[str] = mapped_column(TEXT, nullable=False, unique=True)
    join_token: Mapped[str] = mapped_column(TEXT, nullable=False, unique=True)
    farmer_id: Mapped[int] = mapped_column(
        INTEGER_64, ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    worker_id: Mapped[int | None] = mapped_column(
        INTEGER_64, ForeignKey("users.id", ondelete="SET NULL")
    )
    worker_name: Mapped[str] = mapped_column(TEXT, nullable=False)
    worker_phone: Mapped[str | None] = mapped_column(TEXT)
    work_type: Mapped[str] = mapped_column(TEXT, nullable=False)
    crop: Mapped[str] = mapped_column(TEXT, nullable=False)
    field_name: Mapped[str] = mapped_column(TEXT, nullable=False)
    work_date: Mapped[str] = mapped_column(TEXT, nullable=False)
    expected_start_date: Mapped[str | None] = mapped_column(TEXT)
    expected_end_date: Mapped[str | None] = mapped_column(TEXT)
    payment_type: Mapped[str] = mapped_column(
        TEXT, nullable=False, server_default=text("'per_day'")
    )
    rate: Mapped[float] = mapped_column(FLOAT_64, nullable=False)
    num_workers: Mapped[int] = mapped_column(
        Integer, nullable=False, server_default=text("1")
    )
    status: Mapped[str] = mapped_column(
        TEXT, nullable=False, server_default=text("'CREATED'")
    )
    farmer_agreed: Mapped[int] = mapped_column(
        Integer, nullable=False, server_default=text("0")
    )
    worker_agreed: Mapped[int] = mapped_column(
        Integer, nullable=False, server_default=text("0")
    )
    farmer_confirmed: Mapped[int] = mapped_column(
        Integer, nullable=False, server_default=text("0")
    )
    worker_confirmed: Mapped[int] = mapped_column(
        Integer, nullable=False, server_default=text("0")
    )
    total_working_seconds: Mapped[int] = mapped_column(
        INTEGER_64, nullable=False, server_default=text("0")
    )
    total_days_worked: Mapped[float] = mapped_column(
        FLOAT_64, nullable=False, server_default=text("0.0")
    )
    total_earned: Mapped[float] = mapped_column(
        FLOAT_64, nullable=False, server_default=text("0.0")
    )
    total_paid: Mapped[float] = mapped_column(
        FLOAT_64, nullable=False, server_default=text("0.0")
    )
    total_advance: Mapped[float] = mapped_column(
        FLOAT_64, nullable=False, server_default=text("0.0")
    )
    pending_amount: Mapped[float] = mapped_column(
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


class LabourWorker(Base):
    __tablename__ = "labour_workers"
    __table_args__ = (
        Index("idx_labour_workers_job", "labour_job_id"),
        {"sqlite_autoincrement": True},
    )

    id: Mapped[int] = mapped_column(INTEGER_64, primary_key=True, autoincrement=True)
    labour_job_id: Mapped[int] = mapped_column(
        INTEGER_64, ForeignKey("labour_jobs.id", ondelete="CASCADE"), nullable=False
    )
    user_id: Mapped[int | None] = mapped_column(
        INTEGER_64, ForeignKey("users.id", ondelete="SET NULL")
    )
    name: Mapped[str] = mapped_column(TEXT, nullable=False)
    phone: Mapped[str | None] = mapped_column(TEXT)
    role: Mapped[str | None] = mapped_column(TEXT, server_default=text("'worker'"))
    total_days: Mapped[float | None] = mapped_column(FLOAT_64, server_default=text("0.0"))
    total_hours: Mapped[float | None] = mapped_column(FLOAT_64, server_default=text("0.0"))
    total_earned: Mapped[float | None] = mapped_column(FLOAT_64, server_default=text("0.0"))
    total_paid: Mapped[float | None] = mapped_column(FLOAT_64, server_default=text("0.0"))
    total_advance: Mapped[float | None] = mapped_column(FLOAT_64, server_default=text("0.0"))
    pending_amount: Mapped[float | None] = mapped_column(FLOAT_64, server_default=text("0.0"))
    status: Mapped[str | None] = mapped_column(TEXT, server_default=text("'ACTIVE'"))
    created_at: Mapped[datetime | None] = mapped_column(
        TIMESTAMP, server_default=text("CURRENT_TIMESTAMP")
    )


class LabourAttendance(Base):
    __tablename__ = "labour_attendance"
    __table_args__ = (
        Index(
            "idx_labour_attendance_unique",
            "labour_job_id",
            "worker_name",
            "date",
            unique=True,
        ),
        Index("idx_labour_attendance_date", "date"),
        {"sqlite_autoincrement": True},
    )

    id: Mapped[int] = mapped_column(INTEGER_64, primary_key=True, autoincrement=True)
    labour_job_id: Mapped[int] = mapped_column(
        INTEGER_64, ForeignKey("labour_jobs.id", ondelete="CASCADE"), nullable=False
    )
    worker_id: Mapped[int | None] = mapped_column(
        INTEGER_64, ForeignKey("labour_workers.id", ondelete="CASCADE")
    )
    worker_name: Mapped[str] = mapped_column(TEXT, nullable=False)
    date: Mapped[str] = mapped_column(TEXT, nullable=False)
    status: Mapped[str] = mapped_column(TEXT, nullable=False)
    day_fraction: Mapped[float] = mapped_column(
        FLOAT_64, nullable=False, server_default=text("1.0")
    )
    hours_worked: Mapped[float | None] = mapped_column(FLOAT_64, server_default=text("0.0"))
    rate_applied: Mapped[float] = mapped_column(FLOAT_64, nullable=False)
    wage_amount: Mapped[float] = mapped_column(FLOAT_64, nullable=False)
    notes: Mapped[str | None] = mapped_column(TEXT)
    created_by: Mapped[int] = mapped_column(
        INTEGER_64, ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    created_at: Mapped[datetime | None] = mapped_column(
        TIMESTAMP, server_default=text("CURRENT_TIMESTAMP")
    )


class LabourWorkSession(Base):
    __tablename__ = "labour_work_sessions"
    __table_args__ = {"sqlite_autoincrement": True}

    id: Mapped[int] = mapped_column(INTEGER_64, primary_key=True, autoincrement=True)
    labour_job_id: Mapped[int] = mapped_column(
        INTEGER_64, ForeignKey("labour_jobs.id", ondelete="CASCADE"), nullable=False
    )
    session_type: Mapped[str] = mapped_column(
        TEXT, nullable=False, server_default=text("'HOURLY_WORK'")
    )
    start_time: Mapped[str] = mapped_column(TEXT, nullable=False)
    end_time: Mapped[str | None] = mapped_column(TEXT)
    duration_seconds: Mapped[int | None] = mapped_column(
        INTEGER_64, server_default=text("0")
    )
    status: Mapped[str] = mapped_column(
        TEXT, nullable=False, server_default=text("'RUNNING'")
    )
    created_at: Mapped[datetime | None] = mapped_column(
        TIMESTAMP, server_default=text("CURRENT_TIMESTAMP")
    )


class LabourBreak(Base):
    __tablename__ = "labour_breaks"
    __table_args__ = {"sqlite_autoincrement": True}

    id: Mapped[int] = mapped_column(INTEGER_64, primary_key=True, autoincrement=True)
    labour_job_id: Mapped[int] = mapped_column(
        INTEGER_64, ForeignKey("labour_jobs.id", ondelete="CASCADE"), nullable=False
    )
    session_id: Mapped[int | None] = mapped_column(
        INTEGER_64, ForeignKey("labour_work_sessions.id", ondelete="CASCADE")
    )
    start_time: Mapped[str] = mapped_column(TEXT, nullable=False)
    end_time: Mapped[str | None] = mapped_column(TEXT)
    duration_seconds: Mapped[int | None] = mapped_column(
        INTEGER_64, server_default=text("0")
    )
    reason: Mapped[str | None] = mapped_column(TEXT)
    created_at: Mapped[datetime | None] = mapped_column(
        TIMESTAMP, server_default=text("CURRENT_TIMESTAMP")
    )


class LabourWorkEvent(Base):
    __tablename__ = "labour_work_events"
    __table_args__ = (
        Index("idx_labour_events_job", "labour_job_id", "id"),
        Index("idx_labour_events_type", "event_type"),
        {"sqlite_autoincrement": True},
    )

    id: Mapped[int] = mapped_column(INTEGER_64, primary_key=True, autoincrement=True)
    labour_job_id: Mapped[int] = mapped_column(
        INTEGER_64, ForeignKey("labour_jobs.id", ondelete="CASCADE"), nullable=False
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


class LabourPayment(Base):
    __tablename__ = "labour_payments"
    __table_args__ = (
        Index("idx_labour_payments_job", "labour_job_id"),
        Index("idx_labour_payments_farmer", "farmer_id"),
        {"sqlite_autoincrement": True},
    )

    id: Mapped[int] = mapped_column(INTEGER_64, primary_key=True, autoincrement=True)
    labour_job_id: Mapped[int] = mapped_column(
        INTEGER_64, ForeignKey("labour_jobs.id", ondelete="CASCADE"), nullable=False
    )
    worker_id: Mapped[int | None] = mapped_column(
        INTEGER_64, ForeignKey("labour_workers.id", ondelete="SET NULL")
    )
    worker_name: Mapped[str] = mapped_column(TEXT, nullable=False)
    farmer_id: Mapped[int] = mapped_column(
        INTEGER_64, ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    amount: Mapped[float] = mapped_column(FLOAT_64, nullable=False)
    payment_date: Mapped[str] = mapped_column(TEXT, nullable=False)
    payment_method: Mapped[str] = mapped_column(
        TEXT, nullable=False, server_default=text("'Cash'")
    )
    reference_no: Mapped[str | None] = mapped_column(TEXT)
    notes: Mapped[str | None] = mapped_column(TEXT)
    created_at: Mapped[datetime | None] = mapped_column(
        TIMESTAMP, server_default=text("CURRENT_TIMESTAMP")
    )


class LabourAdvance(Base):
    __tablename__ = "labour_advances"
    __table_args__ = (
        Index("idx_labour_advances_job", "labour_job_id"),
        Index("idx_labour_advances_farmer", "farmer_id"),
        {"sqlite_autoincrement": True},
    )

    id: Mapped[int] = mapped_column(INTEGER_64, primary_key=True, autoincrement=True)
    labour_job_id: Mapped[int] = mapped_column(
        INTEGER_64, ForeignKey("labour_jobs.id", ondelete="CASCADE"), nullable=False
    )
    worker_id: Mapped[int | None] = mapped_column(
        INTEGER_64, ForeignKey("labour_workers.id", ondelete="SET NULL")
    )
    worker_name: Mapped[str] = mapped_column(TEXT, nullable=False)
    farmer_id: Mapped[int] = mapped_column(
        INTEGER_64, ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    amount: Mapped[float] = mapped_column(FLOAT_64, nullable=False)
    advance_date: Mapped[str] = mapped_column(TEXT, nullable=False)
    payment_method: Mapped[str] = mapped_column(
        TEXT, nullable=False, server_default=text("'Cash'")
    )
    reference_no: Mapped[str | None] = mapped_column(TEXT)
    notes: Mapped[str | None] = mapped_column(TEXT)
    created_at: Mapped[datetime | None] = mapped_column(
        TIMESTAMP, server_default=text("CURRENT_TIMESTAMP")
    )


class LabourDispute(Base):
    __tablename__ = "labour_disputes"
    __table_args__ = (
        Index("idx_labour_disputes_job", "labour_job_id", "status"),
        {"sqlite_autoincrement": True},
    )

    id: Mapped[int] = mapped_column(INTEGER_64, primary_key=True, autoincrement=True)
    labour_job_id: Mapped[int] = mapped_column(
        INTEGER_64, ForeignKey("labour_jobs.id", ondelete="CASCADE"), nullable=False
    )
    raised_by: Mapped[int] = mapped_column(
        INTEGER_64, ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    reason: Mapped[str] = mapped_column(TEXT, nullable=False)
    description: Mapped[str | None] = mapped_column(TEXT)
    evidence_text: Mapped[str | None] = mapped_column(TEXT)
    status: Mapped[str] = mapped_column(TEXT, nullable=False, server_default=text("'OPEN'"))
    resolution: Mapped[str | None] = mapped_column(TEXT)
    created_at: Mapped[datetime | None] = mapped_column(
        TIMESTAMP, server_default=text("CURRENT_TIMESTAMP")
    )
    resolved_at: Mapped[datetime | None] = mapped_column(TIMESTAMP)


class LabourAgreement(Base):
    __tablename__ = "labour_agreements"
    __table_args__ = (
        Index("idx_labour_agreements_job", "labour_job_id"),
        {"sqlite_autoincrement": True},
    )

    id: Mapped[int] = mapped_column(INTEGER_64, primary_key=True, autoincrement=True)
    labour_job_id: Mapped[int] = mapped_column(
        INTEGER_64, ForeignKey("labour_jobs.id", ondelete="CASCADE"), nullable=False
    )
    farmer_id: Mapped[int] = mapped_column(
        INTEGER_64, ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    worker_id: Mapped[int | None] = mapped_column(
        INTEGER_64, ForeignKey("users.id", ondelete="SET NULL")
    )
    terms_summary: Mapped[str] = mapped_column(TEXT, nullable=False)
    farmer_agreed_at: Mapped[datetime | None] = mapped_column(TIMESTAMP)
    worker_agreed_at: Mapped[datetime | None] = mapped_column(TIMESTAMP)
    status: Mapped[str] = mapped_column(
        TEXT, nullable=False, server_default=text("'PENDING'")
    )
    created_at: Mapped[datetime | None] = mapped_column(
        TIMESTAMP, server_default=text("CURRENT_TIMESTAMP")
    )
