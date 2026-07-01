"""初始化模拟数据"""
from datetime import datetime, timedelta
import random
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from models import User, UserAction, BehaviorLog
from auth import hash_password

MOCK_USERS = [
    {"phone": "13800000001", "password": "Admin@123", "nickname": "系统管理员", "age": 30, "gender": "male", "city": "深圳", "occupation": "系统管理员", "bio": "平台管理员账号", "interests": ["编程", "阅读"], "personality_tags": ["成熟", "自律"], "avatar": "https://api.dicebear.com/7.x/avataaars/svg?seed=admin01", "is_admin": True},
    {"phone": "13800138001", "password": "Pass@123", "nickname": "阳光小明", "age": 26, "gender": "male", "city": "北京", "occupation": "产品经理", "bio": "热爱生活，喜欢旅行和摄影。周末喜欢探索城市角落，希望能遇到志同道合的你。", "interests": ["旅行", "摄影", "美食", "电影"], "personality_tags": ["开朗", "幽默", "细心"], "avatar": "https://api.dicebear.com/7.x/avataaars/svg?seed=male01"},
    {"phone": "13800138002", "password": "Pass@123", "nickname": "文艺小鹿", "age": 24, "gender": "female", "city": "北京", "occupation": "设计师", "bio": "一只热爱插画和手作的设计师。喜欢逛美术馆，也喜欢在家做手工。", "interests": ["绘画", "手作", "看展", "咖啡"], "personality_tags": ["文艺", "温柔", "独立"], "avatar": "https://api.dicebear.com/7.x/avataaars/svg?seed=female01"},
    {"phone": "13800138003", "password": "Pass@123", "nickname": "运动达人", "age": 28, "gender": "male", "city": "上海", "occupation": "健身教练", "bio": "每天不是在健身房就是在去健身房的路上。也喜欢户外徒步和攀岩。", "interests": ["健身", "跑步", "攀岩", "篮球"], "personality_tags": ["阳光", "自律", "开朗"], "avatar": "https://api.dicebear.com/7.x/avataaars/svg?seed=male02"},
    {"phone": "13800138004", "password": "Pass@123", "nickname": "二次元少女", "age": 22, "gender": "female", "city": "广州", "occupation": "插画师", "bio": "重度二次元，周末必去漫展。会画画会做手办，想找个能一起逛展的人。", "interests": ["动漫", "cosplay", "绘画", "游戏"], "personality_tags": ["二次元", "活泼", "可爱"], "avatar": "https://api.dicebear.com/7.x/avataaars/svg?seed=female02"},
    {"phone": "13800138005", "password": "Pass@123", "nickname": "职场精英", "age": 30, "gender": "female", "city": "深圳", "occupation": "金融分析师", "bio": "工作认真，生活也认真。喜欢阅读和品酒，周末会参加读书会。", "interests": ["阅读", "品酒", "瑜伽", "旅行"], "personality_tags": ["成熟", "知性", "独立"], "avatar": "https://api.dicebear.com/7.x/avataaars/svg?seed=female03"},
    {"phone": "13800138006", "password": "Pass@123", "nickname": "程序员小哥", "age": 27, "gender": "male", "city": "杭州", "occupation": "全栈工程师", "bio": "写得了代码，做得了饭。喜欢钻研新技术，也喜欢研究新菜谱。", "interests": ["编程", "游戏", "烹饪", "骑行"], "personality_tags": ["理工男", "细心", "幽默"], "avatar": "https://api.dicebear.com/7.x/avataaars/svg?seed=male03"},
    {"phone": "13800138007", "password": "Pass@123", "nickname": "音乐精灵", "age": 25, "gender": "female", "city": "成都", "occupation": "音乐老师", "bio": "钢琴十级，吉他也会。喜欢民谣和爵士，周末常去Livehouse。", "interests": ["音乐", "吉他", "钢琴", "唱歌"], "personality_tags": ["文艺", "温柔", "浪漫"], "avatar": "https://api.dicebear.com/7.x/avataaars/svg?seed=female04"},
    {"phone": "13800138008", "password": "Pass@123", "nickname": "美食猎人", "age": 29, "gender": "male", "city": "重庆", "occupation": "美食博主", "bio": "走遍大街小巷只为寻找最地道的美食。希望找到一个能一起逛吃逛吃的人。", "interests": ["美食", "探店", "摄影", "旅游"], "personality_tags": ["吃货", "开朗", "随和"], "avatar": "https://api.dicebear.com/7.x/avataaars/svg?seed=male04"},
    {"phone": "13800138009", "password": "Pass@123", "nickname": "猫系女生", "age": 23, "gender": "female", "city": "北京", "occupation": "新媒体运营", "bio": "养了两只猫，生活被猫填满。喜欢宅家看剧，也喜欢和朋友下午茶。", "interests": ["宠物", "追剧", "美食", "逛街"], "personality_tags": ["温柔", "宅", "可爱"], "avatar": "https://api.dicebear.com/7.x/avataaars/svg?seed=female05"},
    {"phone": "13800138010", "password": "Pass@123", "nickname": "摄影大叔", "age": 32, "gender": "male", "city": "西安", "occupation": "摄影师", "bio": "用镜头记录世界的美好。走过很多地方，拍过很多风景，却还没遇到对的你。", "interests": ["摄影", "旅行", "户外", "读书"], "personality_tags": ["文艺", "成熟", "浪漫"], "avatar": "https://api.dicebear.com/7.x/avataaars/svg?seed=male05"},
    {"phone": "13800138011", "password": "Pass@123", "nickname": "瑜伽女神", "age": 26, "gender": "female", "city": "上海", "occupation": "瑜伽教练", "bio": "热爱瑜伽和冥想，相信内心的平静才是真正的力量。", "interests": ["瑜伽", "冥想", "素食", "旅行"], "personality_tags": ["温柔", "自律", "安静"], "avatar": "https://api.dicebear.com/7.x/avataaars/svg?seed=female06"},
    {"phone": "13800138012", "password": "Pass@123", "nickname": "电竞少年", "age": 21, "gender": "male", "city": "广州", "occupation": "电竞选手", "bio": "职业电竞选手，训练之余也喜欢看看动漫、打打篮球。", "interests": ["电竞", "篮球", "动漫", "游戏"], "personality_tags": ["二次元", "开朗", "热血"], "avatar": "https://api.dicebear.com/7.x/avataaars/svg?seed=male06"},
]

INTEREST_TAGS = ["旅行", "摄影", "美食", "电影", "音乐", "绘画", "手作", "看展", "咖啡",
                 "健身", "跑步", "攀岩", "篮球", "动漫", "cosplay", "游戏", "阅读", "品酒",
                 "瑜伽", "编程", "烹饪", "骑行", "吉他", "钢琴", "唱歌", "探店", "宠物",
                 "追剧", "逛街", "户外", "读书", "冥想", "素食", "电竞", "滑雪", "潜水"]

PERSONALITY_TAGS = ["开朗", "幽默", "细心", "文艺", "温柔", "独立", "阳光", "自律", "活泼",
                    "可爱", "成熟", "知性", "浪漫", "随和", "安静", "热血", "宅", "外向", "内向"]


async def seed_database(db: AsyncSession):
    """填充模拟数据"""
    # 检查是否已有数据
    result = await db.execute(select(User).limit(1))
    if result.scalar_one_or_none():
        return

    users = []
    for u in MOCK_USERS:
        user = User(
            phone=u["phone"],
            password_hash=hash_password(u["password"]),
            nickname=u["nickname"],
            age=u["age"],
            gender=u["gender"],
            city=u["city"],
            occupation=u["occupation"],
            bio=u["bio"],
            interests=u["interests"],
            personality_tags=u["personality_tags"],
            avatar=u["avatar"],
            is_admin=u.get("is_admin", False),
            preference={"min_age": 20, "max_age": 35, "gender": "", "cities": [], "tags": []},
        )
        db.add(user)
        users.append(user)

    await db.commit()

    # 为每个用户生成一些模拟行为
    for user in users:
        targets = [u for u in users if u.id != user.id]
        random.shuffle(targets)
        for target in targets[:5]:
            action_type = random.choice(["like", "skip", "like", "like", "skip"])
            action = UserAction(
                user_id=user.id,
                target_user_id=target.id,
                action_type=action_type,
            )
            db.add(action)

            # 行为日志
            if action_type == "like":
                log = BehaviorLog(
                    user_id=user.id,
                    target_user_id=target.id,
                    action="like",
                    duration_ms=random.randint(2000, 8000),
                    extra={"source": "recommend"},
                )
                db.add(log)
            else:
                log = BehaviorLog(
                    user_id=user.id,
                    target_user_id=target.id,
                    action="skip",
                    duration_ms=random.randint(500, 3000),
                )
                db.add(log)

    await db.commit()
    print(f"[OK] Created {len(users)} mock users")
