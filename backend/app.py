import os
from flask import Flask, jsonify, request
from dotenv import load_dotenv
from pymongo import MongoClient
from pymongo.errors import PyMongoError

load_dotenv(os.path.join(os.path.dirname(__file__), '.env'))

from auth import verify_firebase_token

app = Flask(__name__)
mongo_client = None


def has_env_value(name):
    return bool(os.getenv(name))


def get_mongo_client():
    global mongo_client

    if mongo_client is None:
        mongo_uri = os.getenv('MONGODB_URI')
        if not mongo_uri:
            raise RuntimeError('MONGODB_URI is not configured')
        mongo_client = MongoClient(mongo_uri, serverSelectionTimeoutMS=5000)

    return mongo_client


def get_db():
    return get_mongo_client()[os.getenv('MONGODB_DB', 'Googlexramaiah')]

@app.route('/api')
def index():
    return jsonify({
        'status': 'ok',
        'service': 'Ummeed backend',
        'environment': os.getenv('FLASK_ENV', 'production'),
    })


@app.route('/api/health')
def health():
    mongodb = {'configured': has_env_value('MONGODB_URI'), 'connected': False}

    if mongodb['configured']:
        try:
            get_mongo_client().admin.command('ping')
            mongodb['connected'] = True
        except (PyMongoError, RuntimeError) as exc:
            mongodb['error'] = str(exc)

    return jsonify({
        'status': 'ok' if mongodb['connected'] else 'degraded',
        'mongodb': mongodb,
        'firebase': {
            'projectId': os.getenv('FIREBASE_PROJECT_ID'),
            'credentialsConfigured': has_env_value('FIREBASE_CREDENTIALS_PATH'),
        },
        'ai': {
            'geminiConfigured': has_env_value('GEMINI_API_KEY'),
            'groqConfigured': has_env_value('GROQ_API_KEY'),
        },
        'smtp': {
            'configured': all(has_env_value(name) for name in ('SMTP_SERVER', 'SMTP_PORT', 'SMTP_USERNAME', 'SMTP_PASSWORD')),
            'server': os.getenv('SMTP_SERVER'),
            'fromEmail': os.getenv('FROM_EMAIL'),
        },
    })


@app.route('/api/orphanages')
@verify_firebase_token
def orphanages():
    try:
        docs = list(get_db().orphanages.find({}, {'_id': 0}).limit(100))
        return jsonify({'orphanages': docs})
    except (PyMongoError, RuntimeError) as exc:
        return jsonify({'error': 'Could not load orphanages', 'details': str(exc)}), 500

@app.route('/api/protected')
@verify_firebase_token
def protected():
    user = getattr(request, 'user', None)
    return jsonify({'message': 'Protected endpoint', 'user': user})

if __name__ == '__main__':
    port = int(os.getenv('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=os.getenv('FLASK_DEBUG', 'False') == 'True')
