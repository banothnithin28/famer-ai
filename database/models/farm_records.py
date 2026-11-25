from datetime import datetime

from sqlalchemy import ForeignKey, Index, TEXT, TIMESTAMP, text
from sqlalchemy.orm import Mapped, mapped_column

from database.models.base import Base, FLOAT_64, INTEGER_64


class FarmDiaryEntry(Base):
    __tablename__ = "farm_diary_entries"
    __table_args__ = (
        Index("idx_farm_diary_user_date", "user_id", "date"),
        Index("idx_farm_diary_user_crop", "user_id", "crop"),
        Index("idx_farm_diary_user_act", "user_id", "activity_type"),
        {"sqlite_autoincrement": True},
    )

    id: Mapped[int] = mapped_column(INTEGER_64, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(
        INTEGER_64, ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    date: Mapped[str] = mapped_column(TEXT, nullable=False)
    crop: Mapped[str | None] = mapped_column(TEXT)
    field_name: Mapped[str | None] = mapped_column(TEXT)
    activity_type: Mapped[str] = mapped_column(TEXT, nullable=False)
    description: Mapped[str | None] = mapped_column(TEXT)
    notes: Mapped[str | None] = mapped_column(TEXT)
    photo_path: Mapped[str | None] = mapped_column(TEXT)
    created_at: Mapped[datetime | None] = mapped_column(
        TIMESTAMP, server_default=text("CURRENT_TIMESTAMP")
    )
    updated_at: Mapped[datetime | None] = mapped_column(
        TIMESTAMP, server_default=text("CURRENT_TIMESTAMP")
    )


class FarmExpense(Base):
    __tablename__ = "farm_expenses"
    __table_args__ = (
        Index("idx_farm_expenses_user_date", "user_id", "date"),
        Index("idx_farm_expenses_user_cat", "user_id", "category"),
        Index("idx_farm_expenses_user_crop", "user_id", "crop"),
        Index("idx_farm_expenses_user_bill", "user_id", "bill_number"),
        Index("idx_farm_expenses_user_source", "user_id", "receipt_source"),
        {"sqlite_autoincrement": True},
    )

    id: Mapped[int] = mapped_column(INTEGER_64, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(
        INTEGER_64, ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    date: Mapped[str] = mapped_column(TEXT, nullable=False)
    category: Mapped[str] = mapped_column(TEXT, nullable=False)
    amount: Mapped[float] = mapped_column(FLOAT_64, nullable=False)
    crop: Mapped[str | None] = mapped_column(TEXT)
    field_name: Mapped[str | None] = mapped_column(TEXT)
    description: Mapped[str | None] = mapped_column(TEXT)
    receipt_path: Mapped[str | None] = mapped_column(TEXT)
    bill_number: Mapped[str | None] = mapped_column(TEXT)
    vendor_name: Mapped[str | None] = mapped_column(TEXT)
    vendor_phone: Mapped[str | None] = mapped_column(TEXT)
    vendor_address: Mapped[str | None] = mapped_column(TEXT)
    receipt_source: Mapped[str | None] = mapped_column(
        TEXT, server_default=text("'MANUAL'")
    )
    raw_extracted_json: Mapped[str | None] = mapped_column(TEXT)
    tax: Mapped[float | None] = mapped_column(FLOAT_64, server_default=text("0.0"))
    discount: Mapped[float | None] = mapped_column(FLOAT_64, server_default=text("0.0"))
    payment_method: Mapped[str | None] = mapped_column(TEXT)
    scanned_at: Mapped[datetime | None] = mapped_column(TIMESTAMP)
    created_at: Mapped[datetime | None] = mapped_column(
        TIMESTAMP, server_default=text("CURRENT_TIMESTAMP")
    )
    updated_at: Mapped[datetime | None] = mapped_column(
        TIMESTAMP, server_default=text("CURRENT_TIMESTAMP")
    )


class FarmIncome(Base):
    __tablename__ = "farm_income"
    __table_args__ = (
        Index("idx_farm_income_user_date", "user_id", "date"),
        Index("idx_farm_income_user_crop", "user_id", "crop"),
        {"sqlite_autoincrement": True},
    )

    id: Mapped[int] = mapped_column(INTEGER_64, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(
        INTEGER_64, ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    date: Mapped[str] = mapped_column(TEXT, nullable=False)
    crop: Mapped[str] = mapped_column(TEXT, nullable=False)
    quantity: Mapped[float] = mapped_column(FLOAT_64, nullable=False)
    unit: Mapped[str] = mapped_column(TEXT, nullable=False, server_default=text("'kg'"))
    selling_price: Mapped[float] = mapped_column(FLOAT_64, nullable=False)
    total_amount: Mapped[float] = mapped_column(FLOAT_64, nullable=False)
    buyer_name: Mapped[str | None] = mapped_column(TEXT)
    notes: Mapped[str | None] = mapped_column(TEXT)
    created_at: Mapped[datetime | None] = mapped_column(
        TIMESTAMP, server_default=text("CURRENT_TIMESTAMP")
    )
    updated_at: Mapped[datetime | None] = mapped_column(
        TIMESTAMP, server_default=text("CURRENT_TIMESTAMP")
    )
