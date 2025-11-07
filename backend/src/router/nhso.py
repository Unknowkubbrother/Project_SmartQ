from fastapi import APIRouter, Response, status
from typing import Optional
from src.lib.untils import nhso_confirm_save, smartcard_read

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

@nsho_router.post("/confirm_save", status_code=status.HTTP_200_OK)
async def confirm_save(
    pid: str,
    claim_type: str,
    mobile: str,
    correlation_id: str,
    hn: Optional[str] = None,
    hcode: Optional[str] = None,
    response: Response = Response()
):
    status_code, responese = nhso_confirm_save(
        pid=pid,
        claim_type=claim_type,
        mobile=mobile,
        correlation_id=correlation_id,
        hn=hn,
        hcode=hcode
    )

    if status_code != 200:
        response.status_code = status_code
    
    return {
        "status": status_code,
        "message": "Success" if status_code == 200 else "Failed",
        "data": responese
    }
