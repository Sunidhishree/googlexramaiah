"""
Quest Routes Blueprint for Ummeed Platform.
Handles quest CRUD, recommendations, and acceptance with XP rewards.
"""

import os
from datetime import datetime, timezone
from flask import Blueprint, jsonify, request, send_from_directory
from auth import verify_firebase_token, mongo_client
from services.quest_recommender import get_recommended_quests, generate_greeting
from services.certificate_service import generate_certificate
from services.email_service import send_certificate_email

quest_bp = Blueprint('quests', __name__)


def _get_db():
    if mongo_client is None:
        return None
    return mongo_client[os.getenv('MONGODB_DB', 'ummeed')]


def _serialize(doc):
    if not doc:
        return doc
    if '_id' in doc:
        doc['_id'] = str(doc['_id'])
    for key in ('created_at', 'deadline'):
        val = doc.get(key)
        if val and hasattr(val, 'isoformat'):
            doc[key] = val.isoformat()
    return doc


def _compute_urgency(deadline_str):
    """Compute urgency label from deadline string."""
    if not deadline_str:
        return "open"
    try:
        if isinstance(deadline_str, str):
            deadline = datetime.strptime(deadline_str, "%Y-%m-%d").replace(tzinfo=timezone.utc)
        else:
            deadline = deadline_str.replace(tzinfo=timezone.utc) if deadline_str.tzinfo is None else deadline_str
        days_left = (deadline - datetime.now(timezone.utc)).days
        if days_left < 0:
            return "expired"
        elif days_left <= 3:
            return "urgent"
        elif days_left <= 7:
            return "soon"
        return "open"
    except (ValueError, AttributeError):
        return "open"


RANK_THRESHOLDS = [
    (0, "Newcomer"),
    (500, "Helper"),
    (1500, "Supporter"),
    (3000, "Bronze"),
    (5000, "Silver"),
    (8000, "Guardian Angel"),
    (10000, "Gold"),
    (15000, "Champion"),
    (25000, "Legend"),
]


def _get_rank(xp):
    rank = "Newcomer"
    for threshold, name in RANK_THRESHOLDS:
        if xp >= threshold:
            rank = name
    return rank


def _get_next_rank_info(xp):
    """Return (next_rank_name, xp_needed) or None if max rank."""
    for threshold, name in RANK_THRESHOLDS:
        if xp < threshold:
            return name, threshold - xp
    return None, 0


# ─────────────────── ENDPOINTS ───────────────────

@quest_bp.route('/create', methods=['POST'])
def create_quest():
    db = _get_db()
    if db is None:
        return jsonify({'error': 'DB error'}), 500

    data = request.json or {}
    quest_id = "quest_" + os.urandom(4).hex()

    quest = {
        "_id": quest_id,
        "orphanage_id": data.get("orphanage_id", ""),
        "title": data.get("title", ""),
        "description": data.get("description", ""),
        "quest_type": data.get("quest_type", "donate"),
        "xp": data.get("xp_reward", 100),
        "deadline": data.get("deadline", ""),
        "items_needed": data.get("items_needed", ""),
        "spots_available": int(data.get("spots_available", 10)),
        "spots_filled": 0,
        "accepted_by": [],
        "status": "active",
        "created_at": datetime.utcnow(),
    }

    # Attach orphanage name
    org = db.orphanages.find_one({"_id": quest["orphanage_id"]})
    if org:
        quest["orphanage_name"] = org.get("name", "Unknown")
        quest["org_state"] = org.get("state", "")

    quest["urgency"] = _compute_urgency(quest["deadline"])

    db.quests.insert_one(quest)
    return jsonify(_serialize(quest)), 201


@quest_bp.route('/all', methods=['GET'])
def get_all_quests():
    db = _get_db()
    if db is None:
        return jsonify({'error': 'DB error'}), 500

    quests = list(db.quests.find({"status": "active"}).sort("deadline", 1))
    for q in quests:
        # Enrich with org info
        org = db.orphanages.find_one({"_id": q.get("orphanage_id")})
        if org:
            q["org_name"] = org.get("name", "Unknown")
            q["org_phone"] = org.get("phone", "")
            q["org_state"] = org.get("state", "")
        q["urgency"] = _compute_urgency(q.get("deadline"))
        q["spots_filled"] = len(q.get("accepted_by", []))

    return jsonify([_serialize(q) for q in quests])


@quest_bp.route('/recommended/<user_id>', methods=['GET'])
@verify_firebase_token
def get_recommended(user_id):
    db = _get_db()
    if db is None:
        return jsonify({'error': 'DB error'}), 500

    # Fetch user profile
    user_profile = db.volunteers.find_one({"_id": user_id})
    if not user_profile:
        user_profile = {"_id": user_id, "xp": 0, "rank": "Newcomer", "badges": []}

    # Fetch all active quests
    quests = list(db.quests.find({"status": "active"}))
    for q in quests:
        org = db.orphanages.find_one({"_id": q.get("orphanage_id")})
        if org:
            q["org_name"] = org.get("name", "Unknown")
            q["org_phone"] = org.get("phone", "")
            q["org_state"] = org.get("state", "")
        q["urgency"] = _compute_urgency(q.get("deadline"))
        q["spots_filled"] = len(q.get("accepted_by", []))

    # Get recommendations
    recommended = get_recommended_quests(user_profile, quests)

    # Generate greeting
    user_name = user_profile.get("name", "Volunteer")
    rank = _get_rank(user_profile.get("xp", 0))
    quests_completed = len(user_profile.get("quests_completed", []))
    greeting = generate_greeting(user_name, rank, quests_completed)

    # Next rank info
    current_xp = user_profile.get("xp", 0)
    next_rank_name, xp_to_next = _get_next_rank_info(current_xp)

    return jsonify({
        "greeting": greeting,
        "recommended": [_serialize(q) for q in recommended[:5]],
        "all_quests": [_serialize(q) for q in recommended],
        "user_rank": rank,
        "user_xp": current_xp,
        "next_rank": next_rank_name,
        "xp_to_next_rank": xp_to_next,
        "badges": user_profile.get("badges", []),
    })


@quest_bp.route('/<quest_id>/accept', methods=['POST'])
@verify_firebase_token
def accept_quest(quest_id):
    db = _get_db()
    if db is None:
        return jsonify({'error': 'DB error'}), 500

    uid = request.user.get('uid')

    # Check if already accepted
    quest = db.quests.find_one({"_id": quest_id})
    if not quest:
        return jsonify({'error': 'Quest not found'}), 404

    if uid in quest.get("accepted_by", []):
        return jsonify({'error': 'Already accepted', 'already_accepted': True}), 400

    # Check spots
    spots_available = quest.get("spots_available", 10)
    spots_filled = len(quest.get("accepted_by", []))
    if spots_filled >= spots_available:
        return jsonify({'error': 'No spots available'}), 400

    # Update quest
    db.quests.update_one(
        {"_id": quest_id},
        {
            "$push": {"accepted_by": uid},
            "$inc": {"accepted": 1}
        }
    )

    xp_reward = quest.get("xp", 100)

    # Update volunteer XP and track quest
    quest_type = quest.get("quest_type", "")
    db.volunteers.update_one(
        {"_id": uid},
        {
            "$inc": {"xp": xp_reward},
            "$push": {
                "quests_completed": quest_id,
                "quest_types_completed": quest_type,
                "recent_quest_types": quest_type
            }
        },
        upsert=True
    )

    # Get updated profile
    updated_volunteer = db.volunteers.find_one({"_id": uid})
    new_xp = updated_volunteer.get("xp", 0) if updated_volunteer else xp_reward
    new_rank = _get_rank(new_xp)

    # Update rank in DB
    db.volunteers.update_one({"_id": uid}, {"$set": {"rank": new_rank}})

    next_rank_name, xp_to_next = _get_next_rank_info(new_xp)

    return jsonify({
        "success": True,
        "xp_earned": xp_reward,
        "new_xp_total": new_xp,
        "new_rank": new_rank,
        "next_rank": next_rank_name,
        "xp_to_next_rank": xp_to_next,
        "spots_remaining": spots_available - spots_filled - 1
    })


@quest_bp.route('/orphanage/<orphanage_id>', methods=['GET'])
def get_orphanage_quests(orphanage_id):
    db = _get_db()
    if db is None:
        return jsonify({'error': 'DB error'}), 500

    quests = list(db.quests.find({"orphanage_id": orphanage_id}).sort("created_at", -1))
    for q in quests:
        q["urgency"] = _compute_urgency(q.get("deadline"))
        q["spots_filled"] = len(q.get("accepted_by", []))

    return jsonify([_serialize(q) for q in quests])


@quest_bp.route('/<quest_id>/complete', methods=['POST'])
@verify_firebase_token
def complete_quest(quest_id):
    """Mark a quest as completed by the user. Generate certificate + send email."""
    db = _get_db()
    if db is None:
        return jsonify({'error': 'DB error'}), 500

    uid = request.user.get('uid')

    # 1. Fetch quest
    quest = db.quests.find_one({"_id": quest_id})
    if not quest:
        return jsonify({'error': 'Quest not found'}), 404

    # 2. Fetch user
    volunteer = db.volunteers.find_one({"_id": uid})
    if not volunteer:
        return jsonify({'error': 'User not found'}), 404

    # 3. Check user accepted this quest
    accepted_by = quest.get("accepted_by", [])
    if uid not in accepted_by:
        return jsonify({'error': 'You must accept the quest before completing it'}), 400

    # Check not already completed
    completed_by = quest.get("completed_by", [])
    if uid in completed_by:
        return jsonify({'error': 'Already completed', 'already_completed': True}), 400

    # 4. Award XP
    xp_reward = quest.get("xp", 100)
    db.volunteers.update_one(
        {"_id": uid},
        {"$inc": {"xp": xp_reward}}
    )

    # 5. Update quest: add to completed_by
    db.quests.update_one(
        {"_id": quest_id},
        {"$push": {"completed_by": uid}}
    )

    # 6. Get updated volunteer and calculate rank
    updated_vol = db.volunteers.find_one({"_id": uid})
    new_xp = updated_vol.get("xp", 0)
    new_rank = _get_rank(new_xp)
    db.volunteers.update_one({"_id": uid}, {"$set": {"rank": new_rank}})

    # 7. Assign badges
    quests_completed_list = updated_vol.get("quests_completed", [])
    current_badges = updated_vol.get("badges", [])
    new_badges = []

    completed_count = len(completed_by) + 1  # including this one
    total_completed = len(quests_completed_list)

    if "Quest Completer" not in current_badges and total_completed >= 1:
        new_badges.append("Quest Completer")

    if "Veteran" not in current_badges and total_completed >= 5:
        new_badges.append("Veteran")

    if new_badges:
        db.volunteers.update_one(
            {"_id": uid},
            {"$push": {"badges": {"$each": new_badges}}}
        )

    # 8. Generate certificate — resolve real user name
    user_name = (
        volunteer.get("name")
        or request.user.get("name")
        or request.user.get("display_name")
        or (request.user.get("email", "").split("@")[0].replace(".", " ").title())
    )
    quest_title = quest.get("title", "Quest")
    orphanage_name = quest.get("orphanage_name") or quest.get("org_name", "an Ummeed partner")
    completion_date = datetime.utcnow()

    pdf_path = None
    try:
        pdf_path = generate_certificate(
            user_name=user_name,
            quest_title=quest_title,
            orphanage_name=orphanage_name,
            xp_earned=xp_reward,
            completion_date=completion_date,
            user_id=uid,
            quest_id=quest_id
        )
    except Exception as e:
        print(f"[Complete] Certificate generation failed: {e}")

    # 9. Send email — resolve email from multiple sources
    certificate_sent = False
    user_email = ""

    # Try volunteer.details.email
    details = volunteer.get("details")
    if isinstance(details, dict):
        user_email = details.get("email", "")
    # Try volunteer.email directly
    if not user_email:
        user_email = volunteer.get("email", "")
    # Try Firebase token email
    if not user_email:
        user_email = request.user.get("email", "")

    print(f"[Complete] Resolved email: '{user_email}' for user {uid}")
    print(f"[Complete] PDF path: {pdf_path}")

    if user_email and pdf_path:
        try:
            certificate_sent = send_certificate_email(
                user_email=user_email,
                user_name=user_name,
                quest_title=quest_title,
                xp_earned=xp_reward,
                pdf_path=pdf_path
            )
            print(f"[Complete] Email result: {certificate_sent}")
        except Exception as e:
            print(f"[Complete] Email sending failed: {e}")
            import traceback
            traceback.print_exc()
    elif not user_email:
        print(f"[Complete] No email found for user {uid}")
    elif not pdf_path:
        print(f"[Complete] PDF was not generated, skipping email")

    # 10. Return response
    next_rank_name, xp_to_next = _get_next_rank_info(new_xp)

    return jsonify({
        "success": True,
        "xp_earned": xp_reward,
        "new_xp_total": new_xp,
        "new_rank": new_rank,
        "next_rank": next_rank_name,
        "xp_to_next_rank": xp_to_next,
        "new_badges": new_badges,
        "certificate_sent": certificate_sent,
        "certificate_email": user_email if certificate_sent else None,
    })


@quest_bp.route('/certificate/<filename>', methods=['GET'])
def serve_certificate(filename):
    """Serve generated certificate PDFs for preview."""
    from services.certificate_service import CERT_DIR
    return send_from_directory(CERT_DIR, filename, mimetype='application/pdf')
