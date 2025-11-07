from src.database import db_cursor , connection
from fastapi import APIRouter , Response, status
import numpy as np
import socket
from datetime import datetime
from src.models import InsertVisit

jhcis_router = APIRouter()

@jhcis_router.post("/login" , status_code=status.HTTP_200_OK)
async def login(payload: dict , response: Response):
    username = payload.get('username')
    password = payload.get('password')
    
    query = "SELECT * FROM user WHERE username = %s AND password = %s"
    db_cursor.execute(query, (username, password))
    user = db_cursor.fetchone()
    
    if user:
        response.status_code = status.HTTP_200_OK
        return {
            "status": 200,
            "message": "Login successful"
        }
    else:
        response.status_code = status.HTTP_401_UNAUTHORIZED
        return {
            "status": 401,
            "message": "Invalid username or password"
        }


@jhcis_router.get("/usernames")
async def get_usernames():
    query = "SELECT username FROM user"
    db_cursor.execute(query)
    users = db_cursor.fetchall()
    if not users:
        return {"users": []}
    arr = np.array(users)
    usernames = arr.ravel().astype(str).tolist()
    return usernames



@jhcis_router.get("/check_exist_person/{pid}")
async def check_exist_person(pid: str):
    query = "SELECT COUNT(*) FROM person WHERE idcard = %s"
    db_cursor.execute(query, (pid,))
    count = db_cursor.fetchone()[0]
    exists = count > 0
    return {"exists": exists}

# pcucode => ดึงจาก pcucode ใน table user
# visitno => visitno + 1 
# visitdate => 2025-11-06 เขียนโค๊ด get ขึ้นมา
#  pcucodeperson => ดึงจาก pcucodeperson ใน table person
# pid => ดึงจาก pid ใน table person
# username => username มาจาก input จากโค๊ด
# flagservice => 01
# dateupdate => 2025-11-06 18:44:47 เขียนโค๊ด get ขึ้นมา
# servicetype => 1
# ipv4this => “” หรือ currentipv4 เขียนโค๊ด get ขึ้นมา


@jhcis_router.post("/insert_visit")
async def insert_visit(payload: InsertVisit):
    username = payload.username
    pid = payload.pid
    claimType = payload.claimType
    claimCode = payload.claimCode
    datetime_claim = payload.datetime_claim
    mainInscl = payload.mainInscl
    subInscl = payload.subInscl


    with connection.cursor() as db_cursor:  # ✅ ใช้ cursor ใน scope นี้
        db_cursor.execute("SELECT pcucode FROM user WHERE username = %s", (username,))
        user = db_cursor.fetchone()
        if not user:
            return {"error": "User not found"}
        pcucode = user[0]

        db_cursor.execute("SELECT offid FROM office WHERE offid = %s", (pcucode,))
        office = db_cursor.fetchone()
        if not office:
            return {"error": f"Office with offid={pcucode} not found in 'office' table"}
        
        db_cursor.execute("SELECT pcucodeperson, pid FROM person WHERE idcard = %s", (pid,))
        person = db_cursor.fetchone()
        if not person:
            return {"error": "Person not found for this user"}
        pcucodeperson, pid = person

        db_cursor.execute("SELECT COALESCE(MAX(visitno), 0) + 1 FROM visit")
        visitno = db_cursor.fetchone()[0]

        visitdate = datetime.now().strftime("%Y-%m-%d")
        dateupdate = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

        try:
            import requests
            ipv4this = requests.get("https://api.ipify.org?format=text", timeout=5).text
        except Exception:
            ipv4this = socket.gethostbyname(socket.gethostname())

        print("test2")

        flagservice = "01"
        servicetype = 1
        receivepatient = "00"
        refer = "00"
        gaheent = "1"
        gahlart = "1"
        galung = "1"
        gaab = "1"
        gaext = "1"
        ganeuro = "1"

        mainInscl = mainInscl if mainInscl not in (None, "") else None
        subInscl = subInscl if subInscl not in (None, "") else None

        insert_query = """
            INSERT INTO visit (
                pcucode,
                visitno,
                visitdate,
                pcucodeperson,
                pid,
                username,
                flagservice,
                dateupdate,
                servicetype,
                ipv4this,
                receivepatient,
                refer,
                gaheent,
                gahlart,
                galung,
                gaab,
                gaext,
                ganeuro,
                hiciauthen_nhso,
                claimcode_nhso,
                datetime_claim,
                main_inscl,
                sub_inscl
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        """

        values = (
            pcucode,
            visitno,
            visitdate,
            pcucodeperson,
            pid,
            username,
            flagservice,
            dateupdate,
            servicetype,
            ipv4this,
            receivepatient,
            refer,
            gaheent,
            gahlart,
            galung,
            gaab,
            gaext,
            ganeuro,
            claimType,
            claimCode,
            datetime_claim,
            mainInscl,
            subInscl
        )

        print(values)

        try:
            db_cursor.execute(insert_query, values)
            connection.commit()  # ✅ commit บน connection ใหม่แน่ ๆ
        except Exception as e:
            connection.rollback()
            print(f"Database insert failed: {str(e)}")
            return {"error": f"Database insert failed: {str(e)}"}

    return {
        "message": "Insert success",
        "data": {
            "pcucode": pcucode,
            "visitno": visitno,
            "visitdate": visitdate,
            "pcucodeperson": pcucodeperson,
            "pid": pid,
            "username": username,
            "flagservice": flagservice,
            "dateupdate": dateupdate,
            "servicetype": servicetype,
            "ipv4this": ipv4this
        }
    }
