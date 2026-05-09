import os
from dotenv import load_dotenv
load_dotenv()

import math
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
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
import threading

# Tesseract path
pytesseract.pytesseract.tesseract_cmd = os.getenv('TESSERACT_CMD', r"C:\Program Files\Tesseract-OCR\tesseract.exe")

app = Flask(__name__)
CORS(app, resources={r"/api/*": {"origins": "*"}}, supports_credentials=True)

UPLOAD_FOLDER = 'uploads'
if not os.path.exists(UPLOAD_FOLDER):
    os.makedirs(UPLOAD_FOLDER)

SOCIAL_FOLDER = 'social'
if not os.path.exists(SOCIAL_FOLDER):
    os.makedirs(SOCIAL_FOLDER)

# Dedicated folder for quest proof photos (used by BLIP analysis)
QUESTS_FOLDER = 'quests'
if not os.path.exists(QUESTS_FOLDER):
    os.makedirs(QUESTS_FOLDER)

app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
app.config['SOCIAL_FOLDER'] = SOCIAL_FOLDER
app.config['QUESTS_FOLDER'] = QUESTS_FOLDER

# ─── BLIP lazy loader ────────────────────────────────────────────────────────
_blip_processor = None
_blip_model = None

def get_blip():
    """Lazy-load BLIP captioning model on first call (avoids slow startup)."""
    global _blip_processor, _blip_model
    if _blip_processor is None:
        try:
            from transformers import BlipProcessor, BlipForConditionalGeneration
            import torch
            print('[BLIP] Loading model Salesforce/blip-image-captioning-base ...')
            _blip_processor = BlipProcessor.from_pretrained('Salesforce/blip-image-captioning-base')
            _blip_model = BlipForConditionalGeneration.from_pretrained('Salesforce/blip-image-captioning-base')
            _blip_model.eval()
            print('[BLIP] Model loaded successfully.')
        except Exception as e:
            print(f'[BLIP] Failed to load model: {e}')
            return None, None
    return _blip_processor, _blip_model


def blip_caption(image_path: str) -> str:
    """Generate an image caption using BLIP. Returns empty string on failure."""
    processor, model = get_blip()
    if processor is None:
        return ''
    try:
        import torch
        raw = Image.open(image_path).convert('RGB')
        inputs = processor(raw, return_tensors='pt')
        with torch.no_grad():
            out = model.generate(**inputs, max_new_tokens=50)
        caption = processor.decode(out[0], skip_special_tokens=True)
        print(f'[BLIP] Caption: {caption}')
        return caption.lower()
    except Exception as e:
        print(f'[BLIP] Caption error: {e}')
        return ''


def image_matches_quest(caption: str, quest: dict) -> bool:
    """
    Returns True if any meaningful word (>3 chars) from the quest's
    title / description / items_needed appears in the BLIP caption.
    """
    if not caption:
        return False
    # Build keyword pool from quest text
    quest_text = ' '.join(filter(None, [
        quest.get('title', ''),
        quest.get('description', ''),
        quest.get('items_needed', ''),
        quest.get('quest_type', ''),
    ])).lower()
    # Common English stop-words to skip
    stopwords = {'the', 'and', 'for', 'with', 'this', 'that', 'have', 'from', 'they',
                 'will', 'your', 'been', 'more', 'also', 'into', 'some', 'than', 'then'}
    keywords = [w for w in re.findall(r'[a-z]+', quest_text) if len(w) > 3 and w not in stopwords]
    for kw in keywords:
        if kw in caption:
            print(f'[BLIP] Keyword match: "{kw}" found in caption')
            return True
    return False

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
    return jsonify({'status': 'ok'})

@app.route('/api/auth/sync', methods=['POST'])
@verify_firebase_token
def sync_user():
    user = getattr(request, 'user', None)
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
    """Record quest acceptance. XP is NOT awarded here — only after verification.
    Returns 409 if the user has already completed this quest."""
    if not mongo_client:
        return jsonify({'error': 'DB error'}), 500
    db = mongo_client[os.getenv('MONGODB_DB', 'ummeed')]

    uid = request.user.get('uid')

    # ── Guard: already completed — cannot accept again ────────────────────────
    completed = db.quest_completions.find_one({'quest_id': quest_id, 'user_id': uid, 'status': 'verified'})
    if completed:
        return jsonify({
            'error': 'already_completed',
            'message': 'You have already completed this quest. Each quest can only be done once.'
        }), 409

    # ── Guard: already accepted — idempotent, just confirm ───────────────────
    already = db.quest_acceptances.find_one({'quest_id': quest_id, 'user_id': uid})
    if already:
        return jsonify({'success': True, 'already_accepted': True, 'message': 'Quest already accepted.'})

    quest = db.quests.find_one_and_update(
        {'_id': quest_id},
        {'$inc': {'accepted': 1}},
        return_document=True
    )

    if not quest:
        return jsonify({'error': 'Quest not found'}), 404

    # Record acceptance
    db.quest_acceptances.insert_one({
        'quest_id': quest_id,
        'user_id': uid,
        'status': 'accepted',
        'accepted_at': datetime.utcnow()
    })

    return jsonify({'success': True, 'message': 'Quest accepted. Submit proof to earn XP.'})


def haversine_km(lat1, lon1, lat2, lon2):
    """Compute distance in km between two GPS points."""
    R = 6371
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2) ** 2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def geocode_address(address):
    """Geocode a text address using Nominatim (free, no API key). Returns (lat, lon) or None."""
    import urllib.request, urllib.parse, json as _json
    try:
        params = urllib.parse.urlencode({'q': address, 'format': 'json', 'limit': 1})
        url = f'https://nominatim.openstreetmap.org/search?{params}'
        req = urllib.request.Request(url, headers={'User-Agent': 'ummeed-app/1.0'})
        with urllib.request.urlopen(req, timeout=8) as resp:
            results = _json.loads(resp.read())
        if results:
            return float(results[0]['lat']), float(results[0]['lon'])
    except Exception as e:
        print(f'[Geocode Error] {e}')
    return None

def send_certificate_email_async(user_email, user_name, quest_title, xp_awarded):
    def send_email():
        if not user_email:
            return
            
        html_content = f"""
        <html>
        <head>
            <style>
                .cert-container {{
                    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                    background-color: #fbf8f1;
                    padding: 40px;
                    text-align: center;
                    border: 8px solid #c4714a;
                    border-radius: 10px;
                    max-width: 600px;
                    margin: 0 auto;
                    color: #3e4a3d;
                }}
                .header {{
                    font-size: 28px;
                    color: #c4714a;
                    margin-bottom: 10px;
                    font-weight: bold;
                    letter-spacing: 2px;
                }}
                .subheader {{
                    font-size: 18px;
                    color: #8a9a86;
                    margin-bottom: 30px;
                }}
                .name {{
                    font-size: 36px;
                    font-weight: bold;
                    color: #2b3329;
                    margin: 20px 0;
                    border-bottom: 2px solid #8a9a86;
                    display: inline-block;
                    padding-bottom: 5px;
                }}
                .text {{
                    font-size: 16px;
                    line-height: 1.5;
                    margin: 20px 0;
                }}
                .highlight {{
                    font-weight: bold;
                    color: #c4714a;
                }}
                .footer {{
                    margin-top: 40px;
                    font-size: 14px;
                    color: #8a9a86;
                    font-style: italic;
                }}
            </style>
        </head>
        <body>
            <div class="cert-container">
                <div class="header">CERTIFICATE OF COMPLETION</div>
                <div class="subheader">Ummeed Volunteer Program</div>
                
                <div class="text">This proudly certifies that</div>
                <div class="name">{user_name or 'Valued Volunteer'}</div>
                
                <div class="text">
                    has successfully completed the quest:<br>
                    <span class="highlight">"{quest_title}"</span>
                </div>
                
                <div class="text">
                    and has been awarded <span class="highlight">{xp_awarded} XP</span> for their outstanding contribution to the community.
                </div>
                
                <div class="footer">
                    Thank you for spreading hope and making a difference.<br>
                    - The Ummeed Team
                </div>
            </div>
        </body>
        </html>
        """
        
        smtp_server = os.getenv('SMTP_SERVER', 'smtp.gmail.com')
        smtp_port = int(os.getenv('SMTP_PORT', 465))
        smtp_user = os.getenv('SMTP_USERNAME')
        smtp_pass = os.getenv('SMTP_PASSWORD')
        from_email = os.getenv('FROM_EMAIL', smtp_user)
        use_ssl = os.getenv('SMTP_USE_SSL', 'true').lower() == 'true'
        
        if not smtp_user or not smtp_pass:
            print("[Email] Skipping certificate email: SMTP credentials not configured in .env")
            return
            
        try:
            msg = MIMEMultipart('alternative')
            msg['Subject'] = f"🏆 Congratulations! Certificate for completing '{quest_title}'"
            msg['From'] = f"Ummeed <{from_email}>"
            msg['To'] = user_email
            
            part = MIMEText(html_content, 'html')
            msg.attach(part)
            
            if use_ssl:
                server = smtplib.SMTP_SSL(smtp_server, smtp_port)
            else:
                server = smtplib.SMTP(smtp_server, smtp_port)
                server.starttls()
                
            server.login(smtp_user, smtp_pass)
            server.send_message(msg)
            server.quit()
            print(f"[Email] Successfully sent certificate to {user_email}")
        except Exception as e:
            print(f"[Email] Failed to send certificate: {e}")

    threading.Thread(target=send_email).start()



LOCATION_THRESHOLD_KM = 0.5  # 500 metres


@app.route('/api/quests/<quest_id>/verify-completion', methods=['POST'])
@verify_firebase_token
def verify_quest_completion(quest_id):
    """
    Verify quest completion using BLIP image captioning + GPS proximity.
    OR logic: if EITHER image OR location matches → XP is awarded.
    Full status is persisted in the 'quest_completions' MongoDB collection.
    """
    if not mongo_client:
        return jsonify({'error': 'DB error'}), 500
    db = mongo_client[os.getenv('MONGODB_DB', 'ummeed')]

    uid = request.user.get('uid')

    # ── Prevent double-verification ──────────────────────────────────────────
    existing = db.quest_completions.find_one({'quest_id': quest_id, 'user_id': uid, 'status': 'verified'})
    if existing:
        return jsonify({'verified': True, 'message': 'Already verified. XP was awarded previously.', 'xp_awarded': existing.get('xp_awarded', 0)})

    # ── Fetch quest ───────────────────────────────────────────────────────────
    quest = db.quests.find_one({'_id': quest_id})
    if not quest:
        return jsonify({'error': 'Quest not found'}), 404

    orphanage_id = request.form.get('orphanage_id') or quest.get('orphanage_id')
    xp_reward = quest.get('xp', 100)

    # ── Fetch org address ─────────────────────────────────────────────────────
    org = db.orphanages.find_one({'_id': orphanage_id}) if orphanage_id else None
    org_address_parts = []
    if org:
        if org.get('address'): org_address_parts.append(org['address'])
        if org.get('pincode'): org_address_parts.append(org['pincode'])
        if org.get('state'):   org_address_parts.append(org['state'])
        org_address_parts.append('India')
    org_address = ', '.join(org_address_parts)

    # ══════════════════════════════════════════════════════════════════════════
    # STEP 1 — Save proof photo to QUESTS_FOLDER and run BLIP
    # ══════════════════════════════════════════════════════════════════════════
    proof_url = ''
    blip_caption_text = ''
    image_verified = False
    image_reason = 'No proof photo uploaded.'

    proof_file = request.files.get('photo')
    if proof_file and proof_file.filename:
        ext = os.path.splitext(proof_file.filename)[1] or '.jpg'
        proof_filename = f"proof_{quest_id}_{uid}_{os.urandom(4).hex()}{ext}"
        proof_path = os.path.join(app.config['QUESTS_FOLDER'], proof_filename)
        proof_file.save(proof_path)
        proof_url = f"{request.host_url}quests/{proof_filename}"
        print(f'[Quest] Saved proof photo to: {proof_path}')

        # ── BLIP captioning ──────────────────────────────────────────────────
        blip_caption_text = blip_caption(proof_path)
        if blip_caption_text:
            image_verified = image_matches_quest(blip_caption_text, quest)
            if image_verified:
                image_reason = f'Image verified via BLIP: "{blip_caption_text}" matches quest requirements.'
            else:
                image_reason = f'BLIP caption "{blip_caption_text}" did not match quest keywords.'
        else:
            image_reason = 'BLIP model unavailable or image could not be processed.'

    # ══════════════════════════════════════════════════════════════════════════
    # STEP 2 — GPS proximity check against org address
    # ══════════════════════════════════════════════════════════════════════════
    location_verified = False
    location_reason = ''
    distance_km = None

    user_lat = request.form.get('latitude')
    user_lon = request.form.get('longitude')

    if user_lat and user_lon:
        if org_address:
            try:
                u_lat, u_lon = float(user_lat), float(user_lon)
                org_coords = geocode_address(org_address)
                if org_coords:
                    org_lat, org_lon = org_coords
                    distance_km = haversine_km(u_lat, u_lon, org_lat, org_lon)
                    if distance_km <= LOCATION_THRESHOLD_KM:
                        location_verified = True
                        location_reason = f'Location verified — {distance_km * 1000:.0f} m from the organisation.'
                    else:
                        location_reason = f'You are {distance_km:.2f} km from the organisation (need ≤500 m).'
                else:
                    # Cannot geocode — be lenient
                    location_verified = True
                    location_reason = 'Org address could not be geocoded; location check bypassed.'
            except Exception as e:
                location_reason = f'Location error: {e}'
        else:
            # No address stored for org — skip check
            location_verified = True
            location_reason = 'No address registered for this organisation; location check skipped.'
    else:
        location_reason = 'No GPS coordinates provided.'

    # ══════════════════════════════════════════════════════════════════════════
    # OR logic: verify if EITHER check passes
    # ══════════════════════════════════════════════════════════════════════════
    is_verified = image_verified or location_verified

    if is_verified:
        verify_method = []
        if image_verified:    verify_method.append('image')
        if location_verified: verify_method.append('location')
        final_reason = ' | '.join(filter(None, [
            image_reason if image_verified else None,
            location_reason if location_verified else None,
        ])) or 'Verified.'
    else:
        verify_method = []
        final_reason = ' | '.join(filter(None, [image_reason, location_reason])) or 'Verification failed.'

    # ══════════════════════════════════════════════════════════════════════════
    # STEP 3 — Persist full completion record to MongoDB
    # ══════════════════════════════════════════════════════════════════════════
    completion_id = f"comp_{quest_id}_{uid}"
    completion_doc = {
        '_id': completion_id,
        'quest_id': quest_id,
        'user_id': uid,
        'orphanage_id': orphanage_id,
        'status': 'verified' if is_verified else 'failed',
        'xp_awarded': xp_reward if is_verified else 0,
        'xp_value': xp_reward,
        'image_verified': image_verified,
        'location_verified': location_verified,
        'blip_caption': blip_caption_text,
        'distance_km': distance_km,
        'proof_url': proof_url,
        'org_address_used': org_address,
        'verify_method': verify_method,
        'reason': final_reason,
        'created_at': datetime.utcnow(),
    }

    db.quest_completions.update_one(
        {'_id': completion_id},
        {'$set': completion_doc},
        upsert=True
    )

    # Also update the acceptance record
    db.quest_acceptances.update_one(
        {'quest_id': quest_id, 'user_id': uid},
        {'$set': {
            'status': 'verified' if is_verified else 'failed',
            'updated_at': datetime.utcnow(),
            'xp_awarded': xp_reward if is_verified else 0,
        }}
    )

    # Award XP only if verified
    xp_awarded = 0
    if is_verified:
        xp_awarded = xp_reward
        db.volunteers.update_one(
            {'_id': uid},
            {'$inc': {'xp': xp_reward}},
            upsert=True
        )
        print(f'[Quest] Awarded {xp_reward} XP to user {uid} for quest {quest_id}')
        
        # Send Certificate Email
        user_doc = db.users.find_one({'uid': uid}) or {}
        user_email = user_doc.get('email')
        user_name = user_doc.get('name')
        if user_email:
            quest_title = quest.get('title', 'Volunteer Quest')
            send_certificate_email_async(user_email, user_name, quest_title, xp_awarded)
    else:
        print(f'[Quest] Verification failed for user {uid} on quest {quest_id}: {final_reason}')

    return jsonify({
        'verified': is_verified,
        'message': final_reason,
        'reason': final_reason,
        'xp_awarded': xp_awarded,
        'image_verified': image_verified,
        'location_verified': location_verified,
        'blip_caption': blip_caption_text,
        'distance_km': distance_km,
        'proof_url': proof_url,
        'verify_method': verify_method,
    })

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


@app.route('/api/user/quest-statuses', methods=['GET'])
@verify_firebase_token
def user_quest_statuses():
    """
    Return all quest acceptances + completions for the current user.
    Used by the frontend to restore accepted/verified state across page reloads.
    """
    if not mongo_client:
        return jsonify({'error': 'DB error'}), 500
    db = mongo_client[os.getenv('MONGODB_DB', 'ummeed')]

    uid = request.user.get('uid')

    # All acceptances
    acceptances = list(db.quest_acceptances.find({'user_id': uid}))
    # All completions
    completions = list(db.quest_completions.find({'user_id': uid}))

    # Build a map: quest_id -> {status, xp_awarded, image_verified, location_verified, blip_caption, ...}
    result = {}
    for a in acceptances:
        qid = a.get('quest_id')
        if qid:
            result[qid] = {
                'accepted': True,
                'status': a.get('status', 'accepted'),
                'xp_awarded': a.get('xp_awarded', 0),
            }
    for c in completions:
        qid = c.get('quest_id')
        if qid:
            entry = result.get(qid, {})
            entry.update({
                'accepted': True,
                'status': c.get('status', 'failed'),
                'xp_awarded': c.get('xp_awarded', 0),
                'image_verified': c.get('image_verified', False),
                'location_verified': c.get('location_verified', False),
                'blip_caption': c.get('blip_caption', ''),
                'distance_km': c.get('distance_km'),
                'proof_url': c.get('proof_url', ''),
                'verify_method': c.get('verify_method', []),
                'reason': c.get('reason', ''),
            })
            result[qid] = entry

    return jsonify(result)


@app.route('/quests/<filename>')
def serve_quest_proof(filename):
    """Serve locally stored quest proof photos."""
    return send_from_directory(app.config['QUESTS_FOLDER'], filename)

if __name__ == '__main__':
    port = int(os.getenv('PORT', 5000))
    # use_reloader=False is REQUIRED when using PyTorch/Transformers on Windows to avoid WinError 10038 crashes
    app.run(host='0.0.0.0', port=port, debug=os.getenv('FLASK_DEBUG', 'False') == 'True', use_reloader=False)
