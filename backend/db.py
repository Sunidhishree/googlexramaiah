import os
from threading import Lock

from pymongo import MongoClient
from pymongo.database import Database
from pymongo.errors import PyMongoError

_client = None
_db = None
_lock = Lock()


def _require_env(name: str) -> str:
    value = os.getenv(name, "").strip()
    if not value:
        raise RuntimeError(f"Missing required environment variable: {name}")
    return value


def get_db() -> Database:
    """Return a singleton MongoDB database handle."""
    global _client, _db
    if _db is not None:
        return _db

    with _lock:
        if _db is not None:
            return _db

        mongodb_uri = _require_env("MONGODB_URI")
        mongodb_db = _require_env("MONGODB_DB")

        _client = MongoClient(
            mongodb_uri,
            serverSelectionTimeoutMS=int(os.getenv("MONGODB_SERVER_SELECTION_TIMEOUT_MS", "5000")),
            connectTimeoutMS=int(os.getenv("MONGODB_CONNECT_TIMEOUT_MS", "5000")),
            socketTimeoutMS=int(os.getenv("MONGODB_SOCKET_TIMEOUT_MS", "10000")),
            maxPoolSize=int(os.getenv("MONGODB_MAX_POOL_SIZE", "50")),
            minPoolSize=int(os.getenv("MONGODB_MIN_POOL_SIZE", "0")),
            retryWrites=os.getenv("MONGODB_RETRY_WRITES", "true").lower() == "true",
            appname=os.getenv("MONGODB_APP_NAME", "googlexramaiah-backend"),
        )
        _db = _client[mongodb_db]
        return _db


def get_collection(name: str):
    return get_db()[name]


def ping_database() -> bool:
    """Quick liveness check for MongoDB connectivity."""
    try:
        get_db().command("ping")
        return True
    except (RuntimeError, PyMongoError):
        return False
