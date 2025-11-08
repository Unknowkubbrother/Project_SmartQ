from fastapi import APIRouter, Response, status
from typing import Optional
import logging
from src.lib.untils import nhso_confirm_save, smartcard_read
from src.models.models import Claim

logger = logging.getLogger(__name__)
nsho_router = APIRouter()

@nsho_router.get("/smartcard_read", status_code=status.HTTP_200_OK)
async def read_smartcard(readImageFlag: Optional[bool] = False, response: Response = Response()):
    try:
        status_code, responese = smartcard_read(readImageFlag=readImageFlag)

        if status_code != 200:
            response.status_code = status_code

        return {
            "status": status_code,
            "message": "Success" if status_code == 200 else "Failed",
            "data": responese
        }
    except Exception:
        logger.exception("read_smartcard failed")
        response.status_code = status.HTTP_500_INTERNAL_SERVER_ERROR
        return {
            "status": status.HTTP_500_INTERNAL_SERVER_ERROR,
            "message": "Internal Server Error",
            "data": None
        }

@nsho_router.post("/confirm_save", status_code=status.HTTP_200_OK)
async def confirm_save(
    payload: Claim,
    response: Response = Response()
):
    try:
        status_code, responese = nhso_confirm_save(
            pid=payload.pid,
            claim_type=payload.claimType,
            mobile=payload.mobile,
            correlationId=payload.correlationId
        )

        if status_code != 200:
            response.status_code = status_code

        return {
            "status": status_code,
            "message": "Success" if status_code == 200 else "Failed",
            "data": responese
        }
    except Exception:
        logger.exception("confirm_save failed")
        response.status_code = status.HTTP_500_INTERNAL_SERVER_ERROR
        return {
            "status": status.HTTP_500_INTERNAL_SERVER_ERROR,
            "message": "Internal Server Error",
            "data": None
        }