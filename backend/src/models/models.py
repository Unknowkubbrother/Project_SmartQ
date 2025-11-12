from pydantic import BaseModel
from typing import Optional

class EnqueueItem(BaseModel):
    FULLNAME_TH: str

class InsertVisit(BaseModel):
    username: str
    pid: str
    claimType: str
    claimCode: str
    datetime_claim: str
    mainInscl: Optional[str] = None
    subInscl: Optional[str] = None