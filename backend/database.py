from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy.orm import DeclarativeBase
from sqlalchemy import text
from config import DATABASE_URL

engine = create_async_engine(DATABASE_URL, echo=False)
async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


async def get_db():
    async with async_session() as session:
        try:
            yield session
        finally:
            await session.close()


async def init_db():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        result = await conn.execute(text("PRAGMA table_info(users)"))
        columns = [col[1] for col in result.all()]
        
        if "role" not in columns:
            await conn.execute(text("ALTER TABLE users ADD COLUMN role VARCHAR(20) DEFAULT 'user'"))
            print("[OK] Added role column to users table")
        
        if "vip_level" not in columns:
            await conn.execute(text("ALTER TABLE users ADD COLUMN vip_level VARCHAR(20) DEFAULT 'free'"))
            print("[OK] Added vip_level column to users table")
        
        if "vip_expire_at" not in columns:
            await conn.execute(text("ALTER TABLE users ADD COLUMN vip_expire_at DATETIME"))
            print("[OK] Added vip_expire_at column to users table")
        
        if "vip_auto_renew" not in columns:
            await conn.execute(text("ALTER TABLE users ADD COLUMN vip_auto_renew BOOLEAN DEFAULT false"))
            print("[OK] Added vip_auto_renew column to users table")
