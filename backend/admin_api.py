"""管理后台 API 路由 — 所有接口需管理员权限"""
import json
from datetime import datetime, timedelta
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_, or_, desc, delete

from database import get_db
from models import User, UserAction, BehaviorLog, ChatMessage, AdminLog
from schemas import (
    AdminLogin, AdminUserUpdate, AdminBanRequest,
    AdminUserResponse, AdminDashboardResponse, AdminUserListResponse,
    AdminLogResponse, AdminActionResponse, AdminChatResponse, AdminAdminLogResponse,
)
from auth import hash_password, verify_password, is_old_hash, create_access_token, get_current_admin, require_role

admin_router = APIRouter(prefix="/api/admin", tags=["管理后台"])


def mask_phone(phone: str) -> str:
    """脱敏手机号 138****0001"""
    if len(phone) >= 7:
        return phone[:3] + "****" + phone[-4:]
    return phone


async def add_admin_log(db: AsyncSession, admin_id: int, action: str, target_id: Optional[int] = None, detail: str = ""):
    """记录管理员操作日志"""
    log = AdminLog(admin_id=admin_id, action=action, target_id=target_id, detail=detail)
    db.add(log)
    await db.commit()


# ==================== 1. 管理员登录 ====================
@admin_router.post("/login")
async def admin_login(data: AdminLogin, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.phone == data.phone))
    user = result.scalar_one_or_none()
    if not user or not verify_password(data.password, user.password_hash):
        raise HTTPException(status_code=401, detail="手机号或密码错误")
    role_levels = {"user": 0, "moderator": 1, "admin": 2, "superadmin": 3}
    current_level = role_levels.get(user.role, 0)
    if current_level < 1 and not user.is_admin:
        raise HTTPException(status_code=403, detail="无管理员权限")
    if user.status == "banned":
        raise HTTPException(status_code=403, detail="账号已被禁用")

    if is_old_hash(user.password_hash):
        user.password_hash = hash_password(data.password)
        await db.commit()

    token = create_access_token({"sub": str(user.id)})
    await add_admin_log(db, user.id, "login", detail=f"管理员 {user.nickname} 登录后台")

    return {
        "access_token": token,
        "token_type": "bearer",
        "user": {
            "id": user.id, "phone": mask_phone(user.phone),
            "nickname": user.nickname, "is_admin": user.is_admin,
            "role": user.role
        }
    }


# ==================== 2. 仪表盘 ====================
@admin_router.get("/dashboard", response_model=AdminDashboardResponse)
async def dashboard(db: AsyncSession = Depends(get_db), admin: User = Depends(get_current_admin)):
    # 总用户数
    total = await db.scalar(select(func.count(User.id)))
    # 今日新增
    today = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
    today_new = await db.scalar(
        select(func.count(User.id)).where(User.created_at >= today)
    )
    # 男女比例
    male_count = await db.scalar(select(func.count(User.id)).where(User.gender == "male"))
    female_count = await db.scalar(select(func.count(User.id)).where(User.gender == "female"))
    # 封禁用户数
    banned_count = await db.scalar(select(func.count(User.id)).where(User.status == "banned"))
    # 城市分布 Top10
    city_result = await db.execute(
        select(User.city, func.count(User.id))
        .where(User.city != "")
        .group_by(User.city).order_by(desc(func.count(User.id))).limit(10)
    )
    top_cities = [{"city": row[0], "count": row[1]} for row in city_result.all()]
    # 近7天活跃用户 (有登录或行为的)
    week_ago = datetime.utcnow() - timedelta(days=7)
    active_7d = await db.scalar(
        select(func.count(func.distinct(BehaviorLog.user_id)))
        .where(BehaviorLog.created_at >= week_ago)
    )
    # 近7天互动次数
    interactions_7d = await db.scalar(
        select(func.count(BehaviorLog.id)).where(BehaviorLog.created_at >= week_ago)
    )

    return AdminDashboardResponse(
        total_users=total or 0,
        today_new=today_new or 0,
        gender_ratio={"male": male_count or 0, "female": female_count or 0, "other": (total or 0) - (male_count or 0) - (female_count or 0)},
        banned_count=banned_count or 0,
        top_cities=top_cities,
        active_7d=active_7d or 0,
        interactions_7d=interactions_7d or 0,
    )


# ==================== 3. 用户列表 ====================
@admin_router.get("/users", response_model=AdminUserListResponse)
async def admin_users(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    keyword: Optional[str] = None,
    gender: Optional[str] = None,
    city: Optional[str] = None,
    status_filter: Optional[str] = Query(None, alias="status"),
    sort: Optional[str] = "created_at",
    order: Optional[str] = "desc",
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    query = select(User)
    count_query = select(func.count(User.id))

    # 筛选条件
    filters = []
    if keyword:
        filters.append(
            or_(User.nickname.contains(keyword), User.phone.contains(keyword))
        )
    if gender:
        filters.append(User.gender == gender)
    if city:
        filters.append(User.city == city)
    if status_filter:
        filters.append(User.status == status_filter)

    if filters:
        query = query.where(and_(*filters))
        count_query = count_query.where(and_(*filters))

    total = await db.scalar(count_query)

    # 排序
    sort_col = getattr(User, sort, User.created_at)
    if order == "asc":
        query = query.order_by(sort_col.asc())
    else:
        query = query.order_by(sort_col.desc())

    # 分页
    offset = (page - 1) * page_size
    result = await db.execute(query.offset(offset).limit(page_size))
    users = result.scalars().all()

    return AdminUserListResponse(
        total=total or 0, page=page, page_size=page_size,
        users=[
            AdminUserResponse(
                id=u.id, phone=mask_phone(u.phone), nickname=u.nickname,
                avatar=u.avatar, age=u.age, gender=u.gender, city=u.city,
                occupation=u.occupation, bio=u.bio,
                interests=u.interests or [], personality_tags=u.personality_tags or [],
                is_admin=u.is_admin, status=u.status,
                is_active=u.is_active,
                created_at=u.created_at, updated_at=u.updated_at,
            ) for u in users
        ]
    )


# ==================== 4. 用户详情 ====================
@admin_router.get("/users/{user_id}", response_model=AdminUserResponse)
async def admin_user_detail(
    user_id: int,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="用户不存在")

    await add_admin_log(db, admin.id, "view_user", target_id=user_id, detail=f"查看用户 {user.phone}")

    return AdminUserResponse(
        id=user.id, phone=user.phone, nickname=user.nickname,
        avatar=user.avatar, age=user.age, gender=user.gender, city=user.city,
        occupation=user.occupation, bio=user.bio,
        interests=user.interests or [], personality_tags=user.personality_tags or [],
        photos=user.photos or [],
        is_admin=user.is_admin, status=user.status,
        is_active=user.is_active,
        created_at=user.created_at, updated_at=user.updated_at,
    )


# ==================== 5. 编辑用户 ====================
@admin_router.put("/users/{user_id}", response_model=AdminUserResponse)
async def admin_user_update(
    user_id: int, data: AdminUserUpdate,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="用户不存在")

    updates = data.model_dump(exclude_unset=True)
    for key, value in updates.items():
        setattr(user, key, value)
    user.updated_at = datetime.utcnow()
    await db.commit()
    await db.refresh(user)

    detail_json = json.dumps(updates, ensure_ascii=False)
    await add_admin_log(db, admin.id, "user_edit", target_id=user_id, detail=detail_json)

    return AdminUserResponse(
        id=user.id, phone=user.phone, nickname=user.nickname,
        avatar=user.avatar, age=user.age, gender=user.gender, city=user.city,
        occupation=user.occupation, bio=user.bio,
        interests=user.interests or [], personality_tags=user.personality_tags or [],
        is_admin=user.is_admin, status=user.status,
        is_active=user.is_active,
        created_at=user.created_at, updated_at=user.updated_at,
    )


# ==================== 6. 封禁/解封 ====================
@admin_router.put("/users/{user_id}/ban")
async def admin_user_ban(
    user_id: int, data: AdminBanRequest,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="用户不存在")

    new_status = "banned" if user.status == "active" else "active"
    user.status = new_status
    user.is_active = (new_status == "active")
    user.updated_at = datetime.utcnow()
    await db.commit()

    reason = data.reason or ""
    await add_admin_log(db, admin.id, "user_ban", target_id=user_id,
                        detail=f"{'封禁' if new_status == 'banned' else '解封'}用户 {user.phone}，原因：{reason}")

    action_text = "已封禁" if new_status == "banned" else "已解封"
    return {"message": f"用户{action_text}", "status": new_status}


# ==================== 7. 删除用户 ====================
@admin_router.delete("/users/{user_id}")
async def admin_user_delete(
    user_id: int,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="用户不存在")
    if user.is_admin:
        raise HTTPException(status_code=403, detail="不能删除管理员账号")

    phone = user.phone
    # 删除关联数据
    await db.execute(delete(ChatMessage).where(or_(ChatMessage.from_user_id == user_id, ChatMessage.to_user_id == user_id)))
    await db.execute(delete(BehaviorLog).where(BehaviorLog.user_id == user_id))
    await db.execute(delete(UserAction).where(or_(UserAction.user_id == user_id, UserAction.target_user_id == user_id)))
    await db.delete(user)
    await db.commit()

    await add_admin_log(db, admin.id, "user_delete", target_id=user_id, detail=f"删除用户 {phone}")
    return {"message": "用户已删除", "user_id": user_id}


# ==================== 8. 行为日志 ====================
@admin_router.get("/logs")
async def admin_logs(
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    user_id: Optional[int] = None,
    action: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    query = select(BehaviorLog)
    count_q = select(func.count(BehaviorLog.id))
    filters = []
    if user_id:
        filters.append(BehaviorLog.user_id == user_id)
    if action:
        filters.append(BehaviorLog.action == action)
    if filters:
        query = query.where(and_(*filters))
        count_q = count_q.where(and_(*filters))

    total = await db.scalar(count_q)
    result = await db.execute(
        query.order_by(BehaviorLog.created_at.desc())
        .offset((page - 1) * page_size).limit(page_size)
    )
    logs = result.scalars().all()

    return {
        "total": total or 0, "page": page, "page_size": page_size,
        "items": [
            {"id": l.id, "user_id": l.user_id, "target_user_id": l.target_user_id,
             "action": l.action, "duration_ms": l.duration_ms, "extra": l.extra,
             "created_at": str(l.created_at)} for l in logs
        ]
    }


# ==================== 9. 交互记录 ====================
@admin_router.get("/actions")
async def admin_actions(
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    user_id: Optional[int] = None,
    action_type: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    query = select(UserAction)
    count_q = select(func.count(UserAction.id))
    filters = []
    if user_id:
        filters.append(UserAction.user_id == user_id)
    if action_type:
        filters.append(UserAction.action_type == action_type)
    if filters:
        query = query.where(and_(*filters))
        count_q = count_q.where(and_(*filters))

    total = await db.scalar(count_q)
    result = await db.execute(
        query.order_by(UserAction.created_at.desc())
        .offset((page - 1) * page_size).limit(page_size)
    )
    actions = result.scalars().all()

    return {
        "total": total or 0, "page": page, "page_size": page_size,
        "items": [
            {"id": a.id, "user_id": a.user_id, "target_user_id": a.target_user_id,
             "action_type": a.action_type, "created_at": str(a.created_at)} for a in actions
        ]
    }


# ==================== 10. 聊天监控 ====================
@admin_router.get("/chats")
async def admin_chats(
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    from_user_id: Optional[int] = None,
    to_user_id: Optional[int] = None,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    query = select(ChatMessage)
    count_q = select(func.count(ChatMessage.id))
    filters = []
    if from_user_id:
        filters.append(ChatMessage.from_user_id == from_user_id)
    if to_user_id:
        filters.append(ChatMessage.to_user_id == to_user_id)
    if filters:
        query = query.where(and_(*filters))
        count_q = count_q.where(and_(*filters))

    total = await db.scalar(count_q)
    result = await db.execute(
        query.order_by(ChatMessage.created_at.desc())
        .offset((page - 1) * page_size).limit(page_size)
    )
    msgs = result.scalars().all()

    return {
        "total": total or 0, "page": page, "page_size": page_size,
        "items": [
            {"id": m.id, "from_user_id": m.from_user_id, "to_user_id": m.to_user_id,
             "content": m.content[:500], "is_read": m.is_read,
             "created_at": str(m.created_at)} for m in msgs
        ]
    }


# ==================== 11. 管理员操作日志 ====================
@admin_router.get("/admin-logs")
async def admin_admin_logs(
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    total = await db.scalar(select(func.count(AdminLog.id)))
    result = await db.execute(
        select(AdminLog).order_by(AdminLog.created_at.desc())
        .offset((page - 1) * page_size).limit(page_size)
    )
    logs = result.scalars().all()

    return {
        "total": total or 0, "page": page, "page_size": page_size,
        "items": [
            {"id": l.id, "admin_id": l.admin_id, "action": l.action,
             "target_id": l.target_id, "detail": l.detail,
             "created_at": str(l.created_at)} for l in logs
        ]
    }


# ==================== 12. 会员管理 - 会员列表 ====================
@admin_router.get("/vip/list")
async def admin_vip_list(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    keyword: Optional[str] = None,
    vip_level: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    query = select(User)
    count_query = select(func.count(User.id))
    filters = []
    
    if keyword:
        filters.append(or_(User.nickname.contains(keyword), User.phone.contains(keyword)))
    if vip_level:
        filters.append(User.vip_level == vip_level)
    
    if filters:
        query = query.where(and_(*filters))
        count_query = count_query.where(and_(*filters))
    
    total = await db.scalar(count_query)
    result = await db.execute(query.order_by(desc(User.vip_expire_at)).offset((page - 1) * page_size).limit(page_size))
    users = result.scalars().all()
    
    return {
        "total": total or 0, "page": page, "page_size": page_size,
        "users": [
            {
                "id": u.id, "phone": mask_phone(u.phone), "nickname": u.nickname,
                "vip_level": u.vip_level, "vip_expire_at": str(u.vip_expire_at) if u.vip_expire_at else None,
                "vip_auto_renew": u.vip_auto_renew, "created_at": str(u.created_at)
            } for u in users
        ]
    }


# ==================== 13. 会员管理 - 会员统计 ====================
@admin_router.get("/vip/stats")
async def admin_vip_stats(
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    now = datetime.utcnow()
    
    free_count = await db.scalar(select(func.count(User.id)).where(User.vip_level == "free"))
    vip_count = await db.scalar(select(func.count(User.id)).where(User.vip_level == "vip"))
    svip_count = await db.scalar(select(func.count(User.id)).where(User.vip_level == "svip"))
    
    active_vip = await db.scalar(
        select(func.count(User.id)).where(and_(User.vip_level != "free", User.vip_expire_at > now))
    )
    expired_vip = await db.scalar(
        select(func.count(User.id)).where(and_(User.vip_level != "free", User.vip_expire_at <= now))
    )
    
    return {
        "total_free": free_count or 0,
        "total_vip": vip_count or 0,
        "total_svip": svip_count or 0,
        "active_vip": active_vip or 0,
        "expired_vip": expired_vip or 0,
        "total_users": (free_count or 0) + (vip_count or 0) + (svip_count or 0)
    }


# ==================== 14. 会员管理 - 升级/降级会员 ====================
@admin_router.put("/vip/update/{user_id}")
async def admin_vip_update(
    user_id: int,
    data: dict,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="用户不存在")
    
    vip_level = data.get("vip_level", "").lower()
    if vip_level not in ["free", "vip", "svip"]:
        raise HTTPException(status_code=400, detail="无效的会员等级")
    
    duration_days = data.get("duration_days", 30)
    
    user.vip_level = vip_level
    if vip_level != "free":
        if user.vip_expire_at and user.vip_expire_at > datetime.utcnow():
            user.vip_expire_at = user.vip_expire_at + timedelta(days=duration_days)
        else:
            user.vip_expire_at = datetime.utcnow() + timedelta(days=duration_days)
    else:
        user.vip_expire_at = None
    
    user.vip_auto_renew = data.get("vip_auto_renew", False)
    user.updated_at = datetime.utcnow()
    await db.commit()
    await db.refresh(user)
    
    await add_admin_log(db, admin.id, "vip_update", target_id=user_id,
                        detail=f"修改会员等级为 {vip_level}，有效期 {duration_days} 天")
    
    return {
        "message": f"会员等级已更新为 {vip_level}",
        "user_id": user_id,
        "vip_level": user.vip_level,
        "vip_expire_at": str(user.vip_expire_at) if user.vip_expire_at else None
    }


# ==================== 15. 会员管理 - 延长有效期 ====================
@admin_router.put("/vip/extend/{user_id}")
async def admin_vip_extend(
    user_id: int,
    data: dict,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="用户不存在")
    
    duration_days = data.get("duration_days", 30)
    if user.vip_expire_at and user.vip_expire_at > datetime.utcnow():
        user.vip_expire_at = user.vip_expire_at + timedelta(days=duration_days)
    else:
        user.vip_expire_at = datetime.utcnow() + timedelta(days=duration_days)
    
    user.updated_at = datetime.utcnow()
    await db.commit()
    await db.refresh(user)
    
    await add_admin_log(db, admin.id, "vip_extend", target_id=user_id,
                        detail=f"延长会员有效期 {duration_days} 天")
    
    return {
        "message": f"会员有效期已延长 {duration_days} 天",
        "vip_expire_at": str(user.vip_expire_at)
    }


# ==================== 验证当前管理员 ====================
@admin_router.get("/me")
async def admin_me(admin: User = Depends(get_current_admin)):
    return {"id": admin.id, "phone": mask_phone(admin.phone), "nickname": admin.nickname, "is_admin": admin.is_admin}
