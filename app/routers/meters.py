from fastapi import APIRouter, status, HTTPException, Path
from sqlalchemy import select
from typing import Annotated
from datetime import timedelta

from schemas import (
    MeterResponse,
    MeterCreate,
    MeterRename,
    MeterUpdate
)
from models import (
    Meter,
    Reading
)

from database import DBSession

router = APIRouter(prefix='/meters')

@router.post('/', response_model= MeterResponse, status_code=status.HTTP_201_CREATED)
async def create_meter(meter: MeterCreate, db: DBSession):

    q = select(Meter).where(Meter.code == meter.code)
    result = await db.execute(q)

    if result.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_409_CONFLICT,
                            detail="meter code already exists")

    new_meter = Meter(**meter.model_dump())

    db.add(new_meter)
    await db.commit()
    await db.refresh(new_meter)
    return new_meter

@router.get('/', response_model=list[MeterResponse])
async def get_meters(db: DBSession):
    result = await db.execute(select(Meter))
    return result.scalars().all()

@router.get('/{meter_id}', response_model=MeterResponse)
async def get_meter(meter_id: int, db: DBSession):
    result = await db.execute(select(Meter).where(Meter.id == meter_id))
    meter = result.scalar_one_or_none()
    if not meter:
        raise HTTPException(status_code=404, detail="meter not found")
    return meter




@router.patch('/{meter_id}', response_model=MeterResponse, status_code=status.HTTP_200_OK)
async def rename_meter(meter_id: Annotated[int, Path(gt=0)], meter: MeterRename,db: DBSession):
    q = select(Meter).where(Meter.id == meter_id)
    result = await db.execute(q)
    existing_meter = result.scalar_one_or_none()
    if not existing_meter:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND,
                            detail="meter not found")

    if meter.code is not None:

        q = select(Meter).where(Meter.code == meter.code, Meter.id != meter_id)
        result = await db.execute(q)

        if result.scalar_one_or_none():
            raise HTTPException(status_code=status.HTTP_409_CONFLICT,
                                detail="meter code already exists")
        
        existing_meter.code = meter.code


    if meter.name is not None:
        existing_meter.name = meter.name

    await db.commit()
    await db.refresh(existing_meter)
    return existing_meter


@router.patch('/{meter_id}/init', response_model=MeterResponse, status_code=status.HTTP_200_OK)
async def init_meter(meter_id: Annotated[int, Path(gt=0)], meter: MeterUpdate, db:DBSession):
    q = select(Meter).where(Meter.id == meter_id)
    result = await db.execute(q)
    existing_meter = result.scalar_one_or_none()

    if not existing_meter:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND,
                            detail="meter not found")

    if existing_meter.last_reading_date is not None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST,
                            detail="meter already initialized")
    existing_meter.last_reading_date = meter.last_reading_date
    existing_meter.last_reading = meter.last_reading

    new_reading = Reading(
        meter_id=meter_id,
        reading=meter.last_reading,
        recorded_at=meter.last_reading_date
    )

    db.add(new_reading)
    await db.commit()
    await db.refresh(existing_meter)

    return existing_meter

@router.delete('/{meter_id}', status_code=status.HTTP_204_NO_CONTENT)
async def delete_meter(meter_id: Annotated[int, Path(gt=0)], db:DBSession):
    q = select(Meter).where(Meter.id == meter_id)
    result = await db.execute(q)
    existing_meter = result.scalar_one_or_none()

    if not existing_meter:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND,
                            detail="meter not found")
    
    await db.delete(existing_meter)
    await db.commit()
