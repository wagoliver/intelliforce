import json
import subprocess
import sys
import argparse
from datetime import datetime, timezone, timedelta
from pymongo import MongoClient
from bson import ObjectId

VAULT = "/opencode-runtime/.opencode/skills/intelliforce-vault/scripts/vault.py"

class MongoEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, ObjectId):
            return str(obj)
        if isinstance(obj, datetime):
            return obj.strftime("%Y-%m-%d %H:%M:%S")
        return super().default(obj)

def get_conn_str():
    result = subprocess.run(
        ["python", VAULT, "get", "mongodb", "--skill", "analisa-dba-mongo", "--field", "strconn"],
        capture_output=True, text=True, timeout=20
    )
    if result.returncode != 0:
        print(result.stderr.strip(), file=sys.stderr)
        sys.exit(1)
    return result.stdout.strip()

def to_gmt3(dt):
    if dt is None:
        return None
    if isinstance(dt, str):
        dt = datetime.fromisoformat(dt)
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone(timedelta(hours=-3))).strftime("%Y-%m-%d %H:%M:%S")

def main():
    parser = argparse.ArgumentParser(description="Consulta MongoDB xone-saas.company_parameters")
    parser.add_argument("--filter", type=str, default="{}", help="JSON filter")
    parser.add_argument("--sort", type=str, default="created_at:-1", help="sort_field:direction")
    parser.add_argument("--limit", type=int, default=10, help="Max documents")
    parser.add_argument("--fields", type=str, default="", help="Comma-separated fields to project")
    args = parser.parse_args()

    try:
        filter_dict = json.loads(args.filter)
    except json.JSONDecodeError:
        print("Invalid JSON filter", file=sys.stderr)
        sys.exit(1)

    try:
        sort_field, sort_dir = args.sort.split(":")
        sort_dir = 1 if sort_dir == "1" else -1
    except ValueError:
        print("Invalid sort format. Use field:direction (1 or -1)", file=sys.stderr)
        sys.exit(1)

    projection = None
    if args.fields:
        projection = {f: 1 for f in args.fields.split(",")}
        projection["_id"] = 0

    conn_str = get_conn_str()
    client = MongoClient(conn_str, serverSelectionTimeoutMS=10000)
    db = client["xone-saas"]
    collection = db["company_parameters"]

    try:
        cursor = collection.find(filter_dict, projection).sort(sort_field, sort_dir).limit(args.limit)
        results = []
        for doc in cursor:
            if "created_at" in doc:
                doc["created_at"] = to_gmt3(doc["created_at"])
            results.append(doc)
        print(json.dumps(results, indent=2, ensure_ascii=False, cls=MongoEncoder))
    except Exception as e:
        print(f"Query error: {e}", file=sys.stderr)
        sys.exit(1)
    finally:
        client.close()

if __name__ == "__main__":
    main()
