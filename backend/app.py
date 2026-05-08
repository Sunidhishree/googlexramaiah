import os
import re
import cv2
import pytesseract
from PIL import Image
from thefuzz import fuzz
from flask import Flask, jsonify, request
from flask_cors import CORS
from werkzeug.utils import secure_filename
from auth import verify_firebase_token
from dotenv import load_dotenv

load_dotenv()

# Tesseract path from user request
pytesseract.pytesseract.tesseract_cmd = os.getenv('TESSERACT_CMD', r"C:\Program Files\Tesseract-OCR\tesseract.exe")

app = Flask(__name__)
CORS(app, resources={r"/api/*": {"origins": "*"}}, supports_credentials=True)

UPLOAD_FOLDER = 'uploads'
if not os.path.exists(UPLOAD_FOLDER):
    os.makedirs(UPLOAD_FOLDER)

app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER

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
    
    text = pytesseract.image_to_string(thresh)
    return text.lower()

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

if __name__ == '__main__':
    port = int(os.getenv('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=os.getenv('FLASK_DEBUG', 'False') == 'True')

