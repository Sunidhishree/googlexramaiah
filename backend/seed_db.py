import os
import random
from pymongo import MongoClient
from datetime import datetime
from dotenv import load_dotenv

load_dotenv()

mongo_uri = os.getenv('MONGODB_URI')
db_name = os.getenv('MONGODB_DB', 'Googlexramaiah')

client = MongoClient(mongo_uri)
db = client[db_name]

# Clear existing data for demo purposes (optional, but good for clean state)
# db.orphanages.delete_many({})
# db.quests.delete_many({})
# db.stories.delete_many({})

org_id = "org_demo_1"
if not db.orphanages.find_one({"_id": org_id}):
    db.orphanages.insert_one({
        "_id": org_id,
        "name": "Hope Children's Home",
        "description": "A safe haven for children in need.",
        "address": "123 Hope Street, Bengaluru",
        "capacity": 50,
        "current_strength": 42,
        "phone": "9876543210",
        "created_at": datetime.utcnow()
    })

if db.quests.count_documents({}) == 0:
    db.quests.insert_many([
        {
            "_id": "quest_1",
            "orphanage_id": org_id,
            "title": "Weekend Teaching",
            "description": "Help children with Mathematics and Science on Saturday afternoons.",
            "quest_type": "volunteer",
            "xp": 250,
            "status": "active",
            "deadline": "2026-06-01",
            "spots": 5,
            "created_at": datetime.utcnow()
        },
        {
            "_id": "quest_2",
            "orphanage_id": org_id,
            "title": "Grocery Donation",
            "description": "We need rice, pulses, and oil for the next month.",
            "quest_type": "donate",
            "xp": 150,
            "status": "active",
            "deadline": "2026-05-20",
            "items_needed": "Rice (50kg), Dal (10kg)",
            "created_at": datetime.utcnow()
        }
    ])

if db.stories.count_documents({}) == 0:
    db.stories.insert_many([
        {
            "_id": "story_1",
            "orphanage_id": org_id,
            "caption": "A wonderful day at the park with our little ones!",
            "tags": "FunDay",
            "likes": 12,
            "photo": "https://images.unsplash.com/photo-1488521787991-ed7bbaae773c?ixlib=rb-1.2.1&auto=format&fit=crop&w=500&q=60",
            "created_at": datetime.utcnow()
        }
    ])

print("Database seeded successfully with demo data.")
