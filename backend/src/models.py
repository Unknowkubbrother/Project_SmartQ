from pydantic import BaseModel

class EnqueueItem(BaseModel):
    fname: str

class InsertVisit(BaseModel):
    username: str
    pid: str