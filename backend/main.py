import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from database import engine, Base
from seed import seed
from routers import auth, jobs, technicians, shifts, staff

# Create tables on startup
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="FixFlow CRM API",
    description="Field Service & Appliance Repair Management Engine (FastAPI + Python)",
    version="2.0.0"
)

# Enable CORS for local dev and production web/mobile clients
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Serve uploaded photos statically
uploads_dir = os.path.join(os.path.dirname(__file__), "uploads")
os.makedirs(uploads_dir, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=uploads_dir), name="uploads")

# Include Routers
app.include_router(auth.router)
app.include_router(jobs.router)
app.include_router(technicians.router)
app.include_router(shifts.router)
app.include_router(staff.router)

def migrate_db():
    try:
        from sqlalchemy import inspect, text
        with engine.connect() as conn:
            inspector = inspect(engine)
            columns = [c["name"] for c in inspector.get_columns("jobs")]
            if "photos" not in columns:
                conn.execute(text("ALTER TABLE jobs ADD COLUMN photos JSON DEFAULT '[]'"))
                conn.commit()
                print("[FixFlow DB] Added 'photos' column to jobs table.")
    except Exception as e:
        print("[FixFlow DB] Migration notice:", e)

@app.on_event("startup")
def on_startup():
    migrate_db()
    # Automatically seed initial users & jobs if database is fresh
    seed()


@app.get("/")
def root():
    return {
        "status": "online",
        "service": "FixFlow CRM Backend Engine",
        "version": "2.0.0",
        "docs_url": "/docs",
        "health_check": "/api/health"
    }

@app.get("/api/health")
def health_check():
    return {"status": "ok", "service": "FixFlow CRM Backend", "version": "2.0.0"}

if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 8000))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=True)
