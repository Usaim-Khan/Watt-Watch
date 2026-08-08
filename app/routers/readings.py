from fastapi import APIRouter, status, HTTPException, Path, Query
from sqlalchemy import select
from typing import Annotated
from datetime import  date

from models import Reading, Meter
from schemas import ReadingResponse, ReadingCreate
from database import DBSession

router = APIRouter(prefix='/readings')

@router.post('/', response_model=ReadingResponse, status_code=status.HTTP_201_CREATED)
async def create_reading(reading: ReadingCreate, db: DBSession):
    meter = await db.execute(select(Meter).where(Meter.id == reading.meter_id))
    meter = meter.scalar_one_or_none()
    if meter is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND,
                            detail="meter not found")

    latest_reading = await db.execute(select(Reading).where(Reading.meter_id == reading.meter_id).order_by(Reading.recorded_at.desc()).limit(1))
    latest_reading = latest_reading.scalar_one_or_none()


    if latest_reading and (reading.reading < latest_reading.reading or reading.reading < meter.last_reading):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST,
                            detail="reading must be greater than the latest reading")

    if latest_reading and (reading.recorded_at < latest_reading.recorded_at or reading.recorded_at < meter.last_reading_date):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST,
                            detail="recorded_at must be greater than the latest reading's recorded_at")

    new_reading = Reading(**reading.model_dump(exclude_none=True))
    db.add(new_reading)
    await db.commit()
    await db.refresh(new_reading)

    return new_reading

@router.get('/', response_model=list[list[ReadingResponse]], status_code=status.HTTP_200_OK)
async def all_readings(db:DBSession, limit: Annotated[int, Query(gt=0)] = 5):

    meters = (await db.execute(select(Meter))).scalars().all()
    result = []
    for meter in meters:
        q = select(Reading).where(Reading.meter_id == meter.id).order_by(Reading.recorded_at.desc()).limit(limit)

        readings = await db.execute(q)
        result.append(readings.scalars().all())

    return result


@router.get('/{meter_id}', response_model=list[ReadingResponse])
async def meter_reading(db:DBSession,
                        meter_id: Annotated[int, Path(gt=0)],
                        start_date : Annotated[date|None, Query()] = None, end_date: Annotated[date|None, Query()] = None):

    
    q = select(Meter).where(Meter.id == meter_id)
    result = await db.execute(q)
    existing_meter = result.scalar_one_or_none()
    if not existing_meter:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND,
                            detail="meter not found")


    if start_date and end_date and start_date > end_date:
        raise HTTPException(
            status_code=400,
            detail="start_date must be before end_date"
        )
    q = select(Reading).where(Reading.meter_id == meter_id).order_by(Reading.recorded_at.desc())

    if start_date:
        q = q.where(Reading.recorded_at >= start_date)
    if end_date:
        q = q.where(Reading.recorded_at <= end_date)

    readings = await db.execute(q)
    readings = readings.scalars().all()
    return readings






        