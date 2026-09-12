from sqlalchemy import create_engine, text
from sqlalchemy.engine.url import make_url
from sqlalchemy.orm import DeclarativeBase, sessionmaker

from app.config import settings


def ensure_database():
    url = make_url(settings.database_url)
    driver = url.get_backend_name()
    if driver not in ("mysql", "mariadb") or not url.database:
        return
    import pymysql

    conn = pymysql.connect(
        host=url.host or "localhost",
        port=url.port or 3306,
        user=url.username or "root",
        password=url.password or "",
        autocommit=True,
    )
    try:
        with conn.cursor() as cur:
            cur.execute(
                f"CREATE DATABASE IF NOT EXISTS `{url.database}` "
                "CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci"
            )
    finally:
        conn.close()


try:
    ensure_database()
except Exception as exc:
    print(f"Could not auto-create MySQL database: {exc}")

connect_args = {}
if settings.database_url.startswith("sqlite"):
    connect_args = {"check_same_thread": False}

engine = create_engine(
    settings.database_url,
    pool_pre_ping=True,
    connect_args=connect_args,
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    pass


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def patch_mysql_columns():
    alters = [
        "ALTER TABLE users ADD COLUMN plan_minutes INT DEFAULT 120",
        "ALTER TABLE users ADD COLUMN is_admin BOOLEAN DEFAULT 0",
        # DEFAULT 1 so existing accounts stay usable; new signups set False in app code
        "ALTER TABLE users ADD COLUMN is_approved BOOLEAN DEFAULT 1",
        "ALTER TABLE agents ADD COLUMN realtime_model VARCHAR(128) DEFAULT 'gpt-4o-realtime-preview'",
        "ALTER TABLE agents ADD COLUMN character_enabled BOOLEAN DEFAULT 0",
        "ALTER TABLE agents ADD COLUMN character_pack VARCHAR(64) DEFAULT 'character_emoji'",
        "ALTER TABLE agents ADD COLUMN launcher_mode VARCHAR(16) DEFAULT 'mic'",
        "ALTER TABLE agents ADD COLUMN launcher_skin VARCHAR(64) NULL",
        "ALTER TABLE agents ADD COLUMN launcher_label VARCHAR(80) DEFAULT 'Tap to talk with AI'",
        "ALTER TABLE agents ADD COLUMN launcher_color VARCHAR(16) DEFAULT '#2563eb'",
        "ALTER TABLE agents ADD COLUMN launcher_size INT DEFAULT 160",
        "ALTER TABLE agents ADD COLUMN character_size INT DEFAULT 200",
        "ALTER TABLE agents ADD COLUMN panel_width INT DEFAULT 280",
        "ALTER TABLE agents ADD COLUMN show_transcription BOOLEAN DEFAULT 0",
        "ALTER TABLE agents ADD COLUMN site_pages TEXT",
        "ALTER TABLE agents ADD COLUMN max_call_minutes INT DEFAULT 10",
    ]
    for stmt in alters:
        try:
            with engine.begin() as conn:
                conn.execute(text(stmt))
        except Exception:
            pass


patch_mysql_columns()
