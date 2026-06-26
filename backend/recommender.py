"""
推荐系统与行为分析模块

推荐策略说明：

1. 冷启动策略：新用户推荐最活跃的用户
2. 标签匹配推荐：基于兴趣标签和性格标签的交集
3. 行为加权推荐：根据用户历史行为加权排序
   - 浏览详情 +5分
   - 喜欢 +10分
   - 停留>3秒 +3分
   - 跳过 -2分
4. 热门推荐：综合活跃度 + 被喜欢次数
5. 综合推荐：以上策略加权融合
"""
from typing import List, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_, or_, case
from models import User, UserAction, BehaviorLog


async def get_recommend_users(
    db: AsyncSession,
    current_user_id: int,
    page: int = 1,
    page_size: int = 10,
    gender: Optional[str] = None,
    min_age: Optional[int] = None,
    max_age: Optional[int] = None,
    city: Optional[str] = None,
    tags: Optional[List[str]] = None,
) -> tuple[List[User], int]:
    """
    综合推荐算法：
    1. 排除自己和已操作过的用户
    2. 应用筛选条件
    3. 计算匹配度分数排序
    """

    # 获取已操作过的用户ID
    acted_result = await db.execute(
        select(UserAction.target_user_id).where(UserAction.user_id == current_user_id)
    )
    acted_ids = [row[0] for row in acted_result.all()]
    acted_ids.append(current_user_id)

    # 基础查询
    query = select(User).where(
        User.is_active == True,
        User.id.notin_(acted_ids),
    )

    # 用户偏好筛选
    if gender:
        query = query.where(User.gender == gender)
    if min_age is not None:
        query = query.where(User.age >= min_age)
    if max_age is not None:
        query = query.where(User.age <= max_age)
    if city:
        query = query.where(User.city == city)

    # 获取总数
    count_query = select(func.count()).select_from(query.subquery())
    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0

    # 获取当前用户的兴趣标签
    user_result = await db.execute(select(User).where(User.id == current_user_id))
    current_user = user_result.scalar_one_or_none()
    user_interests = set(current_user.interests or []) if current_user else set()
    user_tags = set(current_user.personality_tags or []) if current_user else set()
    user_pref_tags = set(current_user.preference.get("tags", [])) if current_user and current_user.preference else set()

    # 获取所有候选用户
    result = await db.execute(query)
    candidates = result.scalars().all()

    # 标签筛选（后置过滤）
    if tags:
        filtered = []
        for c in candidates:
            c_all_tags = set(c.interests or []) | set(c.personality_tags or [])
            if c_all_tags & set(tags):
                filtered.append(c)
        candidates = filtered

    # 计算匹配分数并排序
    scored_users = []
    for candidate in candidates:
        score = 0
        reasons = []

        # 标签匹配分数（权重最高）
        c_interests = set(candidate.interests or [])
        c_tags = set(candidate.personality_tags or [])
        common_interests = user_interests & c_interests
        common_tags = user_tags & c_tags
        tag_score = len(common_interests) * 15 + len(common_tags) * 10
        if common_interests:
            reasons.append(f"共同兴趣: {', '.join(list(common_interests)[:3])}")
        if common_tags:
            reasons.append(f"性格相似: {', '.join(list(common_tags)[:3])}")
        score += tag_score

        # 偏好匹配
        if user_pref_tags:
            pref_match = user_pref_tags & c_all_tags
            score += len(pref_match) * 8

        # 同城加分
        if current_user and candidate.city == current_user.city:
            score += 20
            reasons.append("同城")

        # 年龄偏好匹配
        if current_user and current_user.preference:
            pref_min = current_user.preference.get("min_age", 18)
            pref_max = current_user.preference.get("max_age", 50)
            if pref_min <= candidate.age <= pref_max:
                score += 10

        # 活跃度加分（有头像 + 有个人介绍）
        if candidate.avatar:
            score += 5
        if candidate.bio and len(candidate.bio) > 10:
            score += 5

        # 随机因素（避免结果过于固化）
        import random
        score += random.randint(0, 10)

        scored_users.append((candidate, score, reasons))

    # 按分数降序排列
    scored_users.sort(key=lambda x: x[1], reverse=True)

    # 分页
    start = (page - 1) * page_size
    end = start + page_size
    page_users = scored_users[start:end]

    # 返回用户列表（附带匹配原因）
    result_users = []
    for user, score, reasons in page_users:
        user._score = score
        user._reasons = reasons
        user._common_interests = list(
            user_interests & set(user.interests or [])
        )
        result_users.append(user)

    return result_users, total


async def analyze_user_behavior(db: AsyncSession, user_id: int) -> dict:
    """用户行为分析 - 输出用户偏好画像"""

    # 行为统计
    total_views = await db.scalar(
        select(func.count()).select_from(BehaviorLog).where(
            BehaviorLog.user_id == user_id,
            BehaviorLog.action.in_(["view_card", "click_detail"])
        )
    ) or 0

    total_likes = await db.scalar(
        select(func.count()).select_from(UserAction).where(
            UserAction.user_id == user_id,
            UserAction.action_type == "like"
        )
    ) or 0

    total_skips = await db.scalar(
        select(func.count()).select_from(UserAction).where(
            UserAction.user_id == user_id,
            UserAction.action_type == "skip"
        )
    ) or 0

    like_rate = round(total_likes / (total_likes + total_skips) * 100, 1) if (total_likes + total_skips) > 0 else 0

    # 获取 liked 用户的属性分布
    liked_result = await db.execute(
        select(UserAction.target_user_id).where(
            UserAction.user_id == user_id,
            UserAction.action_type == "like"
        )
    )
    liked_ids = [row[0] for row in liked_result.all()]

    preferred_genders = {}
    preferred_ages = {"18-24": 0, "25-30": 0, "31-35": 0, "36+": 0}
    preferred_cities = {}
    preferred_tags = {}

    if liked_ids:
        liked_users_result = await db.execute(
            select(User).where(User.id.in_(liked_ids))
        )
        liked_users = liked_users_result.scalars().all()

        for u in liked_users:
            # 性别统计
            preferred_genders[u.gender] = preferred_genders.get(u.gender, 0) + 1
            # 年龄段统计
            if u.age <= 24:
                preferred_ages["18-24"] += 1
            elif u.age <= 30:
                preferred_ages["25-30"] += 1
            elif u.age <= 35:
                preferred_ages["31-35"] += 1
            else:
                preferred_ages["36+"] += 1
            # 城市统计
            preferred_cities[u.city] = preferred_cities.get(u.city, 0) + 1
            # 标签统计
            for tag in (u.interests or []) + (u.personality_tags or []):
                preferred_tags[tag] = preferred_tags.get(tag, 0) + 1

    # 最近行为
    recent_result = await db.execute(
        select(BehaviorLog).where(BehaviorLog.user_id == user_id)
        .order_by(BehaviorLog.created_at.desc()).limit(10)
    )
    recent_behaviors = [
        {
            "action": b.action,
            "target_user_id": b.target_user_id,
            "duration_ms": b.duration_ms,
            "created_at": b.created_at.isoformat() if b.created_at else "",
        }
        for b in recent_result.scalars().all()
    ]

    return {
        "user_id": user_id,
        "total_views": total_views,
        "total_likes": total_likes,
        "total_skips": total_skips,
        "like_rate": like_rate,
        "preferred_genders": dict(sorted(preferred_genders.items(), key=lambda x: x[1], reverse=True)),
        "preferred_ages": preferred_ages,
        "preferred_cities": dict(sorted(preferred_cities.items(), key=lambda x: x[1], reverse=True)),
        "preferred_tags": dict(sorted(preferred_tags.items(), key=lambda x: x[1], reverse=True)[:10]),
        "recent_behaviors": recent_behaviors,
    }
