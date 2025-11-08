from src.database.database import db_cursor, connection
from fastapi import APIRouter, Response, status
import numpy as np
import socket
from datetime import datetime
from src.models.models import InsertVisit

jhcis_router = APIRouter()

@jhcis_router.post("/login", status_code=status.HTTP_200_OK)
async def login(payload: dict, response: Response):
    try:
        username = payload.get('username')
        password = payload.get('password')

        query = "SELECT * FROM user WHERE username = %s AND password = %s"
        db_cursor.execute(query, (username, password))
        user = db_cursor.fetchone()

        if user:
            response.status_code = status.HTTP_200_OK
            return {"status": 200, "message": "Login successful"}
        else:
            response.status_code = status.HTTP_401_UNAUTHORIZED
            return {"status": 401, "message": "Invalid username or password"}
    except Exception as e:
        print(f"Login error: {e}")
        response.status_code = status.HTTP_500_INTERNAL_SERVER_ERROR
        return {"status": 500, "message": "Internal server error"}

@jhcis_router.get("/usernames")
async def get_usernames(response: Response):
    try:
        query = "SELECT username FROM user"
        db_cursor.execute(query)
        users = db_cursor.fetchall()
        if not users:
            return {"users": []}
        arr = np.array(users)
        usernames = arr.ravel().astype(str).tolist()
        return usernames
    except Exception as e:
        print(f"Get usernames error: {e}")
        response.status_code = status.HTTP_500_INTERNAL_SERVER_ERROR
        return {"status": 500, "message": "Internal server error"}

@jhcis_router.get("/check_exist_person/{pid}")
async def check_exist_person(pid: str, response: Response):
    try:
        query = "SELECT COUNT(*) FROM person WHERE idcard = %s"
        db_cursor.execute(query, (pid,))
        count = db_cursor.fetchone()[0]
        exists = count > 0
        return {"exists": exists}
    except Exception as e:
        print(f"Check exist person error: {e}")
        response.status_code = status.HTTP_500_INTERNAL_SERVER_ERROR
        return {"status": 500, "message": "Internal server error"}

@jhcis_router.post("/insert_visit")
async def insert_visit(payload: InsertVisit, response: Response):
    try:
        username = payload.username
        pid = payload.pid
        claimType = payload.claimType
        claimCode = payload.claimCode
        datetime_claim = payload.datetime_claim
        mainInscl = payload.mainInscl
        subInscl = payload.subInscl

        with connection.cursor() as db_cursor:
            db_cursor.execute("SELECT pcucode FROM user WHERE username = %s", (username,))
            user = db_cursor.fetchone()
            if not user:
                response.status_code = status.HTTP_404_NOT_FOUND
                return {"error": "User not found"}
            pcucode = user[0]

            db_cursor.execute("SELECT offid FROM office WHERE offid = %s", (pcucode,))
            office = db_cursor.fetchone()
            if not office:
                response.status_code = status.HTTP_404_NOT_FOUND
                return {"error": f"Office with offid={pcucode} not found in 'office' table"}

            db_cursor.execute("SELECT pcucodeperson, pid FROM person WHERE idcard = %s", (pid,))
            person = db_cursor.fetchone()
            if not person:
                response.status_code = status.HTTP_404_NOT_FOUND
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
                try:
                    ipv4this = socket.gethostbyname(socket.gethostname())
                except Exception:
                    ipv4this = ""

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

            try:
                db_cursor.execute(insert_query, values)
                connection.commit()
            except Exception as e:
                connection.rollback()
                print(f"Database insert failed: {e}")
                response.status_code = status.HTTP_500_INTERNAL_SERVER_ERROR
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
                "ipv4this": ipv4this,
                "mainInscl": mainInscl,
                "subInscl": subInscl
            }
        }
    except Exception as e:
        print(f"Insert visit error: {e}")
        response.status_code = status.HTTP_500_INTERNAL_SERVER_ERROR
        return {"status": 500, "message": "Internal server error"}
