import os
from dotenv import load_dotenv
load_dotenv()

from flask import Flask, jsonify, request
from flask_cors import CORS
from auth import verify_firebase_token

app = Flask(__name__)
CORS(app, resources={r"/api/*": {"origins": "*"}}, supports_credentials=True)

@app.route('/api')
def index():
    return jsonify({'status': 'ok'})

@app.route('/api/protected')
@verify_firebase_token
def protected():
    user = getattr(request, 'user', None)
    return jsonify({'message': 'Protected endpoint', 'user': user})

@app.route('/api/auth/sync', methods=['POST'])
@verify_firebase_token
def sync_user():
    """
    This endpoint is called by the frontend after login/signup.
    The @verify_firebase_token decorator automatically handles 
    the MongoDB upsert logic.
    """
    user = getattr(request, 'user', None)
    return jsonify({'status': 'synced', 'user': user})

if __name__ == '__main__':
    port = int(os.getenv('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=os.getenv('FLASK_DEBUG', 'False') == 'True')
