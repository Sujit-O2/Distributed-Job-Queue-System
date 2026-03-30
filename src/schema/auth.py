from pydantic import BaseModel


class LogIn(BaseModel):
    username: str
    password: str

class Register(BaseModel):
    username: str
    email: str
    full_name: str
    password: str
