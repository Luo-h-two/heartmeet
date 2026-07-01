"""数据库模型 - 相亲交友平台"""
from datetime import datetime
from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Float, Boolean, JSON
from sqlalchemy.orm import relationship
from database import Base


class User(Base):
    """用户表"""
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, autoincrement=True)
    phone = Column(String(20), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    nickname = Column(String(50), nullable=False)
    avatar = Column(String(500), default="")
    photos = Column(JSON, default=list)  # 相册图片URL列表
    age = Column(Integer, default=18)
    gender = Column(String(10), default="other")  # male/female/other
    city = Column(String(50), default="")
    occupation = Column(String(50), default="")
    bio = Column(Text, default="")
    interests = Column(JSON, default=list)  # 兴趣标签列表
    personality_tags = Column(JSON, default=list)  # 性格标签
    preference = Column(JSON, default=dict)  # 择偶偏好 {"min_age":20,"max_age":35,"gender":"female","cities":[],"tags":[]}
    latitude = Column(Float, default=0.0)
    longitude = Column(Float, default=0.0)
    is_active = Column(Boolean, default=True)
    is_admin = Column(Boolean, default=False)  # 是否管理员（兼容旧字段）
    role = Column(String(20), default="user")  # user/moderator/admin/superadmin
    status = Column(String(20), default="active")  # active/banned
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # 关系
    actions_sent = relationship("UserAction", foreign_keys="UserAction.user_id", back_populates="user")
    actions_received = relationship("UserAction", foreign_keys="UserAction.target_user_id", back_populates="target_user")
    behavior_logs = relationship("BehaviorLog", foreign_keys="BehaviorLog.user_id", back_populates="user")


class UserAction(Base):
    """用户交互行为表"""
    __tablename__ = "user_actions"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    target_user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    action_type = Column(String(20), nullable=False)  # like/skip/favorite/greet/view
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", foreign_keys=[user_id], back_populates="actions_sent")
    target_user = relationship("User", foreign_keys=[target_user_id], back_populates="actions_received")


class BehaviorLog(Base):
    """用户行为日志表 - 用于大数据分析"""
    __tablename__ = "behavior_logs"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    target_user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    action = Column(String(30), nullable=False)  # view_card/click_detail/like/skip/stay/greet/search
    duration_ms = Column(Integer, default=0)  # 停留时长(毫秒)
    extra = Column(JSON, default=dict)  # 额外信息
    created_at = Column(DateTime, default=datetime.utcnow, index=True)

    user = relationship("User", foreign_keys=[user_id], back_populates="behavior_logs")


class ChatMessage(Base):
    """聊天消息表"""
    __tablename__ = "chat_messages"

    id = Column(Integer, primary_key=True, autoincrement=True)
    from_user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    to_user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    content = Column(Text, default="")
    is_read = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)


class AdminLog(Base):
    """管理员操作日志表"""
    __tablename__ = "admin_logs"

    id = Column(Integer, primary_key=True, autoincrement=True)
    admin_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    action = Column(String(50), nullable=False)  # login/user_edit/user_ban/user_delete/view_logs
    target_id = Column(Integer, ForeignKey("users.id"), nullable=True)  # 操作目标用户ID
    detail = Column(Text, default="")  # 操作详情(JSON格式)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)

    admin = relationship("User", foreign_keys=[admin_id])
    target = relationship("User", foreign_keys=[target_id])
