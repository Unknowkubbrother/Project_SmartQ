from src.database import db_cursor
from fastapi import APIRouter

auth_router = APIRouter()

@auth_router.post("/login")
async def login(payload: dict):
    username = payload.get('username')
    password = payload.get('password')
    
    query = "SELECT * FROM user WHERE username = %s AND password = %s"
    db_cursor.execute(query, (username, password))
    user = db_cursor.fetchone()
    
    if user:
        return {"message": "Login successful", "user": {"id": user[0], "username": user[1]}}
    else:
        return {"error": "Invalid username or password"}
