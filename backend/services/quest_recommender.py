"""
Quest Recommendation Engine for Ummeed Platform.
Pure algorithmic scoring + Gemini-powered personalized greeting.
"""

import os
from datetime import datetime, timezone

# Gemini client (lazy init)
_genai_client = None

def _get_genai_client():
    global _genai_client
    if _genai_client is None:
        try:
            from google import genai
            api_key = os.getenv("GEMINI_API_KEY")
            if api_key:
                _genai_client = genai.Client(api_key=api_key)
        except Exception as e:
            print(f"[Recommender] Gemini init failed: {e}")
    return _genai_client


def generate_greeting(user_name, rank, quests_completed):
    """Generate a personalized greeting using Gemini, with fallback."""
    client = _get_genai_client()
    if client:
        try:
            prompt = (
                f"Generate ONE short, warm, motivational greeting sentence for a volunteer named {user_name}. "
                f"Their rank is '{rank}' and they have completed {quests_completed} quests so far. "
                f"Make it personal and encouraging. Use an emoji. Keep it under 20 words. "
                f"Do NOT use quotation marks in your response."
            )
            response = client.models.generate_content(
                model="gemini-2.0-flash-lite",
                contents=prompt
            )
            greeting = response.text.strip().strip('"').strip("'")
            if greeting:
                return greeting
        except Exception as e:
            print(f"[Recommender] Gemini greeting failed: {e}")

    # Fallback
    if quests_completed > 0:
        return f"Welcome back {user_name}! You've completed {quests_completed} quest{'s' if quests_completed != 1 else ''} so far 🌟"
    return f"Welcome {user_name}! Ready to make a difference? 🌟"


def get_recommended_quests(user_profile, all_quests):
    """
    Score and rank quests for a user based on algorithmic recommendation.
    
    Scoring logic:
    - Base score: 100
    - +30 if matches user's past quest types
    - +20 if deadline within 7 days (urgent)
    - +15 if orphanage in same state as user
    - -10 if user already completed similar quest this week
    - Rank-based adjustments for difficulty
    """
    if not user_profile or not all_quests:
        # New user or no quests — return sorted by deadline
        sorted_quests = sorted(all_quests, key=_deadline_sort_key)
        for q in sorted_quests:
            q['recommendation_reason'] = "Most urgent quest right now"
        return sorted_quests

    user_xp = user_profile.get('xp', 0)
    user_rank = user_profile.get('rank', 'Newcomer')
    user_badges = user_profile.get('badges', [])
    user_state = user_profile.get('details', {}).get('state', '').lower() if isinstance(user_profile.get('details'), dict) else ''
    completed_ids = user_profile.get('quests_completed', [])
    completed_types = user_profile.get('quest_types_completed', [])
    
    # Determine preferred quest types from history
    type_counts = {}
    for t in completed_types:
        type_counts[t] = type_counts.get(t, 0) + 1
    preferred_types = set(type_counts.keys())

    # Recent completions (this week) for penalty
    recent_types = set()
    recent_completions = user_profile.get('recent_quest_types', [])
    if recent_completions:
        recent_types = set(recent_completions)

    now = datetime.now(timezone.utc)
    scored_quests = []

    for quest in all_quests:
        score = 100
        reasons = []

        quest_type = quest.get('quest_type', '').lower()
        
        # +30 if matches past quest types
        if quest_type in preferred_types:
            score += 30
            reasons.append(f"Matches your interest in {quest_type} quests")

        # +20 if deadline within 7 days
        deadline_str = quest.get('deadline', '')
        if deadline_str:
            try:
                if isinstance(deadline_str, str):
                    deadline = datetime.strptime(deadline_str, "%Y-%m-%d").replace(tzinfo=timezone.utc)
                else:
                    deadline = deadline_str.replace(tzinfo=timezone.utc) if deadline_str.tzinfo is None else deadline_str
                days_left = (deadline - now).days
                if 0 <= days_left <= 7:
                    score += 20
                    reasons.append("Deadline is approaching soon")
                elif days_left < 0:
                    score -= 50  # Expired
            except (ValueError, AttributeError):
                pass

        # +15 if same state
        quest_state = quest.get('org_state', '').lower()
        if user_state and quest_state and user_state == quest_state:
            score += 15
            reasons.append("From an organisation in your area")

        # -10 if similar type completed this week
        if quest_type in recent_types:
            score -= 10

        # Rank-based adjustments
        quest_xp = quest.get('xp', 100)
        if user_rank in ('Newcomer', 'Helper'):
            # Prefer easier quests
            if quest_xp <= 150:
                score += 10
                if not reasons:
                    reasons.append("Great starter quest for you")
            elif quest_xp >= 300:
                score -= 10
        elif user_rank in ('Guardian Angel', 'Champion', 'Legend'):
            # Prefer harder quests
            if quest_xp >= 250:
                score += 15
                reasons.append("A challenging quest worthy of your rank")
            elif quest_xp <= 100:
                score -= 5

        # Badge-based boosts
        badge_names_lower = [b.lower() if isinstance(b, str) else '' for b in user_badges]
        if 'book donor' in badge_names_lower and 'book' in quest.get('items_needed', '').lower():
            score += 20
            reasons.append("Matches your Book Donor badge")
        if 'food hero' in badge_names_lower and 'food' in quest.get('items_needed', '').lower():
            score += 20
            reasons.append("Matches your Food Hero badge")

        # Pick best reason
        reason = reasons[0] if reasons else "Recommended for you"

        scored_quests.append({
            **quest,
            '_score': score,
            'recommendation_reason': reason
        })

    # Sort by score descending
    scored_quests.sort(key=lambda q: q['_score'], reverse=True)

    # Remove internal score from output
    for q in scored_quests:
        q.pop('_score', None)

    return scored_quests


def _deadline_sort_key(quest):
    """Sort key: quests with nearest deadline first."""
    deadline_str = quest.get('deadline', '')
    if not deadline_str:
        return datetime.max.replace(tzinfo=timezone.utc)
    try:
        if isinstance(deadline_str, str):
            return datetime.strptime(deadline_str, "%Y-%m-%d").replace(tzinfo=timezone.utc)
        return deadline_str
    except (ValueError, AttributeError):
        return datetime.max.replace(tzinfo=timezone.utc)
