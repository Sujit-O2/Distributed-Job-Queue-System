from fastapi import APIRouter
from src.schema.auth import LogIn, Register
from src.Services.auth import AuthService

router = APIRouter()

@router.post("/login")
async def login(log_in: LogIn):
    auth_service = AuthService()
    user = auth_service.login_user(log_in)
    if user:
        return {"message": "Login successful"}
    # Implement your login logic here
    return {"message": "Invalid username or password"}


@router.post("/register")
async def register(register: Register):
    auth_service = AuthService()
    user = auth_service.register_user(register)
    if user:
        return {"message": "User registered successfully"}
    # Implement your registration logic here
    return {"message": "Failed to register user"}
