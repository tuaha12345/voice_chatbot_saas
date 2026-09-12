from __future__ import annotations

from sqlalchemy.orm import Session

from app.config import settings
from app.database import SessionLocal
from app.models import User
from app.security import hash_secret


def bootstrap_admin() -> None:
    email = (settings.admin_email or "").strip().lower()
    if not email:
        return

    password = settings.admin_password or ""
    min_len = 12 if settings.is_production else 6

    db: Session = SessionLocal()
    try:
        user = db.query(User).filter(User.email == email).first()
        if user:
            # Existing admin: promote only — never overwrite password on restart
            user.is_admin = True
            user.is_approved = True
            db.commit()
            return

        if len(password) < min_len:
            print(
                f"Admin bootstrap skipped: ADMIN_PASSWORD must be at least {min_len} characters"
            )
            return

        user = User(
            email=email,
            password_hash=hash_secret(password),
            plan_minutes=settings.default_plan_minutes,
            is_admin=True,
            is_approved=True,
        )
        db.add(user)
        db.commit()
    finally:
        db.close()
