"""批量创建100个女性模拟用户，每人绑定一张真实照片"""
import json
import os
import random
import asyncio
from sqlalchemy import select
from database import async_session, init_db
from models import User
from auth import hash_password

# 素材库
SURNAMES = [
    "苏", "林", "陈", "李", "王", "张", "赵", "周", "吴", "郑",
    "刘", "黄", "杨", "徐", "孙", "马", "朱", "胡", "郭", "何",
    "高", "罗", "梁", "宋", "唐", "韩", "曹", "许", "邓", "萧",
]
NAME_CHARS = ["晓", "雨", "诗", "涵", "萱", "怡", "瑶", "琳", "婷", "雪",
              "晴", "悦", "静", "文", "思", "若", "灵", "雅", "妍", "佳",
              "然", "彤", "琪", "璇", "萌", "甜", "蕾", "薇", "荷", "舒"]
NICK_PREFIXES = ["", "小", "阿", "甜", "软", "暖", "萌", "懒", "傲娇", "",
                 "", "爱吃", "爱笑", "爱哭", "发呆", "追剧", "撸猫", "画画", "唱歌", "跑步"]
NICK_SUFFIXES = ["", "酱", "儿", "喵", "子", "baby", "同学", "小姐姐", "少女", "宝贝",
                 "", "呀", "哦", "呢", "哒", "酱", "薯", "桃", "糖", "果"]

CITIES = ["北京", "上海", "广州", "深圳", "杭州", "成都", "重庆", "南京",
          "武汉", "西安", "长沙", "青岛", "大连", "厦门", "苏州", "天津",
          "郑州", "昆明", "福州", "合肥", "沈阳", "东莞", "佛山", "珠海"]

OCCUPATIONS = [
    "设计师", "护士", "幼师", "行政专员", "平面模特", "花艺师", "甜品师",
    "新媒体编辑", "服装搭配师", "化妆师", "舞蹈老师", "钢琴老师", "瑜伽教练",
    "心理咨询师", "营养师", "宠物美容师", "旅行社计调", "文案策划",
    "配音演员", "手绘插画师", "图书管理员", "咖啡师", "烘焙师", "收纳师",
    "空乘", "会计", "HR", "法语翻译", "婚礼策划师", "美容顾问",
]

INTEREST_POOL = [
    "旅行", "摄影", "美食", "电影", "音乐", "绘画", "手作", "看展", "咖啡",
    "健身", "跑步", "攀岩", "篮球", "动漫", "cosplay", "游戏", "阅读", "品酒",
    "瑜伽", "编程", "烹饪", "骑行", "吉他", "钢琴", "唱歌", "探店", "宠物",
    "追剧", "逛街", "户外", "读书", "冥想", "素食", "滑雪", "潜水", "烘焙",
]

PERSONALITY_POOL = [
    "开朗", "幽默", "细心", "文艺", "温柔", "独立", "阳光", "自律", "活泼",
    "可爱", "成熟", "知性", "浪漫", "随和", "安静", "热血", "软萌", "御姐",
    "小清新", "元气", "甜美", "高冷", "腼腆", "治愈系",
]

# 根据职业和兴趣生成个性化简介
BIO_TEMPLATES = [
    "热爱{interest1}和{interest2}，周末喜欢{city}的角落。希望能遇到懂我的人。",
    "一只{personality}的{occupation}，日常{interest1}、{interest2}外加吸猫。",
    "{occupation}一枚，{age}岁的我依然相信爱情。喜欢{interest1}，也喜欢{interest2}。",
    "可甜可盐的{occupation}，{interest1}重度爱好者，偶尔{interest2}。",
    "在{city}打拼的{age}岁女生，从事{occupation}。{interest1}和{interest2}是我生活的调味剂。",
    "我是一个{personality}的{occupation}，{interest1}让我快乐，{interest2}让我安静。",
    "想找一个能一起{interest1}、一起{interest2}的人，在{city}慢慢变老。",
    "有点{personality}，有点小任性。做{occupation}，爱{interest1}，也爱{interest2}。",
    "{occupation}在读，{personality}学姐类型。平时喜欢{interest1}、{interest2}、{interest3}。",
    "标准的{occupation}女生，{personality}属性点满。{interest1}和{interest2}是我必不可少的日常。",
]


def random_nickname():
    """生成随机昵称"""
    surname = random.choice(SURNAMES)
    c1 = random.choice(NAME_CHARS)
    c2 = random.choice(NAME_CHARS)
    real_name = surname + c1 + c2

    if random.random() < 0.4:
        # 40% 用真名
        return real_name

    # 60% 用创意昵称
    prefix = random.choice(NICK_PREFIXES)
    suffix = random.choice(NICK_SUFFIXES)
    if prefix and suffix:
        return prefix + c1 + suffix
    elif prefix:
        return prefix + surname + c1
    else:
        return c1 + c2 + (suffix if random.random() < 0.5 else "")


def random_user_data(phone: str, idx: int):
    """生成单条用户数据"""
    age = random.randint(20, 30)
    city = random.choice(CITIES)
    occupation = random.choice(OCCUPATIONS)
    interests = random.sample(INTEREST_POOL, k=random.randint(3, 5))
    personality_tags = random.sample(PERSONALITY_POOL, k=random.randint(2, 3))

    # 根据职业和兴趣生成简介
    template = random.choice(BIO_TEMPLATES)
    try:
        bio = template.format(
            age=age,
            city=city,
            occupation=occupation,
            personality=random.choice(personality_tags),
            interest1=interests[0] if len(interests) > 0 else "美食",
            interest2=interests[1] if len(interests) > 1 else "旅行",
            interest3=interests[2] if len(interests) > 2 else "音乐",
        )
    except (IndexError, KeyError):
        bio = f"热爱生活的{occupation}，希望遇见有趣的灵魂。"

    return {
        "phone": phone,
        "password_hash": hash_password("Pass@123"),
        "nickname": random_nickname(),
        "age": age,
        "gender": "female",
        "city": city,
        "occupation": occupation,
        "bio": bio,
        "interests": interests,
        "personality_tags": personality_tags,
        "preference": {
            "min_age": 24,
            "max_age": 35,
            "gender": "male",
            "cities": [],
            "tags": [],
        },
    }


async def run():
    # 读取图片（云端/新环境可能没有此文件，直接跳过）
    img_path = r"c:\Users\鸿\CodeBuddy\20260628140336\img\beauty_images.json"
    if not os.path.exists(img_path):
        print(f"[SKIP] 头像资源不存在: {img_path}")
        return
    with open(img_path, "r", encoding="utf-8") as f:
        images = json.load(f)

    print(f"[OK] 读取到 {len(images)} 张图片")

    # 手机号范围: 13800138002 ~ 13800138101 (100个)
    phones = [f"13800138{str(i).zfill(3)}" for i in range(2, 102)]

    await init_db()

    created = 0
    updated = 0

    async with async_session() as db:
        for idx, phone in enumerate(phones):
            img = images[idx]
            image_url = img["image_url"]

            # 生成用户数据
            data = random_user_data(phone, idx)

            # 查重
            result = await db.execute(select(User).where(User.phone == phone))
            existing = result.scalar_one_or_none()

            if existing:
                existing.avatar = image_url
                existing.photos = [image_url]
                updated += 1
            else:
                user = User(
                    phone=data["phone"],
                    password_hash=data["password_hash"],
                    nickname=data["nickname"],
                    avatar=image_url,
                    photos=[image_url],
                    age=data["age"],
                    gender=data["gender"],
                    city=data["city"],
                    occupation=data["occupation"],
                    bio=data["bio"],
                    interests=data["interests"],
                    personality_tags=data["personality_tags"],
                    preference=data["preference"],
                )
                db.add(user)
                created += 1

        await db.commit()

    print(f"[DONE] 新建 {created} 个用户，更新 {updated} 个用户 (共 {created + updated})")
    print(f"[DONE] 手机号范围: 13800138002 ~ 13800138101")
    print(f"[DONE] 密码统一: Pass@123")


if __name__ == "__main__":
    asyncio.run(run())
