"""VIP会员服务模块"""
from datetime import datetime, timedelta
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from models import User, UserAction
from typing import Tuple, Optional


VIP_PACKAGES = {
    "vip_month": {"level": "vip", "duration": 30, "price": 15},
    "vip_quarter": {"level": "vip", "duration": 90, "price": 36},
    "vip_year": {"level": "vip", "duration": 365, "price": 96},
    "svip_month": {"level": "svip", "duration": 30, "price": 30},
    "svip_quarter": {"level": "svip", "duration": 90, "price": 78},
    "svip_year": {"level": "svip", "duration": 365, "price": 198},
}


FREE_LIMITS = {
    "daily_likes": 10,
    "daily_super_likes": 0,
    "daily_ai_chats": 5,
}


VIP_LIMITS = {
    "daily_likes": -1,
    "daily_super_likes": 3,
    "daily_ai_chats": -1,
}


SVIP_LIMITS = {
    "daily_likes": -1,
    "daily_super_likes": 10,
    "daily_ai_chats": -1,
}


async def get_user_vip_level(db: AsyncSession, user_id: int) -> str:
    """获取用户当前VIP等级（考虑过期）"""
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    
    if not user:
        return "free"
    
    if user.vip_level in ("vip", "svip"):
        if user.vip_expire_at and user.vip_expire_at > datetime.utcnow():
            return user.vip_level
        else:
            user.vip_level = "free"
            user.vip_expire_at = None
            await db.commit()
    
    return "free"


async def get_vip_info(db: AsyncSession, user_id: int):
    """获取用户会员详情"""
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    
    if not user:
        return None
    
    vip_level = await get_user_vip_level(db, user_id)
    
    now = datetime.utcnow()
    remaining_days = 0
    if user.vip_expire_at and user.vip_expire_at > now:
        remaining_days = (user.vip_expire_at - now).days
    
    today = now.date()
    start_of_day = datetime(today.year, today.month, today.day)
    end_of_day = start_of_day + timedelta(days=1)
    
    like_count = await db.execute(
        select(func.count())
        .select_from(UserAction)
        .where(
            UserAction.user_id == user_id,
            UserAction.action_type == "like",
            UserAction.created_at >= start_of_day,
            UserAction.created_at < end_of_day,
        )
    )
    daily_like_count = like_count.scalar() or 0
    
    if vip_level == "free":
        limits = FREE_LIMITS
    elif vip_level == "vip":
        limits = VIP_LIMITS
    else:
        limits = SVIP_LIMITS
    
    return {
        "vip_level": vip_level,
        "vip_expire_at": user.vip_expire_at.isoformat() if user.vip_expire_at else None,
        "remaining_days": remaining_days,
        "daily_likes_used": daily_like_count,
        "daily_likes_limit": limits["daily_likes"],
        "daily_super_likes_limit": limits["daily_super_likes"],
        "daily_ai_chats_limit": limits["daily_ai_chats"],
        "is_vip": vip_level in ("vip", "svip"),
        "is_svip": vip_level == "svip",
    }


async def check_like_limit(db: AsyncSession, user_id: int, action_type: str = "like") -> Tuple[bool, str]:
    """检查喜欢次数限制"""
    vip_level = await get_user_vip_level(db, user_id)
    
    if vip_level == "svip":
        return True, "SVIP无限喜欢"
    if vip_level == "vip":
        if action_type == "super_like":
            return True, "VIP超级喜欢"
        return True, "VIP无限喜欢"
    
    today = datetime.utcnow().date()
    start_of_day = datetime(today.year, today.month, today.day)
    end_of_day = start_of_day + timedelta(days=1)
    
    like_count = await db.execute(
        select(func.count())
        .select_from(UserAction)
        .where(
            UserAction.user_id == user_id,
            UserAction.action_type == "like",
            UserAction.created_at >= start_of_day,
            UserAction.created_at < end_of_day,
        )
    )
    daily_like_count = like_count.scalar() or 0
    
    if daily_like_count >= FREE_LIMITS["daily_likes"]:
        return False, f"今日喜欢次数已用完（{FREE_LIMITS['daily_likes']}次），开通VIP解锁无限喜欢"
    
    return True, f"今日剩余喜欢次数：{FREE_LIMITS['daily_likes'] - daily_like_count}次"


async def check_ai_chat_limit(db: AsyncSession, user_id: int) -> Tuple[bool, str]:
    """检查AI聊天次数限制"""
    vip_level = await get_user_vip_level(db, user_id)
    
    if vip_level in ("vip", "svip"):
        return True, "VIP无限AI聊天"
    
    today = datetime.utcnow().date()
    start_of_day = datetime(today.year, today.month, today.day)
    
    from models import BehaviorLog
    
    chat_count = await db.execute(
        select(func.count())
        .select_from(BehaviorLog)
        .where(
            BehaviorLog.user_id == user_id,
            BehaviorLog.action == "ai_chat",
            BehaviorLog.created_at >= start_of_day,
        )
    )
    daily_chat_count = chat_count.scalar() or 0
    
    if daily_chat_count >= FREE_LIMITS["daily_ai_chats"]:
        return False, f"今日AI聊天次数已用完（{FREE_LIMITS['daily_ai_chats']}次），开通VIP解锁无限聊天"
    
    return True, f"今日剩余AI聊天次数：{FREE_LIMITS['daily_ai_chats'] - daily_chat_count}次"


async def buy_vip(db: AsyncSession, user_id: int, package_code: str) -> dict:
    """购买会员"""
    if package_code not in VIP_PACKAGES:
        raise ValueError(f"无效的套餐代码: {package_code}")
    
    package = VIP_PACKAGES[package_code]
    
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    
    if not user:
        raise ValueError("用户不存在")
    
    now = datetime.utcnow()
    
    if user.vip_expire_at and user.vip_expire_at > now:
        new_expire_at = user.vip_expire_at + timedelta(days=package["duration"])
    else:
        new_expire_at = now + timedelta(days=package["duration"])
    
    user.vip_level = package["level"]
    user.vip_expire_at = new_expire_at
    user.vip_auto_renew = False
    
    await db.commit()
    await db.refresh(user)
    
    return {
        "success": True,
        "vip_level": user.vip_level,
        "vip_expire_at": user.vip_expire_at.isoformat(),
        "package": package_code,
        "price": package["price"],
    }


def get_vip_packages():
    """获取所有VIP套餐"""
    packages = []
    for code, info in VIP_PACKAGES.items():
        packages.append({
            "code": code,
            "level": info["level"],
            "duration": info["duration"],
            "price": info["price"],
            "description": {
                "vip_month": "VIP月卡",
                "vip_quarter": "VIP季卡",
                "vip_year": "VIP年卡",
                "svip_month": "SVIP月卡",
                "svip_quarter": "SVIP季卡",
                "svip_year": "SVIP年卡",
            }.get(code, code),
        })
    return packages


def get_vip_privileges(vip_level: str = "free") -> list:
    """获取会员特权列表"""
    all_privileges = [
        {
            "name": "每日喜欢次数",
            "free": "10次/天",
            "vip": "无限",
            "svip": "无限",
        },
        {
            "name": "超级喜欢",
            "free": "0次/天",
            "vip": "3次/天",
            "svip": "10次/天",
        },
        {
            "name": "查看谁喜欢我",
            "free": "❌",
            "vip": "❌",
            "svip": "✅",
        },
        {
            "name": "反悔功能",
            "free": "❌",
            "vip": "✅",
            "svip": "✅",
        },
        {
            "name": "高级筛选",
            "free": "基础",
            "vip": "全部",
            "svip": "全部",
        },
        {
            "name": "同城优先推荐",
            "free": "❌",
            "vip": "✅",
            "svip": "✅",
        },
        {
            "name": "AI情商助手",
            "free": "5次/天",
            "vip": "无限",
            "svip": "无限",
        },
        {
            "name": "专属标识",
            "free": "❌",
            "vip": "金色VIP标识",
            "svip": "钻石SVIP标识",
        },
        {
            "name": "优先匹配展示",
            "free": "❌",
            "vip": "❌",
            "svip": "✅",
        },
        {
            "name": "专属客服",
            "free": "❌",
            "vip": "❌",
            "svip": "✅",
        },
    ]
    
    if vip_level == "free":
        return [{"name": p["name"], "value": p["free"], "available": False} for p in all_privileges]
    elif vip_level == "vip":
        return [{"name": p["name"], "value": p["vip"], "available": True} for p in all_privileges]
    else:
        return [{"name": p["name"], "value": p["svip"], "available": True} for p in all_privileges]