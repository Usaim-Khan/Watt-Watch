from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routers import meters, readings, billing_period
from contextlib import asynccontextmanager
from database import engine, Base, DBSession
from models import *
from sqlalchemy import text

@asynccontextmanager
async def lifespan(app: FastAPI):
    print("Lifespan started!")

    async with engine.begin() as conn:
        print(Base.metadata.tables.keys())
        await conn.run_sync(Base.metadata.create_all)

    yield



app = FastAPI(lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(meters.router, tags=["meters"])
app.include_router(readings.router, tags =["readings"])
app.include_router(billing_period.router, tags =["billing_periods"])


@app.get("/health/db")
async def check_db(db: DBSession):
    try:
        result = await db.execute(text("SELECT 1"))
        return {"db_status": "connected", "result": result.scalar()}
    except Exception as e:
        return {"db_status": "disconnected", "error": str(e)}


