import sqlite3
from datetime import datetime, timedelta
import random
import math
from database import init_db, DB_FILE

def seed_database():
    init_db()
    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()
    
    # Try fetching Pune current weather temp to align the seeded data!
    base_temp = 85.0
    try:
        import urllib.request
        import json
        url = "https://api.open-meteo.com/v1/forecast?latitude=18.5204&longitude=73.8567&current=temperature_2m&temperature_unit=fahrenheit"
        req = urllib.request.Request(url, headers={'User-Agent': 'SeedScript'})
        with urllib.request.urlopen(req, timeout=5) as response:
            data = json.loads(response.read().decode())
            if "current" in data and "temperature_2m" in data["current"]:
                base_temp = data["current"]["temperature_2m"]
    except Exception as e:
        print("Could not fetch current pune weather for base temp. Using 85.0")

    # We will generate data for the last 48 hours for every 30 minutes
    now = datetime.now()
    
    # Adjust base_temp so that the current simulated temp is exactly the actual base_temp
    current_hour_temp_cycle = -10 * math.cos(math.pi * now.hour / 12 - math.pi * 3 / 12)
    adjusted_base_temp = base_temp - current_hour_temp_cycle
    
    for i in range(96, -1, -1):
        dt = now - timedelta(minutes=30 * i)
        
        # Create a diurnal temperature cycle (cool at night, warm in day)
        hour = dt.hour
        # Simplistic diurnal curve based on hour (peaks at 15:00/3pm)
        temp_cycle = -10 * math.cos(math.pi * hour / 12 - math.pi * 3 / 12)  # diurnal swing
        
        # Add some random noise
        temp_f = adjusted_base_temp + temp_cycle + random.uniform(-1, 1)
        
        # Humidity generally inverse to temp
        humidity = max(30.0, min(95.0, 100 - (temp_cycle * 2) + random.uniform(-5, 5)))
        
        wind_speed_mph = max(0.0, random.uniform(2, 10) + (temp_cycle / 3))
        
        # Slight chance of rain
        rainfall_in = 0.0
        if random.random() > 0.85:
            rainfall_in = random.uniform(0.01, 0.2)
            
        try:
            cursor.execute('''
                INSERT INTO weather_data (timestamp, temperature_f, humidity, wind_speed_mph, rainfall_in)
                VALUES (?, ?, ?, ?, ?)
            ''', (dt.isoformat(), round(temp_f, 1), round(humidity, 1), round(wind_speed_mph, 1), round(rainfall_in, 2)))
        except sqlite3.IntegrityError:
            pass # Ignore duplicate timestamps
            
    conn.commit()
    conn.close()
    print("Database seeded with 48 hours of simulated weather data.")

if __name__ == "__main__":
    seed_database()
