import os
from pymongo import MongoClient
from dotenv import load_dotenv

load_dotenv()

mongo_uri = os.getenv('MONGODB_URI')
db_name = os.getenv('MONGODB_DB', 'ummeed')

client = MongoClient(mongo_uri)
db = client[db_name]

collections = db.list_collection_names()
print(f"Collections: {collections}")

for col in collections:
    count = db[col].count_documents({})
    print(f"Collection {col}: {count} documents")
    if count > 0:
        print(f"Sample from {col}: {db[col].find_one()}")
