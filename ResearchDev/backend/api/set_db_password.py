"""Ask for the Supabase database password, test it, and save DATABASE_URL to backend/api/.env.

Run from anywhere:
    python backend/api/set_db_password.py
Typing is hidden. The password is only written to .env (git-ignored), never printed.
"""
import getpass, os, sys
from urllib.parse import quote
import psycopg2

HOST = "db.wxmyoommtwxsdashxzki.supabase.co"   # direct connection (needs IPv6)
POOLER_HOST = "aws-0-ap-southeast-1.pooler.supabase.com"   # session pooler (IPv4 and IPv6)
REF = "wxmyoommtwxsdashxzki"
ENV = os.path.join(os.path.dirname(os.path.abspath(__file__)), ".env")

password = getpass.getpass("Supabase database password (typing is hidden): ").strip()
if not password:
    sys.exit("No password entered.")
pw = quote(password, safe="")

candidates = [
    ("direct", f"postgresql://postgres:{pw}@{HOST}:5432/postgres?sslmode=require"),
    ("session pooler", f"postgresql://postgres.{REF}:{pw}@{POOLER_HOST}:5432/postgres?sslmode=require"),
]

for name, url in candidates:
    try:
        psycopg2.connect(url, connect_timeout=10).close()
    except psycopg2.OperationalError as e:
        msg = str(e)
        if "password authentication failed" in msg:
            sys.exit("Supabase rejected the password. Reset it in Supabase "
                     "(Project Settings > Database > Reset database password), wait a minute, then run this again.")
        print(f"Could not connect via the {name} ({msg.strip().splitlines()[0][:120]}); trying the next option...")
        continue
    with open(ENV, "w", encoding="utf-8") as f:
        f.write("# Supabase connection. Secret: never commit this file.\n")
        f.write(f"DATABASE_URL={url}\n")
    print(f"Connected via the {name}. Saved to {ENV}")
    break
else:
    sys.exit("Could not connect with either address. Check your internet connection and try again.")
