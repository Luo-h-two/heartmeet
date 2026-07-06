import asyncio
from database import async_session, init_db
from sqlalchemy import text

async def fix_admin():
    await init_db()
    async with async_session() as session:
        await session.execute(text("UPDATE users SET role='superadmin', is_admin=1 WHERE phone='13800000001'"))
        await session.commit()
        result = await session.execute(text("SELECT id, nickname, role, is_admin FROM users WHERE phone='13800000001'"))
        row = result.one_or_none()
        if row:
            print(f"修复成功: ID={row[0]}, 昵称={row[1]}, 角色={row[2]}, 管理员={row[3]}")
        else:
            print("未找到管理员账号")

asyncio.run(fix_admin())