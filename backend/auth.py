import os
from functools import wraps
from flask import jsonify, request
import firebase_admin
from firebase_admin import auth, credentials
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), '.env'))


def resolve_backend_path(path):
    if not path:
        return None

    if os.path.isabs(path):
        return path

    return os.path.abspath(os.path.join(os.path.dirname(__file__), path))

# Initialize Firebase Admin SDK
cred_path = resolve_backend_path(os.getenv("FIREBASE_CREDENTIALS_PATH")) or os.path.join(os.path.dirname(__file__), 'firebase-credentials.json')
if not firebase_admin._apps:
    if os.path.exists(cred_path):
        cred = credentials.Certificate(cred_path)
        firebase_admin.initialize_app(cred, {"projectId": os.getenv("FIREBASE_PROJECT_ID")})
    else:
        # Fallback to default initialization (uses GOOGLE_APPLICATION_CREDENTIALS)
        firebase_admin.initialize_app(options={"projectId": os.getenv("FIREBASE_PROJECT_ID")})


def verify_firebase_token(f):
    """Verify a Firebase ID token using the Firebase Admin SDK."""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        # Development bypass: only when explicitly set.
        try:
            bypass_env = os.getenv("CHATBOT_BYPASS_AUTH", "false").lower() in ("1", "true", "yes")
            if bypass_env:
                print("[Auth] Bypass enabled via CHATBOT_BYPASS_AUTH — skipping token verification (dev only)")
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
            return f(*args, **kwargs)
        except Exception as e:
            print(f"[Token Error] {str(e)}")
            return jsonify({"error": "Invalid token", "details": str(e)}), 401

    return decorated_function
