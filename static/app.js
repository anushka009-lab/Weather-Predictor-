document.addEventListener("DOMContentLoaded", () => {
    // DOM Elements
    const elements = {
        temp: document.getElementById('current-temp'),
        hum: document.getElementById('current-hum'),
        wind: document.getElementById('current-wind'),
        rain: document.getElementById('current-rain'),
        healthCard: document.getElementById('health-card'),
        healthStatus: document.getElementById('health-status'),
        feelsLike: document.getElementById('feels-like-temp'),
        healthMessage: document.getElementById('health-message'),
        compareToggle: document.getElementById('compare-yesterday-toggle'),
        weatherEmoji: document.getElementById('weather-emoji'),
        searchBtn: document.getElementById('search-btn'),
        searchInput: document.getElementById('country-search'),
        searchResLoc: document.getElementById('result-location'),
        searchResTemp: document.getElementById('result-temp'),
        searchResTime: document.getElementById('result-time'),
        searchResCond: document.getElementById('result-cond'),
        searchResults: document.getElementById('search-results'),
        searchEmoji: document.getElementById('search-emoji')
    };

    function fToC(f) {
        return Math.round((f - 32) * 5 / 9);
    }

    let weatherChart = null;
    let todayDataCache = [];
    let yesterdayDataCache = [];
    let currentChartLocation = "Local Station";
    
    // Initialize App
    async function init() {
        await fetchCurrentWeather();
        await fetchHistoricalData("today");
        setupChart();
        
        // Setup toggle listener
        elements.compareToggle.addEventListener("change", async (e) => {
            if (e.target.checked) {
                await fetchHistoricalData("yesterday");
            }
            updateChart();
        });
        
        // Search listener
        elements.searchBtn.addEventListener('click', async () => {
            const query = elements.searchInput.value.trim();
            if (!query) return;
            
            elements.searchBtn.textContent = '...';
            try {
                const geoRes = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=1&language=en&format=json`);
                if (!geoRes.ok) {
                    throw new Error(`API Error: ${geoRes.status}`);
                }
                const geoData = await geoRes.json();
                
                if (!geoData.results || geoData.results.length === 0) {
                    alert(`Location "${query}" not found! Try searching for a major nearby city or check your spelling.`);
                    elements.searchBtn.textContent = 'Scan';
                    return;
                }
                
                const loc = geoData.results[0];
                const weatherRes = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${loc.latitude}&longitude=${loc.longitude}&current=temperature_2m,weather_code,wind_speed_10m,relative_humidity_2m,precipitation,is_day&hourly=temperature_2m&past_days=1&forecast_days=1&timezone=auto&temperature_unit=fahrenheit&wind_speed_unit=mph&precipitation_unit=inch`);
                const weatherData = await weatherRes.json();
                const current = weatherData.current;
                
                elements.searchResLoc.textContent = `${loc.name}, ${loc.country || ''}`;
                
                const tempF = current.temperature_2m;
                const windMph = current.wind_speed_10m;
                const rainIn = current.precipitation || 0;
                const humidity = current.relative_humidity_2m || 0;

                elements.searchResTemp.textContent = fToC(tempF);
                
                const localTime = new Date(current.time);
                elements.searchResTime.textContent = localTime.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
                
                function wmoToConditionInfo(code, windSpeed, isDay) {
                    if (windSpeed > 100) return { text: "Tsunami/Hurricane", emoji: "🌊" };
                    if (windSpeed > 40) return { text: "Windy", emoji: "💨" };
                    
                    if (code === 0) return { text: isDay ? "Sunny" : "Clear Night", emoji: isDay ? "☀️" : "🌙" };
                    if (code === 1 || code === 2) return { text: isDay ? "Partly Cloudy" : "Cloudy Night", emoji: isDay ? "⛅" : "🌙☁️" };
                    if (code === 3) return { text: "Cloudy", emoji: "☁️" };
                    if (code === 45 || code === 48) return { text: "Fog", emoji: "🌫️" };
                    if (code >= 51 && code <= 67) return { text: "Rainy", emoji: "🌧️" };
                    if (code >= 71 && code <= 77) return { text: "Snowy", emoji: "❄️" };
                    if (code >= 80 && code <= 82) return { text: "Showers", emoji: "🌧️" };
                    if (code >= 85 && code <= 86) return { text: "Snowy", emoji: "❄️" };
                    if (code >= 95) return { text: "Thunderstorm", emoji: "⛈️" };
                    return { text: isDay ? "Sunny" : "Clear Night", emoji: isDay ? "☀️" : "🌙" };
                }
                
                const weatherInfo = wmoToConditionInfo(current.weather_code, current.wind_speed_10m, current.is_day);
                
                elements.searchResCond.textContent = `${weatherInfo.text} ${weatherInfo.emoji}`;
                elements.searchResults.style.display = "block";
                
                // Update the big moving emoji on the left to match searched location!
                elements.weatherEmoji.textContent = weatherInfo.emoji;
                // Add the big moving emoji to the search results side as well!
                elements.searchEmoji.textContent = weatherInfo.emoji;

                // Sync main dashboard stats with searched location
                elements.temp.textContent = fToC(tempF);
                elements.hum.textContent = humidity + '%';
                elements.wind.textContent = windMph + ' mph';
                elements.rain.textContent = rainIn + ' in';

                try {
                    const healthRes = await fetch(`/api/health_index?temp_f=${tempF}&humidity=${humidity}&wind_speed=${windMph}`);
                    const healthData = await healthRes.json();
                    elements.healthStatus.textContent = healthData.status;
                    elements.feelsLike.textContent = fToC(healthData.feels_like);
                    elements.healthMessage.textContent = healthData.message;
                    elements.healthCard.style.boxShadow = `0 8px 32px 0 ${hexToRgbA(healthData.color, 0.4)}`;
                    elements.healthStatus.style.color = healthData.color;
                } catch(e) {
                    console.error("Failed to fetch health info", e);
                }
                
                // Render the newly searched country on the interactive chart
                if (weatherData.hourly && weatherData.hourly.time) {
                    const times = weatherData.hourly.time;
                    const temps = weatherData.hourly.temperature_2m;
                    let yt = [];
                    let tt = [];
                    // Open-Meteo returns past 24 hours (day 0) and current 24 hours (day 1)
                    for(let i=0; i<24; i++) {
                        if (times[i]) yt.push({ timestamp: times[i], temperature_f: (temps[i] * 9/5) + 32 });
                    }
                    for(let i=24; i<48; i++) {
                        if (times[i]) tt.push({ timestamp: times[i], temperature_f: (temps[i] * 9/5) + 32 });
                    }
                    todayDataCache = tt;
                    yesterdayDataCache = yt;
                    currentChartLocation = loc.name;
                    updateChart();
                }
                
            } catch (error) {
                alert(`Scan failed: ${error.message}`);
                console.error("Geocoding/Weather Error:", error);
            }
            elements.searchBtn.textContent = 'Scan';
        });
    }

    async function fetchCurrentWeather() {
        try {
            const response = await fetch('/api/current');
            if (!response.ok) throw new Error("No data");
            const data = await response.json();
            
            // Update Dashboard UI
            elements.temp.textContent = fToC(data.temperature_f);
            elements.hum.textContent = data.humidity + '%';
            elements.wind.textContent = data.wind_speed_mph + ' mph';
            elements.rain.textContent = data.rainfall_in + ' in';
            
            // Complete Emoji Weather Logic for Home Station
            const windKm = data.wind_speed_mph * 1.609;
            const isDayLoc = new Date().getHours() >= 6 && new Date().getHours() < 18;
            
            let emoji = isDayLoc ? "☀️" : "🌙";
            
            if (windKm > 100) emoji = "🌊";
            else if (windKm > 40) emoji = "💨";
            else if (data.temperature_f <= 32 && data.rainfall_in > 0) emoji = "❄️"; // Snow
            else if (data.temperature_f <= 32 && data.humidity > 80) emoji = "❄️"; // Snowy Overcast
            else if (data.rainfall_in > 0.1) emoji = "⛈️"; // Storm
            else if (data.rainfall_in > 0) emoji = "🌧️"; // Rain
            else if (data.humidity > 80) emoji = "☁️"; // Cloudy
            else if (data.humidity > 50) emoji = isDayLoc ? "⛅" : "☁️🌙"; // Partly Cloudy
            
            elements.weatherEmoji.textContent = emoji;
            
            // Update Health Index UI
            const health = data.health_index;
            elements.healthStatus.textContent = health.status;
            elements.feelsLike.textContent = fToC(health.feels_like);
            elements.healthMessage.textContent = health.message;
            
            // Apply dynamic color drop shadow
            elements.healthCard.style.boxShadow = `0 8px 32px 0 ${hexToRgbA(health.color, 0.4)}`;
            elements.healthStatus.style.color = health.color;

        } catch (error) {
            console.error("Error fetching current weather:", error);
        }
    }

    async function fetchHistoricalData(duration) {
        try {
            const response = await fetch(`/api/historical?duration=${duration}`);
            if (!response.ok) throw new Error("No historical data");
            const res = await response.json();
            
            if (duration === "today") {
                todayDataCache = res.data;
            } else {
                yesterdayDataCache = res.data;
            }
        } catch (error) {
            console.error(`Error fetching historical data for ${duration}:`, error);
        }
    }

    function setupChart() {
        const ctx = document.getElementById('weatherChart').getContext('2d');
        
        // Setup Gradient
        const gradientToday = ctx.createLinearGradient(0, 0, 0, 400);
        gradientToday.addColorStop(0, 'rgba(56, 189, 248, 0.8)');   
        gradientToday.addColorStop(1, 'rgba(56, 189, 248, 0.0)');

        const gradientYesterday = ctx.createLinearGradient(0, 0, 0, 400);
        gradientYesterday.addColorStop(0, 'rgba(129, 140, 248, 0.6)');   
        gradientYesterday.addColorStop(1, 'rgba(129, 140, 248, 0.0)');

        Chart.defaults.color = "rgba(255,255,255,0.6)";
        Chart.defaults.font.family = "'Press Start 2P', cursive";

        weatherChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: getLabels(todayDataCache),
                datasets: [
                    {
                        label: 'Today (°C)',
                        data: todayDataCache.map(d => fToC(d.temperature_f)),
                        borderColor: '#38bdf8',
                        backgroundColor: gradientToday,
                        borderWidth: 2,
                        borderRadius: 4
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'top',
                    },
                    tooltip: {
                        mode: 'index',
                        intersect: false,
                        backgroundColor: 'rgba(30, 41, 59, 0.9)',
                        titleColor: '#fff',
                        bodyColor: '#cbd5e1',
                        borderColor: 'rgba(255,255,255,0.1)',
                        borderWidth: 1
                    }
                },
                scales: {
                    y: {
                        beginAtZero: false,
                        grid: {
                            color: 'rgba(255, 255, 255, 0.05)'
                        }
                    },
                    x: {
                        grid: {
                            display: false
                        }
                    }
                },
                interaction: {
                    mode: 'nearest',
                    axis: 'x',
                    intersect: false
                }
            }
        });
    }

    function updateChart() {
        if (!weatherChart) return;

        const showYesterday = elements.compareToggle.checked;
        
        weatherChart.data.labels = getLabels(todayDataCache);
        weatherChart.data.datasets[0].label = `Today in ${currentChartLocation} (°C)`;
        weatherChart.data.datasets[0].data = todayDataCache.map(d => fToC(d.temperature_f));
        
        weatherChart.data.datasets = [
            weatherChart.data.datasets[0] // Keep today
        ];

        if (showYesterday && yesterdayDataCache.length > 0) {
            // Re-create gradient for the second line
            const ctx = document.getElementById('weatherChart').getContext('2d');
            const gradientYesterday = ctx.createLinearGradient(0, 0, 0, 400);
            gradientYesterday.addColorStop(0, 'rgba(129, 140, 248, 0.6)');   
            gradientYesterday.addColorStop(1, 'rgba(129, 140, 248, 0.0)');

            weatherChart.data.datasets.push({
                label: `Yesterday in ${currentChartLocation} (°C)`,
                data: yesterdayDataCache.map(d => fToC(d.temperature_f)),
                borderColor: '#818cf8',
                backgroundColor: gradientYesterday,
                borderWidth: 2,
                borderRadius: 4
            });
        }
        
        weatherChart.update();
    }

    // Helper functions
    function getLabels(data) {
        return data.map(d => {
            const date = new Date(d.timestamp);
            return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        });
    }

    function hexToRgbA(hex, alpha){
        let c;
        if(/^#([A-Fa-f0-9]{3}){1,2}$/.test(hex)){
            c= hex.substring(1).split('');
            if(c.length== 3){
                c= [c[0], c[0], c[1], c[1], c[2], c[2]];
            }
            c= '0x'+c.join('');
            return 'rgba('+[(c>>16)&255, (c>>8)&255, c&255].join(',')+','+alpha+')';
        }
        return 'rgba(0,0,0,0)';
    }

    // Run
    init();
});
