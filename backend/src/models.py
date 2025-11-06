from pydantic import BaseModel

class EnqueueItem(BaseModel):
    FULLNAME_TH: str
    service: str