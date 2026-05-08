import os
from flask import Flask, jsonify, request
from auth import verify_firebase_token
from dotenv import load_dotenv

load_dotenv()

app = Flask(__name__)

@app.route('/api')
def index():
    return jsonify({'status': 'ok'})

@app.route('/api/protected')
@verify_firebase_token
def protected():
    user = getattr(request, 'user', None)
    return jsonify({'message': 'Protected endpoint', 'user': user})

if __name__ == '__main__':
    port = int(os.getenv('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=os.getenv('FLASK_DEBUG', 'False') == 'True')
