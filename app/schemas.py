from pydantic import BaseModel, Field, ConfigDict
from datetime import date, datetime


class MeterCreate(BaseModel):
    code: str = Field(min_length=7, max_length=8)
    name: str = Field(min_length=2, max_length=30)

class MeterUpdate(BaseModel):
    last_reading: int = Field(gt=0)
    last_reading_date: datetime = Field()

# added to avoid confusion as same schema will be used to update name/code in routers/meters.py
class MeterRename(BaseModel):
    code: str | None = Field(min_length=7, max_length=8, default=None)
    name: str | None = Field(min_length=2, max_length=30, default=None)

class MeterResponse(MeterCreate):
    model_config = ConfigDict(
        from_attributes=True
    )

    id: int = Field()
    last_reading: int | None = None
    last_reading_date: datetime | None = None


class ReadingCreate(BaseModel):
    meter_id : int = Field(gt=0)
    reading : int = Field(gt=0)
    recorded_at : datetime


class ReadingResponse(ReadingCreate):
    model_config = ConfigDict(
        from_attributes=True
    )
    id: int = Field()
    recorded_at : datetime = Field()



