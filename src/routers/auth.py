from src.database.database import get_db
from fastapi import APIRouter, Depends
from src.schema.auth import LogIn, Register
from src.Services.auth import AuthService

router = APIRouter()


@router.post("/login")
async def login(log_in: LogIn, db=Depends(get_db)):
    auth_service = AuthService(db)
    user = auth_service.login_user(log_in)
    if user:
        return {
            "message": "Login successful",
            "user": {
                "id": user.id,
                "username": user.username,
                "email": user.email,
                "full_name": user.full_name,
            },
        }
    return {"message": "Invalid username or password"}


@router.post("/register")
async def register(register: Register, db=Depends(get_db)):
    auth_service = AuthService(db)
    user = auth_service.register_user(register)
    if user:
        return {
            "message": "User registered successfully",
            "user": {
                "id": user.id,
                "username": user.username,
                "email": user.email,
                "full_name": user.full_name,
            },
        }
    return {"message": "Failed to register user"}
