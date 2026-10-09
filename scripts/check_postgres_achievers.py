import os
import psycopg2

db_url = "postgres://trikonekt_admin:Baburajnk19@trikonekt-prod-postgres.crm64c24gey6.ap-south-1.rds.amazonaws.com:5432/trikonekt_staging?sslmode=require"

conn = psycopg2.connect(db_url)
cursor = conn.cursor()

cursor.execute("SELECT table_name FROM information_schema.tables WHERE table_name LIKE '%achiever%' OR table_name LIKE '%top%';")
print("Tables in PostgreSQL:", cursor.fetchall())

cursor.execute("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'business_teamconsumertopachiever';")
cols = cursor.fetchall()
print("business_teamconsumertopachiever columns:", cols)

cursor.execute("SELECT id, name, achieved, is_active, photo FROM business_teamconsumertopachiever;")
rows = cursor.fetchall()
print(f"Total rows in business_teamconsumertopachiever: {len(rows)}")
for r in rows:
    print(r)
