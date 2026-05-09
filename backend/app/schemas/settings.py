from pydantic import BaseModel, ConfigDict

class SystemSettingSchema(BaseModel):
    key: str
    value: str

    model_config = ConfigDict(from_attributes=True)

class SystemSettingUpdate(BaseModel):
    key: str
    value: str