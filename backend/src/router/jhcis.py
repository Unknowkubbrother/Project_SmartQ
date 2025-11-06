from src.database import db_cursor
from fastapi import APIRouter
import numpy as np

jhcis_router = APIRouter()

@jhcis_router.post("/login")
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


@jhcis_router.get("/users")
async def get_users():
    query = "SELECT username FROM user"
    db_cursor.execute(query)
    users = db_cursor.fetchall()
    if not users:
        return {"users": []}
    arr = np.array(users)
    usernames = arr.ravel().astype(str).tolist()
    return {"users": usernames}