let currentTempC = null;
let currentUnit = 'C';
let currentWeatherData = null;
let currentCityName = null;

// Event listeners
document.getElementById("searchBtn").addEventListener("click", () => {
    const city = document.getElementById("cityInput").value.trim();
    if(city) searchWeather(city);
});

document.getElementById("cityInput").addEventListener("keypress", (e) => {
    if(e.key === "Enter") {
        const city = document.getElementById("cityInput").value.trim();
        if(city) searchWeather(city);
    }
});

document.getElementById("locBtn").addEventListener("click", () => {
    if(navigator.geolocation){
        showLoading(true);
        navigator.geolocation.getCurrentPosition(
            pos => getWeatherByCoords(pos.coords.latitude, pos.coords.longitude),
            () => showError("Location access denied.")
        );
    } else showError("Geolocation not supported.");
});

document.querySelectorAll(".toggle-btn").forEach(btn => {
    btn.addEventListener("click", (e) => {
        document.querySelectorAll(".toggle-btn").forEach(b => b.classList.remove("active"));
        e.target.classList.add("active");
        currentUnit = e.target.dataset.unit;
        if(currentWeatherData) displayWeather();
    });
});

/**
 * Get coordinates from city name using OpenStreetMap Nominatim
 */
async function getCoordinates(city) {
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(city)}`;
    const res = await fetch(url);
    const data = await res.json();
    if(data.length === 0) throw new Error("City not found");
    return { lat: data[0].lat, lon: data[0].lon, name: data[0].display_name };
}

/**
 * Search weather for a city
 */
async function searchWeather(city) {
    try {
        if(!city || city.length < 2) {
            showError("Please enter a valid city name");
            return;
        }
        showLoading(true);
        showError("");
        const { lat, lon, name } = await getCoordinates(city);
        currentCityName = name;
        await getWeatherByCoords(lat, lon, name);
    } catch(err) {
        showError(err.message || "Failed to fetch weather data");
    } finally {
        showLoading(false);
    }
}

/**
 * Get weather data using coordinates
 */
async function getWeatherByCoords(lat, lon, cityName = null) {
    try {
        showLoading(true);
        const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true&daily=temperature_2m_max,temperature_2m_min,weathercode,precipitation_sum,windspeed_10m_max&hourly=temperature_2m,weathercode&timezone=auto`;
        const res = await fetch(url);
        
        if(!res.ok) {
            throw new Error("Failed to fetch weather data");
        }
        
        const data = await res.json();
        
        currentCityName = cityName || `${lat.toFixed(2)}, ${lon.toFixed(2)}`;
        currentWeatherData = data;
        currentTempC = data.current_weather.temperature;
        
        displayWeather();
        showForecast(data.daily);
        showHourly(data.hourly);
        animateWeather(data.current_weather.weathercode);
        setBackground(data.current_weather);
        
        showError("");
    } catch(err) {
        showError(err.message || "Failed to fetch weather data");
    } finally {
        showLoading(false);
    }
}

/**
 * Display current weather information
 */
function displayWeather() {
    if(!currentWeatherData) return;
    
    const weather = currentWeatherData.current_weather;
    const temp = currentUnit === 'C' ? weather.temperature : (weather.temperature * 9/5 + 32).toFixed(1);
    const isDayTime = isDay();
    
    document.getElementById("weather").innerHTML = `
        <img src="${getWeatherIcon(weather.weathercode, isDayTime)}" class="weather-icon" alt="weather icon">
        <h2>${currentCityName.split(',')[0]}</h2>
        <div class="weather-description">${getWeatherDescription(weather.weathercode)}</div>
        <div class="temperature-display">
            <span style="font-size: 3rem; font-weight: bold; color: #00796b;">${temp}°${currentUnit}</span>
        </div>
        <div class="weather-detail">💨 Wind Speed: ${weather.windspeed} km/h</div>
        <div class="weather-detail">🧭 Wind Direction: ${getWindDirection(weather.winddirection)}</div>
    `;
    
    // Show details card
    const feelsLikeTemp = calculateFeelsLike(weather.temperature, weather.windspeed);
    const feelsLikeDisplay = currentUnit === 'C' ? feelsLikeTemp.toFixed(1) : (feelsLikeTemp * 9/5 + 32).toFixed(1);
    
    document.getElementById("details").classList.remove("hidden");
    document.getElementById("details").innerHTML = `
        <h3>Additional Details</h3>
        <div class="details-grid">
            <div class="detail-item">
                <div class="detail-label">Feels Like</div>
                <div class="detail-value">${feelsLikeDisplay}°${currentUnit}</div>
            </div>
            <div class="detail-item">
                <div class="detail-label">Wind Direction</div>
                <div class="detail-value">${getWindDirection(weather.winddirection)}</div>
            </div>
            <div class="detail-item">
                <div class="detail-label">Max Wind Speed</div>
                <div class="detail-value">${weather.windspeed} km/h</div>
            </div>
            <div class="detail-item">
                <div class="detail-label">Last Updated</div>
                <div class="detail-value" style="font-size: 0.9rem;">${getCurrentTimeFormatted()}</div>
            </div>
        </div>
    `;
}

/**
 * Display 7-day forecast
 */
function showForecast(daily) {
    const forecastEl = document.getElementById("forecast");
    forecastEl.classList.remove("hidden");
    
    let html = '<h3>7-Day Forecast</h3><div class="forecast-container">';
    
    for(let i = 0; i < Math.min(7, daily.time.length); i++){
        const date = new Date(daily.time[i]);
        const maxTemp = currentUnit === 'C' ? daily.temperature_2m_max[i] : (daily.temperature_2m_max[i] * 9/5 + 32).toFixed(1);
        const minTemp = currentUnit === 'C' ? daily.temperature_2m_min[i] : (daily.temperature_2m_min[i] * 9/5 + 32).toFixed(1);
        
        html += `
        <div class="forecast-day">
            <div class="forecast-day-name">${date.toLocaleDateString('en-US', { weekday: 'short' })}</div>
            <img src="${getWeatherIcon(daily.weathercode[i], true)}" alt="icon">
            <div class="forecast-temp">🌡 ${minTemp}° / ${maxTemp}°</div>
            <div class="forecast-temp">☔ ${daily.precipitation_sum[i]}mm</div>
        </div>`;
    }
    
    html += '</div>';
    forecastEl.innerHTML = html;
}

/**
 * Display hourly forecast
 */
function showHourly(hourly) {
    const hourlyEl = document.getElementById("hourly");
    hourlyEl.classList.remove("hidden");
    
    let html = '<h3>Hourly Forecast</h3><div class="hourly-container">';
    
    for(let i = 0; i < Math.min(24, hourly.time.length); i++){
        const time = new Date(hourly.time[i]);
        const hour = time.getHours();
        const temp = currentUnit === 'C' ? hourly.temperature_2m[i] : (hourly.temperature_2m[i] * 9/5 + 32).toFixed(1);
        
        html += `
        <div class="hourly-item">
            <div>${hour}:00</div>
            <img src="${getWeatherIcon(hourly.weathercode[i], hour >= 6 && hour < 20)}" alt="icon">
            <div>${temp}°${currentUnit}</div>
        </div>`;
    }
    
    html += '</div>';
    hourlyEl.innerHTML = html;
}

/**
 * Check if it's daytime
 */
function isDay() {
    const hour = new Date().getHours();
    return hour >= 6 && hour < 20;
}

/**
 * Get weather icon URL based on weather code
 */
function getWeatherIcon(code, day=true) {
    if(code === 0) return day ? "https://img.icons8.com/ios/100/FFD700/sun--v1.png" : "https://img.icons8.com/ios/100/f0db4f/moon-symbol.png";
    if([1,2,3].includes(code)) return day ? "https://img.icons8.com/ios/100/FFD700/partly-cloudy-day--v1.png" : "https://img.icons8.com/ios/100/f0db4f/partly-cloudy-night--v1.png";
    if([45,48].includes(code)) return "https://img.icons8.com/ios/100/95a5a6/fog-day.png";
    if([51,53,55,61,63,65,66,67,80,81,82].includes(code)) return "https://img.icons8.com/ios/100/4da6ff/rain.png";
    if([71,73,75,77,85,86].includes(code)) return "https://img.icons8.com/ios/100/ecf0f1/snow.png";
    return "https://img.icons8.com/ios/100/95a5a6/cloud--v1.png";
}

/**
 * Get weather description from weather code
 */
function getWeatherDescription(code) {
    const descriptions = {
        0: "Clear Sky", 1: "Mainly Clear", 2: "Partly Cloudy", 3: "Overcast",
        45: "Foggy", 48: "Depositing Rime Fog", 51: "Light Drizzle",
        53: "Moderate Drizzle", 55: "Dense Drizzle", 61: "Slight Rain",
        63: "Moderate Rain", 65: "Heavy Rain", 66: "Light Freezing Rain",
        67: "Heavy Freezing Rain", 71: "Slight Snow", 73: "Moderate Snow",
        75: "Heavy Snow", 77: "Snow Grains", 80: "Slight Rain Showers",
        81: "Moderate Rain Showers", 82: "Violent Rain Showers",
        85: "Slight Snow Showers", 86: "Heavy Snow Showers",
        95: "Thunderstorm", 96: "Thunderstorm with Hail", 99: "Thunderstorm with Hail"
    };
    return descriptions[code] || "Unknown";
}

/**
 * Set background gradient based on temperature
 */
function setBackground(weather){
    const body = document.body;
    if(weather.temperature < 0) {
        body.style.background = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
    } else if(weather.temperature < 10) {
        body.style.background = 'linear-gradient(135deg, #83a4d4 0%, #b6fbff 100%)';
    } else if(weather.temperature < 20) {
        body.style.background = 'linear-gradient(135deg, #a1c4fd 0%, #c2e9fb 100%)';
    } else {
        body.style.background = 'linear-gradient(135deg, #fbc2eb 0%, #a6c1ee 100%)';
    }
}

/**
 * Animate weather elements
 */
function animateWeather(code){
    const rainContainer = document.getElementById("rainContainer");
    const cloud1 = document.getElementById("cloud1");
    const cloud2 = document.getElementById("cloud2");
    const cloud3 = document.getElementById("cloud3");
    const sun = document.getElementById("sun");

    rainContainer.innerHTML = '';
    cloud1.style.display = 'none';
    cloud2.style.display = 'none';
    cloud3.style.display = 'none';
    sun.style.display = 'none';

    if([51,53,55,61,63,65,66,67,80,81,82].includes(code)) {
        for(let i = 0; i < 5; i++) {
            const rain = document.createElement('div');
            rain.className = 'rain';
            rain.style.left = (i * 20 + 10) + '%';
            rainContainer.appendChild(rain);
        }
        cloud1.style.display = 'block';
        cloud2.style.display = 'block';
    } else if([71,73,75,77,85,86].includes(code)) {
        for(let i = 0; i < 3; i++) {
            const rain = document.createElement('div');
            rain.className = 'rain';
            rain.style.left = (i * 30 + 20) + '%';
            rainContainer.appendChild(rain);
        }
        cloud1.style.display = 'block';
        cloud3.style.display = 'block';
    } else if([1,2,3].includes(code)) {
        cloud1.style.display = 'block';
        cloud2.style.display = 'block';
        sun.style.display = 'block';
    } else if(code === 0) {
        sun.style.display = 'block';
    } else {
        cloud1.style.display = 'block';
        cloud2.style.display = 'block';
        cloud3.style.display = 'block';
    }
}

/**
 * Show/hide loading spinner
 */
function showLoading(show) {
    document.getElementById("loading").classList.toggle("hidden", !show);
}

function showLoading(show) {
  document.getElementById("loading").classList.toggle("hidden", !show);
}


/**
 * Show/hide error message
 */
function showError(message) {
    const errorEl = document.getElementById("error");
    if(message && message.trim() !== "") {
        errorEl.textContent = message;
        errorEl.classList.remove("hidden");
    } else {
        errorEl.classList.add("hidden");
    }
}

/**
 * Calculate feels like temperature (simplified wind chill)
 */
function calculateFeelsLike(temp, windspeed) {
    if(temp >= 10) return temp;
    return temp - (windspeed * 0.2);
}

/**
 * Get wind direction description
 */
function getWindDirection(degrees) {
    const directions = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
    const index = Math.round(degrees / 22.5) % 16;
    return directions[index];
}

/**
 * Get current time formatted
 */
function getCurrentTimeFormatted() {
    const now = new Date();
    return now.toLocaleString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}