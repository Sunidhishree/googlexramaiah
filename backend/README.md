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
