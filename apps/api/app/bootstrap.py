from __future__ import annotations

from sqlalchemy.orm import Session

from app.config import settings
from app.database import SessionLocal
from app.models import User
from app.security import hash_secret


def bootstrap_admin() -> None:
    email = (settings.admin_email or "").strip().lower()
    password = settings.admin_password or ""
    if not email or len(password) < 6:
        return

    db: Session = SessionLocal()
    try:
        user = db.query(User).filter(User.email == email).first()
        if user:
            user.is_admin = True
            user.password_hash = hash_secret(password)
        else:
            user = User(
                email=email,
                password_hash=hash_secret(password),
                plan_minutes=settings.default_plan_minutes,
                is_admin=True,
            )
            db.add(user)
        db.commit()
    finally:
        db.close()
