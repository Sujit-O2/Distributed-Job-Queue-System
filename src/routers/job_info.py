from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from src.Services.job_info import jobInfo
from src.database.database import get_db
from src.schema.jobs import JobSchema
from src.storage import store_upload_file

router = APIRouter()
@router.post("/create_job")
def create_job(schema:JobSchema,db= Depends(get_db)):
    job_service = jobInfo(db)
    return job_service.create_job(schema)
    
@router.get("/job_info")
def get_job_info(job_id: int, db=Depends(get_db)):
    job_service = jobInfo(db)
    return job_service.get_job_info(job_id)

@router.get("/list_jobs")
def list_jobs(user_id: int, db=Depends(get_db)):
    job_service = jobInfo(db)
    return job_service.list_jobs(user_id)

@router.put("/update_job_status")
def update_job_status(job_id: int, status: str, db=Depends(get_db)):
    job_service = jobInfo(db)
    return job_service.update_job_status(job_id, status)

@router.delete("/delete_job")
def delete_job(job_id: int, db=Depends(get_db)):
    job_service = jobInfo(db)
    return job_service.delete_job(job_id)

@router.post("/upload_files")
async def upload_files(files: list[UploadFile] = File(...)):
    if not files:
        raise HTTPException(status_code=400, detail="No files were uploaded")

    uploaded_files = []
    for uploaded_file in files:
        uploaded_files.append(store_upload_file(uploaded_file))
        await uploaded_file.close()

    return {"files": uploaded_files}

    
