import os
<<<<<<< HEAD
import re
import cv2
import pytesseract
from PIL import Image
from thefuzz import fuzz
from flask import Flask, jsonify, request, send_from_directory
from flask_cors import CORS
from werkzeug.utils import secure_filename
from auth import verify_firebase_token, mongo_client
from datetime import datetime
=======
from datetime import datetime, timezone

from flask import Flask, jsonify, request
from auth import verify_firebase_token
from db import get_collection, ping_database
>>>>>>> f887bb503596bd52b243f60b04f7af620415fc2d
from dotenv import load_dotenv

load_dotenv()

# Tesseract path from user request
pytesseract.pytesseract.tesseract_cmd = os.getenv('TESSERACT_CMD', r"C:\Program Files\Tesseract-OCR\tesseract.exe")

app = Flask(__name__)
CORS(app, resources={r"/api/*": {"origins": "*"}}, supports_credentials=False)

UPLOAD_FOLDER = 'uploads'
if not os.path.exists(UPLOAD_FOLDER):
    os.makedirs(UPLOAD_FOLDER)

SOCIAL_FOLDER = 'social'
if not os.path.exists(SOCIAL_FOLDER):
    os.makedirs(SOCIAL_FOLDER)

app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
app.config['SOCIAL_FOLDER'] = SOCIAL_FOLDER

# ID Regex Patterns
ID_PATTERNS = {
    'aadhaar': r'\d{4}\s?\d{4}\s?\d{4}',
    'pan': r'[A-Z]{5}[0-9]{4}[A-Z]',
    'voter': r'[A-Z]{3}[0-9]{7}',
    'dl': r'^[A-Z]{2}[0-9]{2}\s?[0-9]{11}$'
}

GOVT_KEYWORDS = ['government', 'india', 'income tax', 'election commission', 'unique identification', 'aadhaar', 'permanent account number', 'driving license']

def extract_text(image_path):
    # Basic image processing with OpenCV
    img = cv2.imread(image_path)
    if img is None:
        return ""
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    # Applying thresholding for better OCR
    thresh = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)[1]
    
    text_thresh = pytesseract.image_to_string(thresh)
    text_gray = pytesseract.image_to_string(gray)
    
    # Combine results to capture text missed by thresholding (common on certificates)
    text = text_thresh + " " + text_gray
    return text.lower()

def generate_date_formats(date_str):
    if not date_str:
        return []
    parts = date_str.split('-')
    if len(parts) == 3:
        y, m, d = parts
        return [f"{d}/{m}/{y}", f"{d}-{m}-{y}", f"{d} {m} {y}", date_str]
    return [date_str]

DARPAN_ID_PATTERN = r'\b[A-Z]{2}/\d{4}/\d{7}\b'

DARPAN_KEYWORDS = [
    "DARPAN", "NGO DARPAN", "NITI AAYOG", "UNIQUE ID", "REGISTRATION",
    "GOVERNMENT OF INDIA", "MINISTRY", "CERTIFICATE OF REGISTRATION",
    "VOLUNTARY ORGANISATION", "NGO", "SOCIETY", "TRUST",
]

def verify_darpan_certificate(filepath, org_name, darpan_id=None, reg_date=None):
    try:
        extracted_text = extract_text(filepath)
        extracted_upper = extracted_text.upper()

        has_darpan_keyword = any(kw in extracted_upper for kw in DARPAN_KEYWORDS)
        id_found_in_doc = bool(re.search(DARPAN_ID_PATTERN, extracted_upper))

        id_match = False
        if darpan_id:
            normalized_input = darpan_id.strip().upper()
            # Flexible ID matching: ignore spaces, normalize slashes, and allow fuzzy match
            clean_extracted = extracted_upper.replace(" ", "").replace("\n", "").replace("-", "/")
            clean_input = normalized_input.replace(" ", "").replace("-", "/")
            
            id_fuzzy_score = fuzz.partial_ratio(normalized_input, extracted_upper)
            
            # Check if input follows pattern to allow even more leniency
            is_valid_format = bool(re.match(DARPAN_ID_PATTERN, normalized_input))
            threshold = 40 if is_valid_format else 85
            
            id_match = (clean_input in clean_extracted) or (id_fuzzy_score >= threshold)
        else:
            id_match = id_found_in_doc

        # Fuzzy match organisation name - use partial_ratio for better substring matching
        name_score_token = fuzz.token_set_ratio(org_name.upper(), extracted_upper)
        name_score_partial = fuzz.partial_ratio(org_name.upper(), extracted_upper)
        name_score = max(name_score_token, name_score_partial)

        # Even more lenient: check if name (without common suffixes) exists in text
        name_clean = re.sub(r'\b(FOUNDATION|TRUST|SOCIETY|NGO|ORGANIZATION|CENTRE|CENTER)\b', '', org_name.upper()).strip()
        if len(name_clean) > 3:
            name_score = max(name_score, fuzz.partial_ratio(name_clean, extracted_upper))

        date_match = True
        if reg_date:
            date_formats = generate_date_formats(reg_date)
            date_match = any(fmt in extracted_text for fmt in date_formats)

        is_verified = False
        reason = ""

        # Main check: Organization Name
        if name_score >= 60:
            is_verified = True
            reason = "Darpan Certificate verified successfully based on organization name."
        else:
            reason = f"Verification failed. Organization name match ({name_score}%) is below 60%."

        return {
            'verified': is_verified,
            'reason': reason,
            'ocr_text': extracted_text[:200] + "..." if len(extracted_text) > 200 else extracted_text,
            'debug': {
                'has_darpan_keyword': has_darpan_keyword,
                'id_found_in_doc': id_found_in_doc,
                'id_match': id_match,
                'name_score': name_score,
                'date_match': date_match,
            }
        }
    except Exception as e:
        return {'error': str(e)}

@app.route('/api/places/reverse-geocode', methods=['POST'])
def reverse_geocode():
    # Dummy reverse geocode
    return jsonify({
        "address": "Sample Reverse Geocoded Address",
        "display_name": "Sample Reverse Geocoded Address, Test City",
        "pincode": "560001",
        "state": "Karnataka"
    })

@app.route('/api/orphanage/register', methods=['POST'])
def register_orphanage():
    org_name = request.form.get('name', '')
    darpan_id = request.form.get('darpan_id', '')
    
    file = request.files.get('certificate')
    
    verification_payload = None
    if file and file.filename != '':
        filename = "darpan.png"
        filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
        file.save(filepath)
        
        verify_result = verify_darpan_certificate(filepath, org_name, darpan_id)
        
        if verify_result.get('error'):
            return jsonify({'error': 'Verification failed', 'details': verify_result['error']}), 500
            
        status = "verified" if verify_result['verified'] else "rejected"
        verification_payload = {
            "status": status,
            "reason": verify_result['reason'],
            "score": verify_result['debug']['name_score'] if 'debug' in verify_result else 0
        }
    else:
        verification_payload = {
            "status": "review",
            "reason": "No certificate uploaded. Manual verification required."
        }

    org_id = "org_" + os.urandom(4).hex()
    
    capacity = int(request.form.get('capacity', 0) or 0)
    current_strength = max(0, capacity - 2) if capacity < 30 else max(0, capacity - 8)

    orphanage_data = {
        "_id": org_id,
        "name": org_name,
        "darpan_id": darpan_id,
        "description": request.form.get('description', ''),
        "address": request.form.get('address', ''),
        "pincode": request.form.get('pincode', ''),
        "state": request.form.get('state', ''),
        "capacity": capacity,
        "current_strength": current_strength,
        "contact_person": request.form.get('contact_person', ''),
        "phone": request.form.get('phone', ''),
        "email": request.form.get('email', ''),
        "verification": verification_payload,
        "created_at": datetime.utcnow()
    }
    
    if mongo_client:
        try:
            db_name = os.getenv('MONGODB_DB', 'ummeed')
            db = mongo_client[db_name]
            orphanages = db.get_collection('orphanages')
            orphanages.insert_one(orphanage_data)
        except Exception as e:
            print(f"[DB Error] Failed to save orphanage: {e}")

    return jsonify({
        "id": org_id,
        "verification": verification_payload,
        "message": "Registration received."
    })


@app.route('/api/verify-id', methods=['POST'])
@verify_firebase_token
def verify_id():
    if 'file' not in request.files:
        return jsonify({'error': 'No file uploaded'}), 400
    
    file = request.files['file']
    id_type = request.form.get('idType', '').lower()
    user_name = request.form.get('name', '').lower()
    user_dob = request.form.get('dob', '') # Expected YYYY-MM-DD
    
    # Convert YYYY-MM-DD to common ID formats for searching
    dob_formats = []
    if user_dob:
        parts = user_dob.split('-')
        if len(parts) == 3:
            y, m, d = parts
            dob_formats = [f"{d}/{m}/{y}", f"{d}-{m}-{y}", f"{d} {m} {y}", user_dob]

    if file.filename == '':
        return jsonify({'error': 'No file selected'}), 400

    filename = "id.png" # Fixed name as requested
    filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
    file.save(filepath)

    try:
        extracted_text = extract_text(filepath)
        
        # 1. Check for Govt Keywords
        has_govt_keyword = any(keyword in extracted_text for keyword in GOVT_KEYWORDS)
        
        # 2. Check Regex Pattern
        pattern = ID_PATTERNS.get(id_type)
        id_match = False
        if pattern:
            id_match = bool(re.search(pattern, extracted_text.upper()))
        
        # 3. Fuzzy match name
        name_score = fuzz.token_set_ratio(user_name, extracted_text)

        # 4. Check DOB
        dob_match = any(fmt in extracted_text for fmt in dob_formats) if dob_formats else True # Default to true if not provided
        
        # Verification Logic
        is_verified = False
        reason = ""
        
        if not has_govt_keyword and not id_match:
            reason = "Document does not appear to be a valid government ID."
        elif id_type in ID_PATTERNS and not id_match:
            reason = f"Could not find a valid {id_type.upper()} number format."
        elif name_score < 70:
            reason = f"Name on ID does not match the entered name ({name_score}% match)."
        elif not dob_match:
            reason = "Date of Birth on ID does not match the entered date."
        else:
            is_verified = True
            reason = "Identity verified successfully via AI."

        if is_verified and mongo_client:
            try:
                db_name = os.getenv('MONGODB_DB', 'ummeed')
                db = mongo_client[db_name]
                volunteers = db.get_collection('volunteers')
                user_id = getattr(request, 'user', {}).get('uid', 'temp_' + os.urandom(4).hex())
                
                details = {
                    "profession": request.form.get('profession', ''),
                    "email": request.form.get('email', ''),
                    "phone": request.form.get('phone', ''),
                    "address": request.form.get('address', ''),
                    "city": request.form.get('city', ''),
                    "state": request.form.get('state', ''),
                    "pincode": request.form.get('pincode', '')
                }
                
                volunteer_data = {
                    "_id": user_id,
                    "name": user_name.title(),
                    "dob": user_dob,
                    "id_type": id_type,
                    "details": details,
                    "phone": details.get('phone', ''),
                    "status": "pending",
                    "xp": 0,
                    "rank": "Newcomer",
                    "badges": [],
                    "created_at": datetime.utcnow()
                }
                volunteers.update_one({"_id": user_id}, {"$set": volunteer_data}, upsert=True)
            except Exception as e:
                print(f"[DB Error] Failed to save volunteer: {e}")


        return jsonify({
            'verified': is_verified,
            'reason': reason,
            'ocr_text': extracted_text[:200] + "..." if len(extracted_text) > 200 else extracted_text,
            'debug': {
                'has_govt_keyword': has_govt_keyword,
                'id_match': id_match,
                'name_score': name_score,
                'dob_match': dob_match
            }
        })


    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api')
def index():
    return jsonify({'status': 'ok', 'mongodb': 'connected' if ping_database() else 'disconnected'})


@app.route('/api/health')
def health():
    db_ok = ping_database()
    status_code = 200 if db_ok else 503
    return jsonify({'status': 'ok' if db_ok else 'degraded', 'mongodb': db_ok}), status_code

@app.route('/api/auth/sync', methods=['POST'])
@verify_firebase_token
def sync_user():
    user = getattr(request, 'user', None)
<<<<<<< HEAD
    return jsonify({'status': 'synced', 'user': user})

@app.route('/api/orphanage/<orphanage_id>', methods=['GET'])
def get_orphanage(orphanage_id):
    if not mongo_client:
        return jsonify({'error': 'Database connection not available'}), 500
    try:
        db_name = os.getenv('MONGODB_DB', 'ummeed')
        db = mongo_client[db_name]
        orphanage = db.orphanages.find_one({"_id": orphanage_id})
        if not orphanage:
            return jsonify({'error': 'Orphanage not found'}), 404
        
        if '_id' in orphanage and not isinstance(orphanage['_id'], str):
             orphanage['_id'] = str(orphanage['_id'])

        return jsonify(orphanage)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

def serialize_doc(doc):
    if '_id' in doc:
        doc['_id'] = str(doc['_id'])
    if 'created_at' in doc and hasattr(doc['created_at'], 'isoformat'):
        doc['created_at'] = doc['created_at'].isoformat()
    return doc

from datetime import timezone

def calculate_quest_xp(quest: dict) -> dict:
    xp = 0
    breakdown = {}
    quest_type = quest.get("quest_type", "").lower()
    type_xp = {"donate": 100, "volunteer": 150, "wishlist": 80}
    base = type_xp.get(quest_type, 100)
    xp += base
    breakdown["base_type"] = base

    deadline_str = quest.get("deadline", "")
    urgency_xp = 0
    if deadline_str:
        try:
            deadline = datetime.strptime(deadline_str, "%Y-%m-%d").replace(tzinfo=timezone.utc)
            now = datetime.now(timezone.utc)
            days_left = (deadline - now).days
            if days_left < 0: urgency_xp = 0
            elif days_left <= 3: urgency_xp = 120
            elif days_left <= 7: urgency_xp = 90
            elif days_left <= 14: urgency_xp = 60
            elif days_left <= 30: urgency_xp = 30
            else: urgency_xp = 10
        except ValueError:
            urgency_xp = 0
    xp += urgency_xp
    breakdown["urgency"] = urgency_xp

    spots_xp = 0
    if quest_type == "volunteer":
        try:
            spots = int(quest.get("spots") or 0)
            if spots >= 10: spots_xp = 40
            elif spots >= 5: spots_xp = 25
            elif spots >= 2: spots_xp = 15
            elif spots == 1: spots_xp = 30
        except (ValueError, TypeError):
            spots_xp = 0
    xp += spots_xp
    breakdown["spots_bonus"] = spots_xp

    description = quest.get("description", "") or ""
    desc_xp = 0
    word_count = len(description.split())
    if word_count >= 30: desc_xp = 30
    elif word_count >= 15: desc_xp = 20
    elif word_count >= 5: desc_xp = 10
    xp += desc_xp
    breakdown["description_quality"] = desc_xp

    xp = max(100, min(400, xp))
    return {**quest, "xp": xp, "xp_breakdown": breakdown}

@app.route('/api/orphanage/<orphanage_id>/quests', methods=['GET', 'POST'])
def manage_quests(orphanage_id):
    if not mongo_client:
        return jsonify({'error': 'DB error'}), 500
    db = mongo_client[os.getenv('MONGODB_DB', 'ummeed')]
    
    if request.method == 'POST':
        quest_data = request.json
        quest_data['_id'] = "quest_" + os.urandom(4).hex()
        quest_data['orphanage_id'] = orphanage_id
        quest_data['created_at'] = datetime.utcnow()
        
        # Calculate XP based on algorithm
        quest_data = calculate_quest_xp(quest_data)
        
        db.quests.insert_one(quest_data)
        return jsonify(serialize_doc(quest_data))
        
    quests = list(db.quests.find({'orphanage_id': orphanage_id}).sort('created_at', -1))
    return jsonify([serialize_doc(q) for q in quests])

@app.route('/social/<filename>')
def serve_social_media(filename):
    return send_from_directory(app.config['SOCIAL_FOLDER'], filename)

@app.route('/api/orphanage/<orphanage_id>/stories', methods=['GET', 'POST'])
def manage_stories(orphanage_id):
    if not mongo_client:
        return jsonify({'error': 'DB error'}), 500
    db = mongo_client[os.getenv('MONGODB_DB', 'ummeed')]
    
    if request.method == 'POST':
        caption = request.form.get('caption', '')
        tags = request.form.get('tags', '')
        file = request.files.get('photo')
        
        photo_url = ""
        if file and file.filename != '':
            filename = "story_" + os.urandom(8).hex() + os.path.splitext(file.filename)[1]
            filepath = os.path.join(app.config['SOCIAL_FOLDER'], filename)
            file.save(filepath)
            photo_url = f"{request.host_url}social/{filename}"

        story_data = {
            '_id': "story_" + os.urandom(4).hex(),
            'orphanage_id': orphanage_id,
            'caption': caption,
            'tags': tags,
            'photo': photo_url,
            'likes': 40,
            'comments': 0,
            'liked': False,
            'created_at': datetime.utcnow()
        }
        db.stories.insert_one(story_data)
        return jsonify(serialize_doc(story_data))
        
    stories = list(db.stories.find({'orphanage_id': orphanage_id}).sort('created_at', -1))
    return jsonify([serialize_doc(s) for s in stories])

@app.route('/api/stories/<story_id>/like', methods=['POST'])
def like_story(story_id):
    if not mongo_client:
        return jsonify({'error': 'DB error'}), 500
    db = mongo_client[os.getenv('MONGODB_DB', 'ummeed')]
    
    result = db.stories.find_one_and_update(
        {'_id': story_id},
        {'$inc': {'likes': 1}, '$set': {'liked': True}},
        return_document=True
    )
    if result:
        return jsonify({'success': True, 'likes': result.get('likes')})
    return jsonify({'error': 'Not found'}), 404

@app.route('/api/orphanage/<orphanage_id>/volunteers', methods=['GET'])
def get_volunteers(orphanage_id):
    if not mongo_client:
        return jsonify({'error': 'DB error'}), 500
    db = mongo_client[os.getenv('MONGODB_DB', 'ummeed')]
    volunteers = list(db.volunteers.find({}).sort('created_at', -1))
    return jsonify([serialize_doc(v) for v in volunteers])

@app.route('/api/volunteers/<volunteer_id>/approve', methods=['POST'])
def approve_volunteer(volunteer_id):
    if not mongo_client:
        return jsonify({'error': 'DB error'}), 500
    db = mongo_client[os.getenv('MONGODB_DB', 'ummeed')]
    db.volunteers.update_one({'_id': volunteer_id}, {'$set': {'status': 'approved'}})
    return jsonify({'success': True})

@app.route('/api/quests/feed', methods=['GET'])
def global_quests_feed():
    if not mongo_client:
        return jsonify({'error': 'DB error'}), 500
    db = mongo_client[os.getenv('MONGODB_DB', 'ummeed')]
    
    quests = list(db.quests.find({'status': 'active'}).sort('created_at', -1))
    for q in quests:
        org = db.orphanages.find_one({'_id': q.get('orphanage_id')})
        if org:
            q['org_name'] = org.get('name', 'Unknown')
            q['org_phone'] = org.get('phone', '')
    return jsonify([serialize_doc(q) for q in quests])

@app.route('/api/stories/feed', methods=['GET'])
def global_stories_feed():
    if not mongo_client:
        return jsonify({'error': 'DB error'}), 500
    db = mongo_client[os.getenv('MONGODB_DB', 'ummeed')]
    
    stories = list(db.stories.find().sort('created_at', -1))
    for s in stories:
        org = db.orphanages.find_one({'_id': s.get('orphanage_id')})
        if org:
            s['org_name'] = org.get('name', 'Unknown')
    return jsonify([serialize_doc(s) for s in stories])

@app.route('/api/quests/<quest_id>/accept', methods=['POST'])
@verify_firebase_token
def accept_quest(quest_id):
    if not mongo_client:
        return jsonify({'error': 'DB error'}), 500
    db = mongo_client[os.getenv('MONGODB_DB', 'ummeed')]
    
    uid = request.user.get('uid')
    
    quest = db.quests.find_one_and_update(
        {'_id': quest_id},
        {'$inc': {'accepted': 1}},
        return_document=True
    )
    
    if not quest:
        return jsonify({'error': 'Quest not found'}), 404
        
    xp_reward = quest.get('xp', 100)
    
    db.volunteers.update_one(
        {'_id': uid},
        {'$inc': {'xp': xp_reward}},
        upsert=True
    )
    
    return jsonify({'success': True, 'xp_earned': xp_reward})

@app.route('/api/user/profile', methods=['GET'])
@verify_firebase_token
def user_profile():
    if not mongo_client:
        return jsonify({'error': 'DB error'}), 500
    db = mongo_client[os.getenv('MONGODB_DB', 'ummeed')]
    
    uid = request.user.get('uid')
    volunteer = db.volunteers.find_one({'_id': uid})
    
    if volunteer:
        return jsonify(serialize_doc(volunteer))
    
    return jsonify({
        '_id': uid,
        'name': request.user.get('name') or request.user.get('email', 'Volunteer'),
        'xp': 0
    })
=======
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
>>>>>>> f887bb503596bd52b243f60b04f7af620415fc2d

if __name__ == '__main__':
    port = int(os.getenv('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=os.getenv('FLASK_DEBUG', 'False') == 'True')
