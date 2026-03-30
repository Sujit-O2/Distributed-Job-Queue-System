
from src.modles.user_modles import User
from src.database.database import SessionLocal
class AuthService:
    def login_user(self, log_in):
        db = SessionLocal()
        user = db.query(User).filter(User.username == log_in.username).first()
        if user and user.password == log_in.password:
            return user
        return None
        

    def register_user(self, register):
        db = SessionLocal()
        db_user = db.query(User).filter(User.username == register.username).first()
        if db_user:
            return None  
        new_user = User(
            username=register.username,
            email=register.email,
            full_name=register.full_name,
            password=register.password
        )
        db.add(new_user)
        db.commit()
        db.refresh(new_user)
        return new_user
