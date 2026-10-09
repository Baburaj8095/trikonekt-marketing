import sqlite3

conn = sqlite3.connect('/srv/trikonekt/staging/backend/db.sqlite3')
cursor = conn.cursor()

tables = cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND (name LIKE '%achiever%' OR name LIKE '%top%')").fetchall()
print("Matching tables:", tables)

columns = cursor.execute("SELECT sql FROM sqlite_master WHERE type='table' AND name='business_teamconsumertopachiever'").fetchall()
print("business_teamconsumertopachiever sql:", columns)
