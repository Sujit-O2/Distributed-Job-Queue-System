
from src.modles.user_model import User
from sqlalchemy.orm import Session
class AuthService:
    def __init__(self,db: Session):
        self.db=db
    def login_user(self, log_in):
        user = self.db.query(User).filter(User.username == log_in.username).first()
        if user and user.password == log_in.password:
            return user
        return None
        

    def register_user(self, register):
        db_user = self.db.query(User).filter(User.username == register.username).first()
        if db_user:
            return None  
        new_user = User(
            username=register.username,
            email=register.email,
            full_name=register.full_name,
            password=register.password
        )
        self.db.add(new_user)
        self.db.commit()
        self.db.refresh(new_user)
        return new_user
