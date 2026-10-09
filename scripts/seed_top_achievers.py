import psycopg2

db_url = "postgres://trikonekt_admin:Baburajnk19@trikonekt-prod-postgres.crm64c24gey6.ap-south-1.rds.amazonaws.com:5432/trikonekt_staging?sslmode=require"

conn = psycopg2.connect(db_url)
cursor = conn.cursor()

# Insert the top performers
achievers_data = [
    (1, "Rakesh Kumar", "Diamond", "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80", 1, True),
    (2, "Priya Sharma", "Platinum", "https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=400&q=80", 2, True),
    (3, "Amit Singh", "Gold", "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=400&q=80", 3, True),
    (4, "Sunita Devi", "Gold", "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=400&q=80", 4, True),
    (5, "Vikram Das", "Silver", "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=400&q=80", 5, True),
]

insert_sql = """
INSERT INTO business_teamconsumertopachiever (id, name, achieved, photo, sort_order, is_active, created_at, updated_at)
VALUES (%s, %s, %s, %s, %s, %s, NOW(), NOW())
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    achieved = EXCLUDED.achieved,
    photo = EXCLUDED.photo,
    sort_order = EXCLUDED.sort_order,
    is_active = EXCLUDED.is_active,
    updated_at = NOW();
"""

for row in achievers_data:
    cursor.execute(insert_sql, row)

conn.commit()

# Ensure auto-increment sequence is synced
cursor.execute("SELECT setval(pg_get_serial_sequence('business_teamconsumertopachiever', 'id'), coalesce(max(id), 1)) FROM business_teamconsumertopachiever;")
conn.commit()

cursor.execute("SELECT id, name, achieved, photo, sort_order, is_active FROM business_teamconsumertopachiever ORDER BY sort_order;")
results = cursor.fetchall()
print(f"Successfully seeded {len(results)} top achievers:")
for r in results:
    print(r)

cursor.close()
conn.close()
