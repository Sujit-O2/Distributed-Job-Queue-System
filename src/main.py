from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import JSONResponse
from src.routers import auth, job_info

app = FastAPI(title="Distributed Job Queue API", version="1.0.0")

# Critical Demo Fix: Allow UI to connect cross-origin flawlessly
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Phase 2 Speed Boost: Compress huge OCR outputs dynamically
app.add_middleware(GZipMiddleware, minimum_size=1000)

app.include_router(auth.router, tags=["auth"])
app.include_router(job_info.router, tags=["job_info"])

# Global Exception Trap: Prevent silent 500 server crashes from disconnecting the UI
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    return JSONResponse(
        status_code=500,
        content={"message": "System Exception", "detail": str(exc)},
    )

@app.get("/health")
def health_check():
    return {"status": "ok", "system": "online"}
