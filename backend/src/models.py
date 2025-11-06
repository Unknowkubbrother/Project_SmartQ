from pydantic import BaseModel

class EnqueueItem(BaseModel):
    FULLNAME_TH: str

class InsertVisit(BaseModel):
    username: str
    cid: str