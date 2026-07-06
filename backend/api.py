"""RESTful API 路由"""
import os
import uuid
import random
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, Query, status, WebSocket, WebSocketDisconnect, UploadFile, File
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_, or_, desc

from database import get_db
from models import User, UserAction, BehaviorLog, ChatMessage
from schemas import (
    UserRegister, UserLogin, UserUpdate, PreferenceUpdate,
    UserResponse, UserCardResponse, TokenResponse,
    ActionCreate, BehaviorLogCreate, RecommendResponse, AnalysisResponse, MatchResponse,
    SendMessageRequest, AIChatRequest,
)
from auth import hash_password, verify_password, is_old_hash, create_access_token, get_current_user
from recommender import get_recommend_users, analyze_user_behavior
from vip_service import get_vip_info, check_like_limit, check_ai_chat_limit, buy_vip, get_vip_packages, get_vip_privileges
from config import UPLOAD_DIR, MAX_UPLOAD_SIZE

router = APIRouter(prefix="/api", tags=["API"])


# ==================== 用户系统 ====================

@router.post("/register", response_model=TokenResponse, status_code=201)
async def register(data: UserRegister, db: AsyncSession = Depends(get_db)):
    """用户注册"""
    existing = await db.execute(select(User).where(User.phone == data.phone))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="该手机号已注册")

    user = User(
        phone=data.phone,
        password_hash=hash_password(data.password),
        nickname=data.nickname,
        gender=data.gender,
        preference={"min_age": 20, "max_age": 35, "gender": "", "cities": [], "tags": []},
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)

    token = create_access_token({"sub": str(user.id)})
    return TokenResponse(access_token=token, user=UserResponse.model_validate(user))


@router.post("/login", response_model=TokenResponse)
async def login(data: UserLogin, db: AsyncSession = Depends(get_db)):
    """用户登录"""
    result = await db.execute(select(User).where(User.phone == data.phone))
    user = result.scalar_one_or_none()
    if not user or not verify_password(data.password, user.password_hash):
        raise HTTPException(status_code=401, detail="手机号或密码错误")

    if is_old_hash(user.password_hash):
        user.password_hash = hash_password(data.password)
        await db.commit()

    token = create_access_token({"sub": str(user.id)})
    return TokenResponse(access_token=token, user=UserResponse.model_validate(user))


@router.get("/me", response_model=UserResponse)
async def get_me(current_user: User = Depends(get_current_user)):
    """获取当前用户信息"""
    return UserResponse.model_validate(current_user)


@router.put("/me", response_model=UserResponse)
async def update_me(
    data: UserUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """更新用户信息"""
    update_data = data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(current_user, key, value)
    await db.commit()
    await db.refresh(current_user)
    return UserResponse.model_validate(current_user)


@router.put("/me/preference", response_model=UserResponse)
async def update_preference(
    data: PreferenceUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """更新择偶偏好"""
    pref = current_user.preference or {}
    update_data = data.model_dump(exclude_unset=True)
    pref.update(update_data)
    current_user.preference = pref
    await db.commit()
    await db.refresh(current_user)
    return UserResponse.model_validate(current_user)


# ==================== 图片上传 ====================

@router.post("/upload-avatar")
async def upload_avatar(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """上传用户头像"""
    # 校验文件类型
    if file.content_type not in ("image/jpeg", "image/png", "image/gif", "image/webp"):
        raise HTTPException(status_code=400, detail="仅支持 JPG/PNG/GIF/WebP 格式")

    # 读取并校验大小
    content = await file.read()
    if len(content) > MAX_UPLOAD_SIZE:
        raise HTTPException(status_code=400, detail=f"图片不能超过 {MAX_UPLOAD_SIZE // (1024*1024)}MB")

    # 保存文件
    ext = file.filename.rsplit(".", 1)[-1] if "." in (file.filename or "") else "jpg"
    filename = f"avatar_{uuid.uuid4().hex[:8]}.{ext}"
    user_dir = os.path.join(UPLOAD_DIR, str(current_user.id))
    os.makedirs(user_dir, exist_ok=True)
    filepath = os.path.join(user_dir, filename)

    with open(filepath, "wb") as f:
        f.write(content)

    # 更新头像 URL
    avatar_url = f"/uploads/{current_user.id}/{filename}"
    current_user.avatar = avatar_url
    await db.commit()
    await db.refresh(current_user)

    return {"success": True, "avatar_url": avatar_url}


@router.post("/upload-photo")
async def upload_photo(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """上传相册照片"""
    if file.content_type not in ("image/jpeg", "image/png", "image/gif", "image/webp"):
        raise HTTPException(status_code=400, detail="仅支持 JPG/PNG/GIF/WebP 格式")

    content = await file.read()
    if len(content) > MAX_UPLOAD_SIZE:
        raise HTTPException(status_code=400, detail=f"图片不能超过 {MAX_UPLOAD_SIZE // (1024*1024)}MB")

    # 限制相册最多9张
    photos = current_user.photos or []
    if len(photos) >= 9:
        raise HTTPException(status_code=400, detail="相册最多9张照片")

    ext = file.filename.rsplit(".", 1)[-1] if "." in (file.filename or "") else "jpg"
    filename = f"photo_{uuid.uuid4().hex[:8]}.{ext}"
    user_dir = os.path.join(UPLOAD_DIR, str(current_user.id))
    os.makedirs(user_dir, exist_ok=True)
    filepath = os.path.join(user_dir, filename)

    with open(filepath, "wb") as f:
        f.write(content)

    photo_url = f"/uploads/{current_user.id}/{filename}"
    photos.append(photo_url)
    current_user.photos = photos
    await db.commit()
    await db.refresh(current_user)

    return {"success": True, "photo_url": photo_url, "photos": photos}


@router.delete("/photos/{filename}")
async def delete_photo(
    filename: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """删除相册照片"""
    photos = current_user.photos or []
    target_url = f"/uploads/{current_user.id}/{filename}"
    if target_url not in photos:
        raise HTTPException(status_code=404, detail="照片不存在")

    # 删除文件
    filepath = os.path.join(UPLOAD_DIR, str(current_user.id), filename)
    if os.path.exists(filepath):
        os.remove(filepath)

    photos.remove(target_url)
    current_user.photos = photos
    await db.commit()

    return {"success": True, "photos": photos}


# ==================== 推荐系统 ====================

@router.get("/recommend", response_model=RecommendResponse)
async def get_recommendations(
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=50),
    gender: Optional[str] = Query(None),
    min_age: Optional[int] = Query(None),
    max_age: Optional[int] = Query(None),
    city: Optional[str] = Query(None),
    tags: Optional[str] = Query(None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """获取推荐用户列表"""
    tag_list = tags.split(",") if tags else None

    users, total = await get_recommend_users(
        db, current_user.id, page, page_size,
        gender=gender, min_age=min_age, max_age=max_age,
        city=city, tags=tag_list,
    )

    cards = []
    for u in users:
        common = getattr(u, "_common_interests", [])
        reasons = getattr(u, "_reasons", [])
        cards.append(UserCardResponse(
            id=u.id,
            nickname=u.nickname,
            avatar=u.avatar,
            age=u.age,
            gender=u.gender,
            city=u.city,
            occupation=u.occupation,
            bio=u.bio,
            interests=u.interests or [],
            personality_tags=u.personality_tags or [],
            common_interests=common,
            recommend_reason="、".join(reasons) if reasons else "系统推荐",
        ))

    return RecommendResponse(users=cards, total=total, page=page, page_size=page_size)


@router.get("/users/{user_id}", response_model=UserResponse)
async def get_user_detail(
    user_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """查看用户详情"""
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="用户不存在")

    log = BehaviorLog(
        user_id=current_user.id,
        target_user_id=user_id,
        action="click_detail",
        duration_ms=0,
    )
    db.add(log)
    await db.commit()

    return UserResponse.model_validate(user)


@router.get("/users/{user_id}/likes")
async def get_user_likes(
    user_id: int,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=50),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """获取用户喜欢的列表（支持分页）"""
    if user_id != current_user.id:
        raise HTTPException(status_code=403, detail="只能查看自己的喜欢列表")

    total_result = await db.execute(
        select(func.count(UserAction.id))
        .where(
            UserAction.user_id == user_id,
            UserAction.action_type == "like",
        )
    )
    total = total_result.scalar() or 0

    offset = (page - 1) * page_size
    liked_users = await db.execute(
        select(User)
        .join(UserAction, UserAction.target_user_id == User.id)
        .where(
            UserAction.user_id == user_id,
            UserAction.action_type == "like",
        )
        .order_by(UserAction.created_at.desc())
        .offset(offset)
        .limit(page_size)
    )

    users = liked_users.scalars().all()
    return {
        "users": [UserCardResponse.model_validate(u) for u in users],
        "total": total,
        "page": page,
        "page_size": page_size,
        "has_more": total > offset + len(users),
    }


# ==================== 交互行为 ====================

@router.post("/actions")
async def create_action(
    data: ActionCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """记录用户交互行为"""
    if data.target_user_id == current_user.id:
        raise HTTPException(status_code=400, detail="不能对自己操作")

    result = await db.execute(select(User).where(User.id == data.target_user_id))
    target = result.scalar_one_or_none()
    if not target:
        raise HTTPException(status_code=404, detail="目标用户不存在")

    if data.action_type == "like":
        can_like, message = await check_like_limit(db, current_user.id, "like")
        if not can_like:
            raise HTTPException(status_code=403, detail=message)

        existing_like = await db.execute(
            select(UserAction).where(
                UserAction.user_id == current_user.id,
                UserAction.target_user_id == data.target_user_id,
                UserAction.action_type == "like",
            )
        )
        if existing_like.scalar_one_or_none():
            raise HTTPException(status_code=400, detail="您已经喜欢过该用户")

    action = UserAction(
        user_id=current_user.id,
        target_user_id=data.target_user_id,
        action_type=data.action_type,
    )
    db.add(action)

    log = BehaviorLog(
        user_id=current_user.id,
        target_user_id=data.target_user_id,
        action=data.action_type,
    )
    db.add(log)

    is_matched = False
    if data.action_type == "like":
        reverse = await db.execute(
            select(UserAction).where(
                UserAction.user_id == data.target_user_id,
                UserAction.target_user_id == current_user.id,
                UserAction.action_type == "like",
            )
        )
        if reverse.scalar_one_or_none():
            is_matched = True

    await db.commit()

    return {
        "success": True,
        "is_matched": is_matched,
        "message": "匹配成功！你们互相喜欢！" if is_matched else "操作成功",
    }


@router.post("/behaviors")
async def log_behavior(
    data: BehaviorLogCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """记录用户行为日志"""
    log = BehaviorLog(
        user_id=current_user.id,
        target_user_id=data.target_user_id,
        action=data.action,
        duration_ms=data.duration_ms,
        extra=data.extra,
    )
    db.add(log)
    await db.commit()
    return {"success": True}


@router.get("/matches")
async def get_matches(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """获取与我互相喜欢的用户列表"""
    my_likes_result = await db.execute(
        select(UserAction.target_user_id).where(
            UserAction.user_id == current_user.id,
            UserAction.action_type == "like",
        )
    )
    my_like_ids = [row[0] for row in my_likes_result.all()]

    if not my_like_ids:
        return {"matches": [], "total": 0}

    reverse_result = await db.execute(
        select(UserAction.user_id).where(
            UserAction.user_id.in_(my_like_ids),
            UserAction.target_user_id == current_user.id,
            UserAction.action_type == "like",
        )
    )
    matched_ids = [row[0] for row in reverse_result.all()]

    if not matched_ids:
        return {"matches": [], "total": 0}

    matched_users_result = await db.execute(
        select(User).where(User.id.in_(matched_ids))
    )
    matched_users = matched_users_result.scalars().all()

    return {
        "matches": [
            {
                "id": u.id,
                "nickname": u.nickname,
                "avatar": u.avatar,
                "age": u.age,
                "city": u.city,
                "gender": u.gender,
                "occupation": u.occupation,
            }
            for u in matched_users
        ],
        "total": len(matched_users),
    }


@router.get("/chat-list")
async def get_chat_list(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """获取聊天列表 - 双向：谁喜欢/打招呼给我 + 我喜欢/打招呼了谁"""
    # 别人对我的操作
    to_me_result = await db.execute(
        select(UserAction.user_id, UserAction.action_type, UserAction.created_at).where(
            UserAction.target_user_id == current_user.id,
            UserAction.action_type.in_(["like", "greet"]),
        )
    )
    to_me_all = to_me_result.all()

    # 我对别人的操作
    from_me_result = await db.execute(
        select(UserAction.target_user_id, UserAction.action_type, UserAction.created_at).where(
            UserAction.user_id == current_user.id,
            UserAction.action_type.in_(["like", "greet"]),
        )
    )
    from_me_all = from_me_result.all()

    # 合并去重，保留最新交互
    contact_map = {}
    for user_id, action_type, created_at in to_me_all:
        if user_id not in contact_map or created_at > contact_map[user_id]["created_at"]:
            contact_map[user_id] = {"action_type": action_type, "created_at": created_at}
    for user_id, action_type, created_at in from_me_all:
        if user_id not in contact_map or created_at > contact_map[user_id]["created_at"]:
            contact_map[user_id] = {"action_type": action_type, "created_at": created_at}

    # 按最新交互时间排序
    sorted_contacts = sorted(contact_map.items(), key=lambda x: x[1]["created_at"], reverse=True)

    chat_list = []
    for contact_id, info in sorted_contacts:
        user_result = await db.execute(select(User).where(User.id == contact_id))
        user = user_result.scalar_one_or_none()
        if not user:
            continue

        # 获取最后一条聊天消息
        last_msg_result = await db.execute(
            select(ChatMessage).where(
                or_(
                    and_(ChatMessage.from_user_id == contact_id, ChatMessage.to_user_id == current_user.id),
                    and_(ChatMessage.from_user_id == current_user.id, ChatMessage.to_user_id == contact_id),
                )
            ).order_by(desc(ChatMessage.created_at)).limit(1)
        )
        last_msg = last_msg_result.scalar_one_or_none()

        chat_list.append({
            "user_id": user.id,
            "nickname": user.nickname,
            "avatar": user.avatar,
            "gender": user.gender,
            "last_action": info["action_type"],
            "last_message": last_msg.content if last_msg else ("你好呀~" if info["action_type"] == "greet" else "对你心动了！"),
            "time": (last_msg.created_at if last_msg else info["created_at"]).isoformat() if (last_msg or info["created_at"]) else "",
        })

    return {"chat_list": chat_list, "total": len(chat_list)}


# ==================== 聊天消息 API ====================

@router.get("/chat-messages/{target_user_id}")
async def get_chat_messages(
    target_user_id: int,
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """获取与某用户的聊天记录"""
    result = await db.execute(
        select(ChatMessage).where(
            or_(
                and_(ChatMessage.from_user_id == current_user.id, ChatMessage.to_user_id == target_user_id),
                and_(ChatMessage.from_user_id == target_user_id, ChatMessage.to_user_id == current_user.id),
            )
        ).order_by(desc(ChatMessage.created_at)).offset((page - 1) * page_size).limit(page_size)
    )
    messages = result.scalars().all()

    # 标记已读
    for msg in messages:
        if msg.to_user_id == current_user.id and not msg.is_read:
            msg.is_read = True
    await db.commit()

    return {
        "messages": [
            {
                "id": m.id,
                "from_user_id": m.from_user_id,
                "to_user_id": m.to_user_id,
                "content": m.content,
                "is_read": m.is_read,
                "created_at": m.created_at.isoformat() if m.created_at else "",
            }
            for m in reversed(messages)
        ],
        "total": len(messages),
    }


@router.post("/chat-messages/{target_user_id}")
async def send_chat_message(
    target_user_id: int,
    data: SendMessageRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """发送聊天消息"""
    msg = ChatMessage(
        from_user_id=current_user.id,
        to_user_id=target_user_id,
        content=data.content,
    )
    db.add(msg)
    await db.commit()
    await db.refresh(msg)

    return {
        "id": msg.id,
        "from_user_id": msg.from_user_id,
        "to_user_id": msg.to_user_id,
        "content": msg.content,
        "is_read": msg.is_read,
        "created_at": msg.created_at.isoformat() if msg.created_at else "",
    }


# ==================== 行为分析 ====================

@router.get("/analysis", response_model=AnalysisResponse)
async def get_analysis(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """获取用户行为分析报告"""
    result = await analyze_user_behavior(db, current_user.id)
    return result


# ==================== AI 聊天助手 ====================

@router.post("/ai-chat")
async def ai_chat(
    data: AIChatRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """AI 聊天助手 - 模拟异性对话，提升情商"""
    can_chat, message = await check_ai_chat_limit(db, current_user.id)
    if not can_chat:
        raise HTTPException(status_code=403, detail=message)

    from ai_chat import get_system_prompt, chat_with_ai

    system_prompt = get_system_prompt(data.gender)
    full_messages = [{"role": "system", "content": system_prompt}] + data.messages

    try:
        result = await chat_with_ai(full_messages)

        log = BehaviorLog(
            user_id=current_user.id,
            action="ai_chat",
            extra={"gender": data.gender},
        )
        db.add(log)
        await db.commit()

        return {
            "success": True,
            "reply": result["reply"],
            "usage": result["usage"],
            "gender": data.gender,
        }
    except ValueError as e:
        raise HTTPException(status_code=502, detail=str(e))


# ==================== VIP 会员 ====================

@router.get("/vip/info")
async def get_vip_info_api(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """获取当前用户会员信息"""
    info = await get_vip_info(db, current_user.id)
    if not info:
        raise HTTPException(status_code=404, detail="用户不存在")
    return info


@router.get("/vip/packages")
async def get_vip_packages_api():
    """获取所有VIP套餐"""
    return {"packages": get_vip_packages()}


@router.get("/vip/privileges")
async def get_vip_privileges_api(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """获取会员特权列表"""
    vip_level = await get_vip_info(db, current_user.id)
    level = vip_level["vip_level"] if vip_level else "free"
    return {"privileges": get_vip_privileges(level)}


@router.post("/vip/buy")
async def buy_vip_api(
    package_code: str = Query(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """购买VIP会员（模拟支付）"""
    try:
        result = await buy_vip(db, current_user.id, package_code)
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


# ==================== 筛选标签 ====================

@router.get("/tags")
async def get_all_tags():
    """获取所有可用标签"""
    return {
        "interests": ["旅行", "摄影", "美食", "电影", "音乐", "绘画", "手作", "看展", "咖啡",
                      "健身", "跑步", "攀岩", "篮球", "动漫", "cosplay", "游戏", "阅读", "品酒",
                      "瑜伽", "编程", "烹饪", "骑行", "吉他", "钢琴", "唱歌", "探店", "宠物",
                      "追剧", "逛街", "户外", "读书", "冥想", "素食", "电竞", "滑雪", "潜水"],
        "personality": ["开朗", "幽默", "细心", "文艺", "温柔", "独立", "阳光", "自律", "活泼",
                        "可爱", "成熟", "知性", "浪漫", "随和", "安静", "热血", "宅", "外向", "内向"],
    }


# ==================== 平台统计 ====================

@router.get("/stats")
async def get_platform_stats(db: AsyncSession = Depends(get_db)):
    """获取平台统计数据（总数、男女比例等）"""
    total = await db.scalar(select(func.count(User.id)).where(User.is_active == True))
    male = await db.scalar(select(func.count(User.id)).where(User.gender == "male", User.is_active == True))
    female = await db.scalar(select(func.count(User.id)).where(User.gender == "female", User.is_active == True))

    # 获取城市分布 top10
    from sqlalchemy import text
    city_result = await db.execute(
        select(User.city, func.count(User.id).label("cnt"))
        .where(User.city != "", User.is_active == True)
        .group_by(User.city)
        .order_by(desc(func.count(User.id)))
        .limit(10)
    )
    cities = [{"name": row.city, "count": row.cnt} for row in city_result.all()]

    return {
        "total": total or 0,
        "male": male or 0,
        "female": female or 0,
        "cities": cities,
    }
