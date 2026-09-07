import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

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

# Include Routers
app.include_router(auth.router)
app.include_router(jobs.router)
app.include_router(technicians.router)
app.include_router(shifts.router)
app.include_router(staff.router)

@app.on_event("startup")
def on_startup():
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
