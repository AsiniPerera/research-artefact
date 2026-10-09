"""Load the CSV files into Supabase.

Put this file in the salon_db folder (next to the data folder) and run:
    set DATABASE_URL=postgresql://postgres:PASSWORD@db.XXXX.supabase.co:5432/postgres
    python 03_load_data.py
Or without DATABASE_URL it will ask for the password interactively.
"""
import os, sys, getpass, io, csv, psycopg2

HOST = 'aws-0-ap-southeast-1.pooler.supabase.com'
PORT = 5432
USER = 'postgres.wxmyoommtwxsdashxzki'
DBNAME = 'postgres'

DATA = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'data')
TABLES = [  # load order follows the foreign keys
    ('raw.provider', 'provider.csv'),
    ('raw.review', 'review.csv'),
    ('raw.owner_reply', 'owner_reply.csv'),
    ('extract.review_assessment', 'review_assessment.csv'),
    ('extract.evidence_item', 'evidence_item.csv'),
    ('extract.reply_assessment', 'reply_assessment.csv'),
]

BATCH_SIZE = 5000  # rows per COPY batch — avoids Supabase statement timeout

if not os.path.isdir(DATA):
    sys.exit(f'Cannot find the data folder at {DATA}. Put this file inside the salon_db folder.')

try:
    url = os.environ.get('DATABASE_URL')
    if url:
        print('Connecting via DATABASE_URL ...')
        conn = psycopg2.connect(url)
    else:
        password = getpass.getpass('Supabase database password (typing is hidden): ').strip()
        if not password:
            sys.exit('No password entered.')
        conn = psycopg2.connect(host=HOST, port=PORT, user=USER, password=password, dbname=DBNAME, sslmode='require')
except psycopg2.OperationalError as e:
    msg = str(e)
    if 'password authentication failed' in msg:
        sys.exit('Supabase rejected the password. Reset it in Supabase (Connect > Reset database password), '
                 'wait one minute, then run this again and type the new password.')
    sys.exit('Could not connect:\n' + msg)

# Raise the statement timeout for this session (5 minutes)
conn.autocommit = False
with conn.cursor() as cur:
    cur.execute("SET statement_timeout = '300s'")
conn.commit()

def copy_in_batches(cur, table, filepath):
    """COPY rows in batches to stay within Supabase statement timeout."""
    with open(filepath, encoding='utf-8', newline='') as f:
        reader = csv.reader(f)
        header = next(reader)
        cols = ','.join(header)
        total = 0
        batch = []
        for row in reader:
            batch.append(row)
            if len(batch) >= BATCH_SIZE:
                buf = io.StringIO()
                writer = csv.writer(buf)
                writer.writerow(header)
                writer.writerows(batch)
                buf.seek(0)
                cur.copy_expert(f'copy {table} ({cols}) from stdin with (format csv, header true)', buf)
                conn.commit()
                total += len(batch)
                print(f'  {table}: {total:,} rows loaded ...', end='\r')
                batch = []
        if batch:
            buf = io.StringIO()
            writer = csv.writer(buf)
            writer.writerow(header)
            writer.writerows(batch)
            buf.seek(0)
            cur.copy_expert(f'copy {table} ({cols}) from stdin with (format csv, header true)', buf)
            conn.commit()
            total += len(batch)
    return total

try:
    with conn.cursor() as cur:
        # Truncate all tables first
        cur.execute('truncate ' + ', '.join(t for t, _ in reversed(TABLES)) + ' restart identity cascade')
        conn.commit()
        print('Tables truncated.')

        for table, fname in TABLES:
            filepath = os.path.join(DATA, fname)
            total = copy_in_batches(cur, table, filepath)
            print(f'{table:32s} {total:>7,} rows')

    print('Done. All tables loaded successfully.')
finally:
    conn.close()