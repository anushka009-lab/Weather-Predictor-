// A simple Geofence simulation for a PWA

// Coordinates of the "Weather Station"
const STATION_LAT = 18.5204; // Pune, India
const STATION_LNG = 73.8567;
const GEOFENCE_RADIUS_KM = 5.0; // Alert if within 5 km

const geofenceBadge = document.getElementById('geofence-status');
let watchId = null;

document.addEventListener("DOMContentLoaded", () => {
    
    geofenceBadge.addEventListener("click", () => {
        if (!("geolocation" in navigator)) {
            alert("Geolocation is not supported by your browser");
            return;
        }

        if (watchId) {
            // Turn off
            navigator.geolocation.clearWatch(watchId);
            watchId = null;
            updateBadge(false, "Гео Alerts Off");
        } else {
            // Turn on
            updateBadge(true, "Locating...");
            watchId = navigator.geolocation.watchPosition(
                handlePositionUpdate, 
                handlePositionError,
                { enableHighAccuracy: true }
            );
        }
    });

    // PWA Service Worker Registration
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('/static/sw.js')
                .then(registration => {
                    console.log('SW registered: ', registration);
                })
                .catch(registrationError => {
                    console.log('SW registration failed: ', registrationError);
                });
        });
    }
});

function handlePositionUpdate(position) {
    const userLat = position.coords.latitude;
    const userLng = position.coords.longitude;
    
    const distanceKm = calculateDistance(userLat, userLng, STATION_LAT, STATION_LNG);
    
    if (distanceKm <= GEOFENCE_RADIUS_KM) {
        // User is inside the geofence
        updateBadge(true, "Near Station (Inside Geofence)");
        // Trigger a fake local notification if there is extreme weather
        checkWeatherAlerts();
    } else {
        updateBadge(true, "Outside Geofence");
    }
}

function handlePositionError(error) {
    console.warn('ERROR(' + error.code + '): ' + error.message);
    updateBadge(false, "Гео Alerts Off (Error)");
    if(watchId) {
        navigator.geolocation.clearWatch(watchId);
        watchId = null;
    }
}

function updateBadge(active, text) {
    geofenceBadge.innerHTML = `
        <span class="dot ${active ? 'green' : 'red'}"></span> ${text}
        <span class="tooltiptext">Click to toggle location alerts</span>`;
}

function checkWeatherAlerts() {
    // Only alert if we have notification permission
    if (Notification.permission === "granted") {
        const healthStatus = document.getElementById('health-status').innerText;
        if (healthStatus === "Extreme Danger" || healthStatus === "High Risk") {
             new Notification("Weather Alert from Station!", {
                 body: "Extreme weather conditions near you. Please stay safe.",
                 icon: "/static/icon.png"
             });
        }
    } else if (Notification.permission !== "denied") {
        Notification.requestPermission();
    }
}

// Haversine formula
function calculateDistance(lat1, lon1, lat2, lon2) {
    var R = 6371; // km
    var dLat = toRad(lat2-lat1);
    var dLon = toRad(lon2-lon1);
    var lat1 = toRad(lat1);
    var lat2 = toRad(lat2);

    var a = Math.sin(dLat/2) * Math.sin(dLat/2) +
        Math.sin(dLon/2) * Math.sin(dLon/2) * Math.cos(lat1) * Math.cos(lat2); 
    var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
    var d = R * c;
    return d;
}

function toRad(Value) {
    return Value * Math.PI / 180;
}
