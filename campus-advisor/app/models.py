"""Pydantic 请求/响应模型"""
from pydantic import BaseModel, Field


class UserProfile(BaseModel):
    school: str = ""
    major: str = ""
    grade: str = ""
    goal: str = ""
    skills: str = ""
    experience: str = ""
    interests: str = ""
    achievements: str = ""


class ChatRequest(BaseModel):
    session_id: str = Field(min_length=3, max_length=128)
    message: str = Field(min_length=1, max_length=20_000)
    conv_id: str = Field(default="", max_length=128)


class ChatResponse(BaseModel):
    reply: str
    state: str


class ProfileUpdateRequest(BaseModel):
    session_id: str = ""
    school: str = ""
    major: str = ""
    grade: str = ""
    goal: str = ""
    skills: str = ""
    experience: str = ""
    interests: str = ""
    achievements: str = ""


class AuthRegisterRequest(BaseModel):
    email: str = Field(default="", max_length=254)
    phone: str = Field(default="", max_length=32)
    password: str = Field(min_length=6, max_length=128)


class AuthLoginRequest(BaseModel):
    email: str = Field(default="", max_length=254)
    phone: str = Field(default="", max_length=32)
    password: str = Field(min_length=1, max_length=128)


class ForgotPasswordRequest(BaseModel):
    email: str = Field(default="", max_length=254)
    phone: str = Field(default="", max_length=32)


class ResetPasswordRequest(BaseModel):
    reset_token: str = Field(min_length=32, max_length=128)
    new_password: str = Field(min_length=6, max_length=128)
