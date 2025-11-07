from fastapi import APIRouter, Response, status
from typing import Optional
from src.lib.untils import smartcard_read

nsho_router = APIRouter()

@nsho_router.get("/smartcard_read", status_code=status.HTTP_200_OK)
async def read_smartcard(readImageFlag: Optional[bool] = False, response: Response = Response()):
    status_code, responese = smartcard_read(readImageFlag=readImageFlag)

    if status_code != 200:
        response.status_code = status_code
    
    return {
        "status": status_code,
        "message": "Success" if status_code == 200 else "Failed",
        "data": responese
    }
