Flask backend for the project

- Copy your Firebase service account JSON to `firebase-credentials.json` (do NOT commit it).
- Copy `.env.example` to `.env` and fill in real credentials (do NOT commit `.env`).
- Set `MONGODB_URI` and `MONGODB_DB` in `.env`.

Install and run:

```
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
export FLASK_APP=app.py
export FLASK_ENV=development
flask run
```

Health checks:

- `GET /api` returns basic API + MongoDB connectivity status.
- `GET /api/health` returns `200` when MongoDB is reachable, otherwise `503`.
