import os
from datetime import datetime, timezone

from flask import Flask, jsonify, request
from auth import verify_firebase_token
from db import get_collection, ping_database
from dotenv import load_dotenv

load_dotenv()

app = Flask(__name__)

@app.route('/api')
def index():
    return jsonify({'status': 'ok', 'mongodb': 'connected' if ping_database() else 'disconnected'})


@app.route('/api/health')
def health():
    db_ok = ping_database()
    status_code = 200 if db_ok else 503
    return jsonify({'status': 'ok' if db_ok else 'degraded', 'mongodb': db_ok}), status_code

@app.route('/api/protected')
@verify_firebase_token
def protected():
    user = getattr(request, 'user', None)
    if not user or "uid" not in user:
        return jsonify({'error': 'Unauthorized'}), 401

    try:
        users_collection = get_collection("users")
        now = datetime.now(timezone.utc)
        users_collection.update_one(
            {"uid": user["uid"]},
            {
                "$set": {
                    "uid": user["uid"],
                    "email": user.get("email"),
                    "name": user.get("name"),
                    "last_seen_at": now,
                },
                "$setOnInsert": {
                    "created_at": now,
                },
            },
            upsert=True,
        )
    except RuntimeError as config_error:
        print(f"[DB Config Error] {config_error}")
        return jsonify({'error': 'Server configuration error'}), 500
    except Exception as db_error:
        print(f"[DB Error] {db_error}")
        return jsonify({'error': 'Database unavailable'}), 503

    return jsonify({'message': 'Protected endpoint', 'user': {'uid': user.get("uid"), 'email': user.get("email")}})

if __name__ == '__main__':
    port = int(os.getenv('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=os.getenv('FLASK_DEBUG', 'False') == 'True')
