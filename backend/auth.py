import os
from functools import wraps
from flask import jsonify, request
import firebase_admin
from firebase_admin import auth, credentials
from datetime import datetime
try:
    from pymongo import MongoClient
except Exception:
    MongoClient = None

# Initialize Firebase Admin SDK
cred_path = os.getenv("FIREBASE_CREDENTIALS_PATH") or os.path.join(os.path.dirname(__file__), 'firebase-credentials.json')
if not firebase_admin._apps:
    try:
        if os.path.exists(cred_path) and os.path.getsize(cred_path) > 0:
            cred = credentials.Certificate(cred_path)
            firebase_admin.initialize_app(cred)
        else:
            print(f"[Firebase] Warning: {cred_path} is missing or empty. Using default credentials.")
            firebase_admin.initialize_app()
    except Exception as e:
        print(f"[Firebase] Error initializing Firebase Admin SDK: {e}")
        # Initialize without credentials to let the app start (will fail on auth calls, but not on startup)
        try:
            firebase_admin.initialize_app()
        except:
            pass

# Initialize MongoDB Client once
mongo_client = None
mongo_uri = os.getenv('MONGODB_URI')
if mongo_uri:
    try:
        from pymongo import MongoClient
        mongo_client = MongoClient(mongo_uri, serverSelectionTimeoutMS=5000)
        # Test connection
        mongo_client.admin.command('ping')
        print("[MongoDB] Connected successfully")
    except Exception as e:
        print(f"[MongoDB] Initial connection failed: {e}")
        mongo_client = None


def verify_firebase_token(f):
    """Verify a Firebase ID token using the Firebase Admin SDK."""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        # Development bypass: when set, skip token verification and inject a dev user.
        try:
            bypass_env = os.getenv("CHATBOT_BYPASS_AUTH", "false").lower() in ("1", "true", "yes")
            flask_env = os.getenv("FLASK_ENV", "").lower()
            if bypass_env or flask_env == "development":
                print("[Auth] Bypass enabled (CHATBOT_BYPASS_AUTH or FLASK_ENV=development) — skipping token verification (dev only)")
                request.user = {"uid": "dev_bypass_user", "email": "dev@local"}
                return f(*args, **kwargs)
        except Exception:
            pass

        auth_header = request.headers.get("Authorization")

        if not auth_header:
            return jsonify({"error": "Missing authorization header"}), 401

        try:
            parts = auth_header.split(" ")
            if len(parts) != 2 or parts[0].lower() != "bearer":
                return jsonify({"error": "Invalid authorization header format"}), 401

            id_token = parts[1]

            try:
                decoded_token = auth.verify_id_token(id_token)
            except Exception as primary_err:
                print(f"[Auth Warning] Primary verification failed: {primary_err}")
                return jsonify({"error": "Invalid token", "details": str(primary_err)}), 401

            if "uid" not in decoded_token:
                decoded_token["uid"] = decoded_token.get("user_id") or decoded_token.get("sub")

            request.user = decoded_token

            # Persist or update user record in MongoDB if available
            try:
                if mongo_client:
                    db_name = os.getenv('MONGODB_DB', 'ummeed')
                    db = mongo_client[db_name]
                    users = db.get_collection('users')
                    
                    print(f"[Auth DB] Syncing user {decoded_token['uid']} to collection 'users' in db '{db.name}'")
                    result = users.update_one(
                        {"uid": decoded_token["uid"]},
                        {"$set": {
                            "email": decoded_token.get('email'),
                            "name": decoded_token.get('name') or decoded_token.get('display_name'),
                            "provider": decoded_token.get('firebase', {}).get('sign_in_provider') if isinstance(decoded_token.get('firebase'), dict) else None,
                            "last_seen": datetime.utcnow()
                        }},
                        upsert=True
                    )
                    print(f"[Auth DB] Upsert successful: {result.upserted_id or 'Updated existing'}")
                else:
                    print("[Auth DB] MongoDB client not initialized, skipping sync")
            except Exception as e:
                # Don't fail the request if DB write fails; log for diagnostics
                print(f"[Auth DB] Failed to upsert user: {e}")
            return f(*args, **kwargs)
        except Exception as e:
            print(f"[Token Error] {str(e)}")
            return jsonify({"error": "Invalid token", "details": str(e)}), 401

    return decorated_function
