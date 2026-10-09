import sqlite3
import psycopg2

db_path = '/srv/trikonekt/staging/backend/db.sqlite3'
conn = sqlite3.connect(db_path)
cursor = conn.cursor()

# Create table business_teamconsumerwishingbanner if not exists
create_table_sql = """
CREATE TABLE IF NOT EXISTS "business_teamconsumerwishingbanner" (
    "id" integer NOT NULL PRIMARY KEY AUTOINCREMENT,
    "title" varchar(180) NOT NULL,
    "image" varchar(500) NULL,
    "is_active" bool NOT NULL,
    "created_at" datetime NOT NULL,
    "updated_at" datetime NOT NULL
);
"""
cursor.execute(create_table_sql)
cursor.execute("CREATE INDEX IF NOT EXISTS business_teamconsumerwishingbanner_is_active ON business_teamconsumerwishingbanner (is_active);")

# Clear and insert default wishing banners
cursor.execute("DELETE FROM business_teamconsumerwishingbanner;")

banners = [
    ("Sacred Journeys & Dream Holidays Across India", "https://images.unsplash.com/photo-1602216056096-3b40cc0c9944?auto=format&fit=crop&w=1600&q=80", 1, "2026-05-01 10:00:00", "2026-05-01 10:00:00"),
    ("Happy Gowri Ganesha & Divine Blessings", "https://images.unsplash.com/photo-1567157577867-05ccb1388e66?auto=format&fit=crop&w=1600&q=80", 1, "2026-05-01 10:00:00", "2026-05-01 10:00:00"),
    ("Connect, Share & Grow Together", "https://images.unsplash.com/photo-1511632765486-a01980e01a18?auto=format&fit=crop&w=1600&q=80", 1, "2026-05-01 10:00:00", "2026-05-01 10:00:00"),
]

cursor.executemany("""
INSERT INTO business_teamconsumerwishingbanner (title, image, is_active, created_at, updated_at)
VALUES (?, ?, ?, ?, ?);
""", banners)

conn.commit()

cursor.execute("SELECT id, title, image, is_active FROM business_teamconsumerwishingbanner;")
rows = cursor.fetchall()
print(f"SUCCESS: Seeded {len(rows)} banners in sqlite:")
for r in rows:
    print(r)
conn.close()

# Also seed into Postgres for consistency
db_url = 'postgres://trikonekt_admin:Baburajnk19@trikonekt-prod-postgres.crm64c24gey6.ap-south-1.rds.amazonaws.com:5432/trikonekt_staging?sslmode=require'
try:
    p_conn = psycopg2.connect(db_url)
    p_cur = p_conn.cursor()
    p_insert = """
    INSERT INTO business_teamconsumerwishingbanner (id, title, image, is_active, created_at, updated_at)
    VALUES (%s, %s, %s, %s, NOW(), NOW())
    ON CONFLICT (id) DO UPDATE SET
        title = EXCLUDED.title,
        image = EXCLUDED.image,
        is_active = EXCLUDED.is_active,
        updated_at = NOW();
    """
    for idx, (title, img, is_active, _, _) in enumerate(banners, start=1):
        p_cur.execute(p_insert, (idx, title, img, True))
    p_conn.commit()
    p_cur.execute("SELECT setval(pg_get_serial_sequence('business_teamconsumerwishingbanner', 'id'), coalesce(max(id), 1)) FROM business_teamconsumerwishingbanner;")
    p_conn.commit()
    p_cur.close()
    p_conn.close()
    print("SUCCESS: Seeded in Postgres too!")
except Exception as e:
    print("Postgres sync notice:", e)
