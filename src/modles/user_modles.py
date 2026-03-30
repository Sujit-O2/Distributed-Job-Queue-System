from sqlalchemy import Column, Integer, String
from sqlalchemy.ext.declarative import declarative_base 
from src.database.database import Base
class User(Base):
    __tablename__ = 'users'
    id = Column(Integer, primary_key=True)
    username = Column(String, unique=True, nullable=False)
    email = Column(String, unique=True, nullable=False)
    full_name = Column(String, nullable=False)
    password = Column(String, nullable=False)
