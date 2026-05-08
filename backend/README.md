Flask backend for the project

- Copy your Firebase service account JSON to `firebase-credentials.json` (do NOT commit it).
- Copy `.env.example` to `.env` and fill in real credentials (do NOT commit `.env`).

Install and run:

```
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
set FLASK_APP=app.py
set FLASK_ENV=development
flask run
```

Useful endpoints:

- `GET /api` basic backend status.
- `GET /api/health` checks configured services without exposing secrets.
- `GET /api/orphanages` reads the `orphanages` MongoDB collection and requires a Firebase bearer token.

Auth notes:

- Firebase Admin reads `FIREBASE_CREDENTIALS_PATH` and `FIREBASE_PROJECT_ID` from `.env`.
- `FIREBASE_CREDENTIALS_PATH` is resolved relative to the `backend` folder when it is not absolute.
- Protected endpoints only bypass Firebase token verification when `CHATBOT_BYPASS_AUTH=true` is explicitly set.
