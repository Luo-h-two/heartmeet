"""JWT 鉴权模块"""
import hashlib
import secrets
import bcrypt
from datetime import datetime, timedelta
from typing import Optional
from jose import JWTError, jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from config import SECRET_KEY, ALGORITHM, ACCESS_TOKEN_EXPIRE_MINUTES
from database import get_db
from models import User

security = HTTPBearer()


def hash_password(password: str) -> str:
    """使用 bcrypt 进行密码哈希"""
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """验证密码 - 支持 bcrypt 和 SHA-256 双验兼容"""
    if hashed_password.startswith("$2b$") or hashed_password.startswith("$2a$"):
        try:
            return bcrypt.checkpw(plain_password.encode(), hashed_password.encode())
        except:
            pass
    try:
        salt, expected = hashed_password.split("$", 1)
        actual = hashlib.sha256((plain_password + salt).encode()).hexdigest()
        return secrets.compare_digest(actual, expected)
    except (ValueError, AttributeError):
        return False


def is_old_hash(hashed_password: str) -> bool:
    """判断是否为旧的 SHA-256 哈希格式"""
    return not (hashed_password.startswith("$2b$") or hashed_password.startswith("$2a$"))


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: AsyncSession = Depends(get_db),
) -> User:
    """从 JWT Token 获取当前用户"""
    token = credentials.credentials
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="无效的认证凭证",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id_str = payload.get("sub")
        if user_id_str is None:
            raise credentials_exception
        user_id = int(user_id_str)
    except (JWTError, ValueError):
        raise credentials_exception

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if user is None:
        raise credentials_exception
    return user


async def get_current_admin(
    current_user: User = Depends(get_current_user),
) -> User:
    """从 JWT Token 获取当前管理员（需 is_admin=True 或 role >= admin）"""
    role_levels = {"user": 0, "moderator": 1, "admin": 2, "superadmin": 3}
    current_level = role_levels.get(current_user.role, 0)
    if current_level < 2 and not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="无管理员权限",
        )
    if current_user.status == "banned":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="账号已被禁用",
        )
    return current_user


async def require_role(
    required_role: str,
    current_user: User = Depends(get_current_user),
) -> User:
    """角色权限校验"""
    role_levels = {"user": 0, "moderator": 1, "admin": 2, "superadmin": 3}
    current_level = role_levels.get(current_user.role, 0)
    required_level = role_levels.get(required_role, 3)
    if current_level < required_level:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"权限不足，需要{required_role}角色",
        )
    if current_user.status == "banned":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="账号已被禁用",
        )
    return current_user
