from database import engine

try:
    conn = engine.connect()

    print("Connected to Supabase!")

    conn.close()

except Exception as e:
    print(e)