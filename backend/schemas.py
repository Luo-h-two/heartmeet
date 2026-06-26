"""Pydantic 数据校验模型"""
from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field, field_validator
import re


# ============ 用户相关 ============

class UserRegister(BaseModel):
    phone: str = Field(..., min_length=11, max_length=11)
    password: str = Field(..., min_length=6, max_length=50)
    nickname: str = Field(..., min_length=1, max_length=50)
    gender: str = Field(default="other")

    @field_validator("phone")
    @classmethod
    def validate_phone(cls, v):
        if not re.match(r"^1[3-9]\d{9}$", v):
            raise ValueError("手机号格式不正确")
        return v

    @field_validator("password")
    @classmethod
    def validate_password(cls, v):
        if len(v) < 6:
            raise ValueError("密码至少6位")
        if not re.search(r"[A-Z]", v) and not re.search(r"[a-z]", v):
            raise ValueError("密码需包含字母")
        return v


class UserLogin(BaseModel):
    phone: str
    password: str


class UserUpdate(BaseModel):
    nickname: Optional[str] = None
    avatar: Optional[str] = None
    photos: Optional[List[str]] = None
    age: Optional[int] = None
    gender: Optional[str] = None
    city: Optional[str] = None
    occupation: Optional[str] = None
    bio: Optional[str] = None
    interests: Optional[List[str]] = None
    personality_tags: Optional[List[str]] = None


class PreferenceUpdate(BaseModel):
    min_age: Optional[int] = None
    max_age: Optional[int] = None
    gender: Optional[str] = None
    cities: Optional[List[str]] = None
    tags: Optional[List[str]] = None


class UserResponse(BaseModel):
    id: int
    phone: str
    nickname: str
    avatar: Optional[str] = ""
    photos: Optional[List[str]] = []
    age: int
    gender: str
    city: str
    occupation: str
    bio: str
    interests: List[str]
    personality_tags: List[str]
    preference: dict
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class UserCardResponse(BaseModel):
    """推荐卡片用 - 精简信息"""
    id: int
    nickname: str
    avatar: Optional[str] = ""
    age: int
    gender: str
    city: str
    occupation: str
    bio: str
    interests: List[str]
    personality_tags: List[str]
    common_interests: List[str] = []
    recommend_reason: str = ""

    model_config = {"from_attributes": True}


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse


# ============ 行为相关 ============

class ActionCreate(BaseModel):
    target_user_id: int
    action_type: str  # like/skip/favorite/greet

    @field_validator("action_type")
    @classmethod
    def validate_action(cls, v):
        if v not in ("like", "skip", "favorite", "greet"):
            raise ValueError("无效的操作类型")
        return v


class BehaviorLogCreate(BaseModel):
    target_user_id: Optional[int] = None
    action: str  # view_card/click_detail/like/skip/stay/greet/search
    duration_ms: int = 0
    extra: dict = {}


# ============ 推荐相关 ============

class RecommendRequest(BaseModel):
    page: int = 1
    page_size: int = 10
    gender: Optional[str] = None
    min_age: Optional[int] = None
    max_age: Optional[int] = None
    city: Optional[str] = None
    tags: Optional[List[str]] = None


class RecommendResponse(BaseModel):
    users: List[UserCardResponse]
    total: int
    page: int
    page_size: int


class AnalysisResponse(BaseModel):
    """用户行为分析结果"""
    user_id: int
    total_views: int
    total_likes: int
    total_skips: int
    like_rate: float
    preferred_genders: dict
    preferred_ages: dict
    preferred_cities: dict
    preferred_tags: dict
    recent_behaviors: List[dict]


class MatchResponse(BaseModel):
    is_matched: bool
    match_user: Optional[UserCardResponse] = None
    message: str = ""


class SendMessageRequest(BaseModel):
    content: str = Field(..., min_length=1, max_length=1000)


# ============ AI 聊天助手 ============

class AIChatRequest(BaseModel):
    """AI 聊天请求"""
    messages: list  # [{"role": "user/assistant", "content": "..."}]
    gender: str = "female"  # male / female

    @field_validator("gender")
    @classmethod
    def validate_gender(cls, v):
        if v not in ("male", "female"):
            raise ValueError("性别仅支持 male 或 female")
        return v

    @field_validator("messages")
    @classmethod
    def validate_messages(cls, v):
        if not v:
            raise ValueError("对话不能为空")
        # 限制最近 20 轮对话，避免 token 过长
        return v[-20:]
