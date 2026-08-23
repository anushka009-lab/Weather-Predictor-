from flask import Flask, jsonify, request
import os
import threading
import time
import urllib.request
import json
from datetime import datetime, timedelta

from database import get_latest_reading, get_historical_data, init_db, insert_reading
from weather_math import get_health_activity_index

app = Flask(__name__, static_folder='static', static_url_path='/static')

# Ensure DB is initialized
init_db()

# Default location for backend polling matches geofence.js (Pune, India)
# You can change these to your actual coordinates!
POLL_LATITUDE = 18.5204
POLL_LONGITUDE = 73.8567

def weather_polling_thread():
    url = f"https://api.open-meteo.com/v1/forecast?latitude={POLL_LATITUDE}&longitude={POLL_LONGITUDE}&current=temperature_2m,relative_humidity_2m,wind_speed_10m,precipitation&temperature_unit=fahrenheit&wind_speed_unit=mph&precipitation_unit=inch"
    while True:
        try:
            req = urllib.request.Request(url, headers={'User-Agent': 'WirelessWeatherStation/1.0'})
            with urllib.request.urlopen(req) as response:
                data = json.loads(response.read().decode())
                current = data.get("current", {})
                if current:
                    temp_f = current.get("temperature_2m", 0)
                    humid = current.get("relative_humidity_2m", 0)
                    wind = current.get("wind_speed_10m", 0)
                    rain = current.get("precipitation", 0)
                    
                    insert_reading(temp_f, humid, wind, rain)
                    print(f"Logged live weather: {temp_f}°F, {humid}% hum")
        except Exception as e:
            print(f"Error fetching live weather: {e}")
            
        # Wait 15 minutes before checking again
        time.sleep(15 * 60)

@app.route("/api/current", methods=["GET"])
def get_current_weather():
    data = get_latest_reading()
    if not data:
        return jsonify({"error": "No weather data available"}), 404
    
    # Calculate derived health index
    health_metrics = get_health_activity_index(
        data['temperature_f'], 
        data['humidity'], 
        data['wind_speed_mph']
    )
    
    data['health_index'] = health_metrics
    return jsonify(data)

@app.route("/api/health_index", methods=["GET"])
def get_health_index_endpoint():
    try:
        temp_f = float(request.args.get('temp_f', 0))
        humidity = float(request.args.get('humidity', 0))
        wind_speed = float(request.args.get('wind_speed', 0))
    except ValueError:
        return jsonify({"error": "Invalid parameters"}), 400
        
    metrics = get_health_activity_index(temp_f, humidity, wind_speed)
    return jsonify(metrics)

@app.route("/api/historical", methods=["GET"])
def get_historical_endpoint():
    duration = request.args.get("duration", "today")
    now = datetime.now()
    
    if duration == "yesterday":
        start_time = (now - timedelta(days=2)).isoformat()
        end_time = (now - timedelta(days=1)).isoformat()
    else: # today
        start_time = (now - timedelta(days=1)).isoformat()
        end_time = now.isoformat()
        
    raw_data = get_historical_data(start_time, end_time)
    
    # Process data to ensure consistency and add derived metrics if needed
    for row in raw_data:
        metrics = get_health_activity_index(
            row['temperature_f'], 
            row['humidity'], 
            row['wind_speed_mph']
        )
        row['feels_like_f'] = metrics['feels_like']

    return jsonify({
        "duration": duration,
        "start": start_time,
        "end": end_time,
        "data": raw_data
    })

@app.route("/")
def serve_index():
    return app.send_static_file("index.html")

if __name__ == "__main__":
    # Check if static directory exists (for early testing before frontend is built)
    if not os.path.exists("static"):
        os.makedirs("static")
        
    # Start the background polling thread
    if os.environ.get('WERKZEUG_RUN_MAIN') == 'true':
        t = threading.Thread(target=weather_polling_thread, daemon=True)
        t.start()
        
    app.run(host="127.0.0.1", port=8000, debug=True)
