from fastapi import APIRouter, status, HTTPException, Path
from sqlalchemy import select
from typing import Annotated
from datetime import timedelta, datetime, timezone

from schemas import (
    MeterResponse,
    MeterCreate,
    MeterRename,
    MeterUpdate
)
from models import (
    Meter,
    Reading,
    BillingPeriod
)

from database import DBSession


def ensure_25_days_passed(m: Meter):

    if datetime.now(timezone.utc) -  m.last_reading_date < timedelta(days=25):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail= f"month is reset after atleast 25 days. Last rest was: {m.last_reading_date.strftime("%d %B %Y")}")


router = APIRouter(prefix='/period')

@router.post('/end-month', status_code=status.HTTP_204_NO_CONTENT)
async def end_month(db:DBSession):
    meters = (await db.execute(select(Meter))).scalars().all()

    if len(meters) == 0:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND,
                             detail = "no meters found")

    ensure_25_days_passed(meters[0])

    for meter in meters:
        
        latest_reading = (await db.execute(select(Reading).
                                         where(Reading.meter_id == meter.id).order_by(Reading.recorded_at.desc()).limit(1))).scalar_one_or_none()
        if latest_reading is None:
            continue

        # Ensure the meter has been initialized
        if meter.last_reading is None or meter.last_reading_date is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Meter {meter.name} ({meter.code}) has not been initialized."
            )

        # Validate reading
        if latest_reading.reading <= meter.last_reading:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Latest reading is less than or equal to the last reading for meter: {meter.name} ({meter.code})"
            )


        # Validate date
        if latest_reading.recorded_at <= meter.last_reading_date:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Latest reading date is less than or equal to the last reading date for meter: {meter.name} ({meter.code})"
            )

        new_period = BillingPeriod(
            meter_id=meter.id,
            start_date=meter.last_reading_date,
            end_date=latest_reading.recorded_at,
            start_reading=meter.last_reading,
            end_reading=latest_reading.reading,
            units_consumed=latest_reading.reading - meter.last_reading,
        )

        meter.last_reading = latest_reading.reading
        meter.last_reading_date = latest_reading.recorded_at

        db.add(new_period)

    await db.commit()

    return 



@router.get('/', status_code=200)
async def get_billing_periods(db: DBSession):
    result = await db.execute(
        select(BillingPeriod).order_by(BillingPeriod.end_date.desc())
    )
    return result.scalars().all()
