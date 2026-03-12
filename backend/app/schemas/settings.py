# System Settings

from pydantic import BaseModel

class SystemSettingSchema(BaseModel):
    key: str
    value: str

    class ConfigDict:
        from_attributes = True

class SystemSettingUpdate(BaseModel):
    value: str