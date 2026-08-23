def calculate_heat_index(temp_f: float, humidity: float) -> float:
    """
    Calculate the Heat Index using the Rothfusz regression.
    temp_f: Temperature in Fahrenheit
    humidity: Relative humidity in %
    """
    if temp_f < 80.0:
        # Simple formula for temperatures below 80F
        hi = 0.5 * (temp_f + 61.0 + ((temp_f - 68.0) * 1.2) + (humidity * 0.094))
        return round(hi, 2)
        
    c1 = -42.379
    c2 = 2.04901523
    c3 = 10.14333127
    c4 = -0.22475541
    c5 = -6.83783e-3
    c6 = -5.481717e-2
    c7 = 1.22874e-3
    c8 = 8.5282e-4
    c9 = -1.99e-6

    hi = (c1 + (c2 * temp_f) + (c3 * humidity) + (c4 * temp_f * humidity) +
          (c5 * temp_f**2) + (c6 * humidity**2) + (c7 * temp_f**2 * humidity) +
          (c8 * temp_f * humidity**2) + (c9 * temp_f**2 * humidity**2))

    # Adjustments based on specific humidity and temp ranges
    if humidity < 13 and 80 <= temp_f <= 112:
        adjustment = ((13 - humidity) / 4) * ((17 - abs(temp_f - 95.)) / 17) ** 0.5
        hi -= adjustment
    elif humidity > 85 and 80 <= temp_f <= 87:
        adjustment = ((humidity - 85) / 10) * ((87 - temp_f) / 5)
        hi += adjustment

    return round(hi, 2)

def calculate_wind_chill(temp_f: float, wind_speed_mph: float) -> float:
    """
    Calculate wind chill in Fahrenheit.
    Only valid for temperatures at or below 50F and wind speeds above 3mph.
    """
    if temp_f > 50 or wind_speed_mph <= 3:
        return temp_f
    
    wc = 35.74 + 0.6215 * temp_f - 35.75 * (wind_speed_mph ** 0.16) + 0.4275 * temp_f * (wind_speed_mph ** 0.16)
    return round(wc, 2)

def get_health_activity_index(temp_f: float, humidity: float, wind_speed_mph: float) -> dict:
    """
    Provides a value-added dynamic health index based on heat index or wind chill.
    """
    feels_like = temp_f
    if temp_f >= 80:
        feels_like = calculate_heat_index(temp_f, humidity)
    elif temp_f <= 50:
        feels_like = calculate_wind_chill(temp_f, wind_speed_mph)
        
    activity_level = "Great for outdoor activities."
    risk_level = "Low Risk"
    color = "#4CAF50" # Green
    
    if feels_like >= 103:
        risk_level = "Extreme Danger"
        activity_level = "Avoid outdoor activities. Heat stroke highly likely."
        color = "#F44336" # Red
    elif feels_like >= 90:
        risk_level = "High Risk"
        activity_level = "Exercise caution. Stay hydrated and limit sun exposure."
        color = "#FF9800" # Orange
    elif feels_like <= 32:
        risk_level = "Freezing"
        activity_level = "Dress warmly. Risk of frostbite if exposed for long periods."
        color = "#2196F3" # Blue
    elif feels_like >= 80:
        risk_level = "Moderate"
        activity_level = "Warm outside. Drink plenty of water."
        color = "#FFC107" # Yellow
        
    return {
        "status": risk_level,
        "message": activity_level,
        "feels_like": round(feels_like, 1),
        "color": color
    }
