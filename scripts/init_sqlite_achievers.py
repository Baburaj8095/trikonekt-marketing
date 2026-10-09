import sqlite3

db_path = '/srv/trikonekt/staging/backend/db.sqlite3'
conn = sqlite3.connect(db_path)
cursor = conn.cursor()

# Create table business_teamconsumertopachiever if not exists
create_table_sql = """
CREATE TABLE IF NOT EXISTS "business_teamconsumertopachiever" (
    "id" integer NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" varchar(180) NOT NULL,
    "achieved" varchar(220) NOT NULL,
    "sort_order" integer NOT NULL,
    "is_active" bool NOT NULL,
    "photo" varchar(500) NULL,
    "created_at" datetime NOT NULL,
    "updated_at" datetime NOT NULL
);
"""
cursor.execute(create_table_sql)

# Create index on sort_order and is_active
cursor.execute("CREATE INDEX IF NOT EXISTS business_teamconsumertopachiever_sort_order ON business_teamconsumertopachiever (sort_order);")
cursor.execute("CREATE INDEX IF NOT EXISTS business_teamconsumertopachiever_is_active ON business_teamconsumertopachiever (is_active);")

# Clear and insert top performers
cursor.execute("DELETE FROM business_teamconsumertopachiever;")

achievers = [
    ("Rakesh Kumar", "Diamond", 1, 1, "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80", "2026-05-01 10:00:00", "2026-05-01 10:00:00"),
    ("Priya Sharma", "Platinum", 2, 1, "https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=400&q=80", "2026-05-01 10:00:00", "2026-05-01 10:00:00"),
    ("Amit Singh", "Gold", 3, 1, "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=400&q=80", "2026-05-01 10:00:00", "2026-05-01 10:00:00"),
    ("Sunita Devi", "Gold", 4, 1, "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=400&q=80", "2026-05-01 10:00:00", "2026-05-01 10:00:00"),
    ("Vikram Das", "Silver", 5, 1, "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=400&q=80", "2026-05-01 10:00:00", "2026-05-01 10:00:00"),
]

cursor.executemany("""
INSERT INTO business_teamconsumertopachiever (name, achieved, sort_order, is_active, photo, created_at, updated_at)
VALUES (?, ?, ?, ?, ?, ?, ?);
""", achievers)

conn.commit()

# Verify
cursor.execute("SELECT id, name, achieved, photo, sort_order, is_active FROM business_teamconsumertopachiever ORDER BY sort_order;")
rows = cursor.fetchall()
print(f"SUCCESS: Seeded {len(rows)} records in db.sqlite3:")
for r in rows:
    print(r)

conn.close()
