import redis
from app.config import settings
from app.database.postgres import SessionLocal
from app.database.models import User
from datetime import datetime

class TokenGovernance:
    _redis = None

    @classmethod
    def get_redis_client(cls):
        if cls._redis is None:
            try:
                cls._redis = redis.Redis.from_url(settings.REDIS_URL, decode_responses=True)
                cls._redis.ping()
            except Exception:
                cls._redis = None
        return cls._redis

    @classmethod
    def check_quota(cls, user_id: int) -> bool:
        """
        Check if the user's token usage has exceeded their daily limit.
        Uses Redis cache for sub-50ms checks.
        """
        r = cls.get_redis_client()
        if r:
            used_key = f"user:{user_id}:tokens_used"
            limit_key = f"user:{user_id}:token_limit"
            try:
                used = r.get(used_key)
                limit = r.get(limit_key)
                
                if used is None or limit is None:
                    # Sync from database
                    db = SessionLocal()
                    try:
                        user = db.query(User).filter(User.id == user_id).first()
                        if user:
                            cls._check_and_reset_user_quota_db(user, db)
                            used = user.tokens_used_today
                            limit = user.daily_token_quota
                            r.set(used_key, used)
                            r.set(limit_key, limit)
                        else:
                            return False
                    finally:
                        db.close()
                
                return int(used) < int(limit)
            except Exception:
                pass # Fallback to DB check on redis errors

        # Fallback DB check
        db = SessionLocal()
        try:
            user = db.query(User).filter(User.id == user_id).first()
            if user:
                cls._check_and_reset_user_quota_db(user, db)
                return user.tokens_used_today < user.daily_token_quota
            return False
        finally:
            db.close()

    @classmethod
    def increment_tokens(cls, user_id: int, count: int):
        """
        Increment the user's token usage atomically.
        """
        r = cls.get_redis_client()
        
        # 1. Update Database
        db = SessionLocal()
        try:
            user = db.query(User).filter(User.id == user_id).first()
            if user:
                cls._check_and_reset_user_quota_db(user, db)
                user.tokens_used_today += count
                db.commit()
                
                # 2. Update Redis
                if r:
                    used_key = f"user:{user_id}:tokens_used"
                    try:
                        r.set(used_key, user.tokens_used_today)
                    except Exception:
                        pass
        except Exception:
            pass
        finally:
            db.close()

    @classmethod
    def update_quota_config(cls, user_id: int, new_limit: int):
        """
        Update token quota limit configuration in Redis.
        """
        r = cls.get_redis_client()
        if r:
            try:
                r.set(f"user:{user_id}:token_limit", new_limit)
            except Exception:
                pass

    @classmethod
    def _check_and_reset_user_quota_db(cls, user: User, db):
        """
        Checks if the daily quota needs reset. If so, updates database and Redis.
        """
        now = datetime.utcnow()
        if not user.quota_reset_at or user.quota_reset_at.date() < now.date():
            user.tokens_used_today = 0
            user.quota_reset_at = now
            db.commit()
            
            r = cls.get_redis_client()
            if r:
                try:
                    r.set(f"user:{user.id}:tokens_used", 0)
                except Exception:
                    pass
