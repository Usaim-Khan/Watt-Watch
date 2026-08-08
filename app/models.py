from datetime import datetime, date
from sqlalchemy.orm import mapped_column, Mapped, DeclarativeBase, relationship
from sqlalchemy import DateTime, func, ForeignKey, Date
from database import Base

class Meter(Base):
    __tablename__ = 'meters'

    id : Mapped[int] = mapped_column(primary_key=True)
    code : Mapped[str] = mapped_column(nullable=False, unique=True)
    name : Mapped[str] = mapped_column(nullable=False)
    last_reading : Mapped[int] = mapped_column(nullable=True)
    last_reading_date : Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=True)


    readings: Mapped[list["Reading"]] = relationship(
        back_populates="meter",
        cascade="all, delete-orphan",
        passive_deletes=True
    )

    billing_periods: Mapped[list["BillingPeriod"]] = relationship(
        back_populates="meter",
        cascade="all, delete-orphan",
        passive_deletes=True
    )

class Reading(Base):
    __tablename__ = 'readings'

    id : Mapped[int] = mapped_column(primary_key=True)
    meter_id : Mapped[int] = mapped_column(ForeignKey('meters.id', ondelete="CASCADE"), index=True)
    reading: Mapped[int] = mapped_column(nullable=False)
    recorded_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now())

    meter : Mapped["Meter"] = relationship(back_populates="readings")

class BillingPeriod(Base):
    __tablename__ = 'billing_periods'

    id : Mapped[int] = mapped_column(primary_key=True)
    meter_id : Mapped[int] = mapped_column(ForeignKey('meters.id', ondelete="CASCADE"), index=True)
    start_date : Mapped[date] = mapped_column(Date, nullable=False)
    end_date : Mapped[date] = mapped_column(Date, nullable=False)
    start_reading : Mapped[int] = mapped_column(nullable=False)
    end_reading : Mapped[int] = mapped_column(nullable=False)
    units_consumed: Mapped[int] = mapped_column(nullable=False)

    meter: Mapped["Meter"] = relationship(back_populates='billing_periods')

