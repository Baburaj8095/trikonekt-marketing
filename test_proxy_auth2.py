import psycopg2
try:
    conn = psycopg2.connect("postgres://trikonekt_admin:Baburajnk19@trikonekt-db-proxy.proxy-crm64c24gey6.ap-south-1.rds.amazonaws.com:5432/trikonekt_staging?sslmode=require", connect_timeout=5)
    cur = conn.cursor()
    cur.execute("SELECT current_database(), current_user, version();")
    print("SUCCESS_PROXY_AUTHENTICATED:", cur.fetchone())
except Exception as e:
    print("ERROR_PROXY:", e)
