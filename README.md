# Ummeed: AI-Integrated Orphanage and Volunteer Ecosystem

Ummeed is a sophisticated, full-stack management platform designed to connect orphanages with passionate volunteers. By leveraging AI-driven verification agents and a gamified experience, the platform creates a secure and engaging environment for social impact.

## Detailed Features

### 1. Orphanage Onboarding & Verification
- **AI-Powered Registration:** Orphanages register using their legal name and Darpan ID. 
- **Verification Agent:** A dedicated agent utilizes Google Vision and OCR to analyze uploaded registration certificates. It enforces a strict 60% fuzzy match threshold on organization names to prevent fraudulent registrations.
- **Automated Strength Calculation:** Upon registration, the system automatically calculates the orphanage's current children strength based on total capacity (Capacity - 8 for large organizations, Capacity - 2 for those under 30).

### 2. Volunteer Identity Verification
- **Government ID Analysis:** Volunteers submit Government IDs (Aadhaar, PAN, Voter ID, or DL).
- **Identity Agent:** The agent extracts text from IDs, validates formatting via regex, and performs fuzzy name matching against the user's profile to ensure high-security standards.

### 3. Orphanage Dashboard
- **Quest Creation:** Administrators can create quests for donations or volunteer visits.
- **XP Assignment Agent:** Every quest is processed by an agent that assigns XP (100–400) based on urgency, type, and description detail.
- **Social Media Engine:** Orphanages can upload "Stories of Hope" (photos and captions) stored physically on the server, simulating a real-world social media experience.
- **Volunteer Management:** A centralized interface to view and approve volunteers who have registered with the organization.

### 4. Volunteer Dashboard & Gamification
- **Global Quests Feed:** A real-time feed of all active needs across various partnered orphanages.
- **Badge Tracking:** Volunteers track their progress through a top-left profile UI featuring three XP progress bars:
  - **Bronze:** 3,000 XP
  - **Silver:** 5,000 XP
  - **Gold:** 10,000 XP
- **WhatsApp Integration:** Direct one-click WhatsApp API links are generated for every quest, allowing volunteers to coordinate with administrators instantly.

### 5. Social Wall (Stories Feed)
- **Public Impact Feed:** A global social media feed where volunteers can see the real-world results of their help.
- **Interactions:** Logged-in users can like stories, which updates a live counter stored in MongoDB.

---

## Setup Instructions

### Prerequisites
- **Python 3.10+**
- **Node.js 18+**
- **MongoDB** (Local or Atlas instance)
- **Tesseract OCR** (Installed locally on the machine)
- **Firebase Project** (For authentication and Admin SDK)

### Backend Setup
1. **Navigate to the backend directory:**
   ```bash
   cd backend
   ```
2. **Install dependencies:**
   ```bash
   pip install flask flask-cors pymongo pytesseract opencv-python pillow thefuzz python-dotenv firebase-admin
   ```
3. **Configure Environment Variables:**
   Create a `.env` file in the `backend/` folder:
   ```env
   MONGODB_URI=your_mongodb_uri
   MONGODB_DB=ummeed
   TESSERACT_CMD=C:\Program Files\Tesseract-OCR\tesseract.exe
   FIREBASE_SERVICE_ACCOUNT=path/to/your/firebase-service-account.json
   ```
4. **Run the server:**
   ```bash
   python app.py
   ```
   *The server will run on http://localhost:5000*

### Frontend Setup
1. **Navigate to the frontend directory:**
   ```bash
   cd frontend
   ```
2. **Install dependencies:**
   ```bash
   npm install
   ```
3. **Configure Environment Variables:**
   Create a `.env` file in the `frontend/` folder with your Firebase configuration.
4. **Run the development server:**
   ```bash
   npm run dev
   ```
   *The application will be accessible on http://localhost:5173*

---

## AI Agents Architecture

- **Verification Agent:** Orchestrates the OCR and fuzzy matching pipeline for document security.
- **XP Logic Agent:** Calculates fair rewards for volunteer tasks to maintain ecosystem balance.
- **Mapping Agent:** Integrates proximity data to suggest orphanages nearest to the volunteer's registered location.
- **Quest Management Agent:** Ensures quest data is synchronized between the creator (orphanage) and the viewer (volunteer).

---
*Built with Google SDK and AI Agent technology.*
