import sqlite3
from datetime import datetime, timedelta

DB_FILE = "weather.db"

def init_db():
    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS weather_data (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp DATETIME UNIQUE,
            temperature_f REAL,
            humidity REAL,
            wind_speed_mph REAL,
            rainfall_in REAL
        )
    ''')
    conn.commit()
    conn.close()

def get_db_connection():
    conn = sqlite3.connect(DB_FILE)
    conn.row_factory = sqlite3.Row
    return conn

def get_latest_reading():
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('''
        SELECT * FROM weather_data 
        ORDER BY timestamp DESC LIMIT 1
    ''')
    row = cursor.fetchone()
    conn.close()
    return dict(row) if row else None

def insert_reading(temp_f, humidity, wind_mph, rainfall_in):
    conn = get_db_connection()
    cursor = conn.cursor()
    timestamp = datetime.now().isoformat()
    try:
        cursor.execute('''
            INSERT INTO weather_data (timestamp, temperature_f, humidity, wind_speed_mph, rainfall_in)
            VALUES (?, ?, ?, ?, ?)
        ''', (timestamp, temp_f, humidity, wind_mph, rainfall_in))
        conn.commit()
    except sqlite3.IntegrityError:
        pass # Ignore if exact timestamp exists
    finally:
        conn.close()

def get_historical_data(start_time: str, end_time: str):
    """
    Returns data between start_time and end_time.
    Times should be ISO format strings.
    """
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('''
        SELECT * FROM weather_data 
        WHERE timestamp >= ? AND timestamp <= ?
        ORDER BY timestamp ASC
    ''', (start_time, end_time))
    rows = cursor.fetchall()
    conn.close()
    return [dict(row) for row in rows]
