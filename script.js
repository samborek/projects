// --- Utility: Time & Date ---
function updateTimeAndDate() {
    const now = new Date();
    const timeString = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false });
    const dateString = now.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short' });

    document.getElementById('time-display').textContent = timeString;
    document.getElementById('date-display').textContent = dateString;
}
setInterval(updateTimeAndDate, 1000);
updateTimeAndDate();

// --- Configuration ---
function getCoordinates(cityName) {
    // Fallback if no coordinates stored in localStorage
    const savedLat = localStorage.getItem('cityLat');
    const savedLon = localStorage.getItem('cityLon');
    if (savedLat && savedLon) {
        return { lat: savedLat, lon: savedLon };
    }

    const city = (cityName || 'Kraków').toLowerCase().trim();
    const map = {
        'kraków': { lat: 50.0647, lon: 19.9450 },
        'cracow': { lat: 50.0647, lon: 19.9450 },
        'warsaw': { lat: 52.2297, lon: 21.0122 }
    };
    return map[city] || map['kraków'];
}

// --- Data Fetching: Weather & AQI (Open-Meteo) ---
async function fetchWeatherAndAQI() {
    const cityName = localStorage.getItem('cityName') || 'Kraków';
    const coords = getCoordinates(cityName);

    try {
        const weatherRes = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${coords.lat}&longitude=${coords.lon}&current_weather=true&hourly=relativehumidity_2m,windspeed_10m`);
        if (weatherRes.ok) {
            const data = await weatherRes.json();
            const current = data.current_weather;
            document.getElementById('temp-display').textContent = `${Math.round(current.temperature)}°C`;
            document.getElementById('condition-display').textContent = getWeatherDescription(current.weathercode);

            const hourIdx = new Date().getHours();
            if (data.hourly) {
                document.getElementById('humidity-value').textContent = `${Math.round(data.hourly.relativehumidity_2m[hourIdx])}%`;
                document.getElementById('wind-value').textContent = `${Math.round(data.hourly.windspeed_10m[hourIdx])}km/h`;
            }
        }

        const aqiRes = await fetch(`https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${coords.lat}&longitude=${coords.lon}&current=us_aqi,pm2_5`);
        if (aqiRes.ok) {
            const aqiData = await aqiRes.json();
            const aqiVal = aqiData.current.us_aqi;
            document.getElementById('aqi-value').textContent = Math.round(aqiVal);
            document.getElementById('aqi-detail').textContent = `PM2.5 ${Math.round(aqiData.current.pm2_5)} µg/m³`;
        }
    } catch (err) {
        console.error('Fetch error:', err);
    }
}

function getWeatherDescription(code) {
    const codes = { 0: 'Clear', 1: 'Mainly Clear', 2: 'Partly Cloudy', 3: 'Overcast', 45: 'Fog', 48: 'Rime Fog', 51: 'Light Drizzle', 61: 'Slight Rain', 95: 'Thunderstorm' };
    return codes[code] || 'Cloudy';
}

// --- Combined Schedule Rendering ---
let currentTasks = [];
let currentEvents = [];

function renderSchedule() {
    const container = document.getElementById('todoist-tasks');
    const todayStr = new Date().toISOString().split('T')[0];

    // Combine items
    const allItems = [
        ...currentEvents.map(e => ({ content: e.summary, type: 'event' })),
        ...currentTasks.map(t => ({
            content: t.content,
            type: 'task',
            isOverdue: t.due && t.due.date < todayStr
        }))
    ];

    if (allItems.length === 0) {
        container.innerHTML = '<div class="todoist-task">No plans for today! 🎉</div>';
    } else {
        // Show top item list
        container.innerHTML = allItems.map(item => {
            const prefix = item.type === 'event' ? '🗓️' : '•';
            const className = item.isOverdue ? 'todoist-task overdue' : 'todoist-task';
            return `<div class="${className}">${prefix} ${item.content}</div>`;
        }).join('');
    }
}

// --- Data Fetching: Todoist ---
async function fetchTodoist() {
    const apiKey = localStorage.getItem('todoistApiKey');
    if (!apiKey) {
        currentTasks = [];
        renderSchedule();
        return;
    }
    try {
        const response = await fetch('https://api.todoist.com/rest/v2/tasks?filter=today%20|%20overdue', {
            headers: { 'Authorization': `Bearer ${apiKey}` }
        });
        if (response.ok) {
            currentTasks = await response.json();
            renderSchedule();
        }
    } catch (err) {
        console.error('Todoist error:', err);
    }
}

// --- Data Fetching: Google Calendar ---
async function fetchGoogleCalendar() {
    const apiKey = localStorage.getItem('googleApiKey');
    const calendarId = localStorage.getItem('calendarId');
    if (!apiKey || !calendarId) {
        currentEvents = [];
        renderSchedule();
        return;
    }

    try {
        const now = new Date();
        const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
        const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59).toISOString();

        const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?key=${apiKey}&timeMin=${startOfDay}&timeMax=${endOfDay}&singleEvents=true&orderBy=startTime`;

        const response = await fetch(url);
        if (response.ok) {
            const data = await response.json();
            currentEvents = data.items || [];
            renderSchedule();
        }
    } catch (err) {
        console.error('Fetch error:', err);
    }
}

// --- Settings & Runtime ---
const modal = document.getElementById('settings-modal');
const trigger = document.getElementById('settings-trigger');
const saveBtn = document.getElementById('save-settings');
const themeToggle = document.getElementById('theme-toggle');
const sunIcon = document.getElementById('sun-icon');
const moonIcon = document.getElementById('moon-icon');

function updateDarkMode(isDark) {
    if (isDark) {
        document.body.classList.add('dark-mode');
        sunIcon.style.display = 'block';   // Show Sun icon to switch to Light mode
        moonIcon.style.display = 'none';
    } else {
        document.body.classList.remove('dark-mode');
        sunIcon.style.display = 'none';
        moonIcon.style.display = 'block';  // Show Moon icon to switch to Dark mode
    }
}

// Initial Dark Mode load
updateDarkMode(localStorage.getItem('darkMode') === 'true');

themeToggle.addEventListener('click', () => {
    const isDark = !document.body.classList.contains('dark-mode');
    localStorage.setItem('darkMode', isDark);
    updateDarkMode(isDark);
});

trigger.addEventListener('click', () => {
    document.getElementById('city-name').value = localStorage.getItem('cityName') || '';
    document.getElementById('todoist-key').value = localStorage.getItem('todoistApiKey') || '';
    document.getElementById('google-api-key').value = localStorage.getItem('googleApiKey') || '';
    document.getElementById('calendar-id').value = localStorage.getItem('calendarId') || '';
    document.getElementById('aqicn-key').value = localStorage.getItem('aqicnApiKey') || '';

    // Clear old suggestions
    suggestionsList.innerHTML = '';
    suggestionsList.classList.add('hidden');

    modal.classList.remove('hidden');
});

const suggestionsList = document.getElementById('city-suggestions');
const cityInput = document.getElementById('city-name');

function debounce(func, wait) {
    let timeout;
    return function (...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), wait);
    };
}

async function fetchCitySuggestions(query) {
    if (!query || query.length < 2) {
        suggestionsList.innerHTML = '';
        suggestionsList.classList.add('hidden');
        return;
    }

    try {
        const res = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=5&language=en&format=json`);
        if (res.ok) {
            const data = await res.json();
            const results = data.results || [];

            if (results.length === 0) {
                suggestionsList.innerHTML = '';
                suggestionsList.classList.add('hidden');
                return;
            }

            suggestionsList.innerHTML = results.map(city => `
                <div class="suggestion-item" data-lat="${city.latitude}" data-lon="${city.longitude}" data-name="${city.name}, ${city.admin1 || ''} ${city.country}">
                    <span class="city-name">${city.name}</span>
                    <span class="city-details">${city.admin1 || ''} ${city.country}</span>
                </div>
            `).join('');
            suggestionsList.classList.remove('hidden');

            document.querySelectorAll('.suggestion-item').forEach(item => {
                item.addEventListener('click', () => {
                    cityInput.value = item.dataset.name;
                    localStorage.setItem('cityLat', item.dataset.lat);
                    localStorage.setItem('cityLon', item.dataset.lon);
                    suggestionsList.innerHTML = '';
                    suggestionsList.classList.add('hidden');
                });
            });
        }
    } catch (err) {
        console.error('Geocoding error:', err);
    }
}

cityInput.addEventListener('input', debounce((e) => {
    fetchCitySuggestions(e.target.value);
}, 400));

// Close suggestions when clicking outside
document.addEventListener('click', (e) => {
    if (!cityInput.contains(e.target) && !suggestionsList.contains(e.target)) {
        suggestionsList.classList.add('hidden');
    }
});

saveBtn.addEventListener('click', async () => {
    const cityName = document.getElementById('city-name').value;
    const todoistKey = document.getElementById('todoist-key').value;
    const googleApiKey = document.getElementById('google-api-key').value;
    const calendarId = document.getElementById('calendar-id').value;
    const aqicnKey = document.getElementById('aqicn-key').value;

    localStorage.setItem('cityName', cityName);
    localStorage.setItem('todoistApiKey', todoistKey);
    localStorage.setItem('googleApiKey', googleApiKey);
    localStorage.setItem('calendarId', calendarId);
    localStorage.setItem('aqicnApiKey', aqicnKey);

    // If city changed but no coordinates stored, try to geocode once
    if (cityName && (!localStorage.getItem('cityLat') || cityName !== localStorage.getItem('lastSavedCityName'))) {
        try {
            const res = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(cityName)}&count=1&language=en&format=json`);
            if (res.ok) {
                const data = await res.json();
                if (data.results && data.results[0]) {
                    localStorage.setItem('cityLat', data.results[0].latitude);
                    localStorage.setItem('cityLon', data.results[0].longitude);
                }
            }
        } catch (e) { }
    }
    localStorage.setItem('lastSavedCityName', cityName);

    modal.classList.add('hidden');

    fetchWeatherAndAQI();
    fetchTodoist();
    fetchGoogleCalendar();
});

// --- PWA Service Worker Registration ---
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js')
            .then((reg) => console.log('SW registered:', reg.scope))
            .catch((err) => console.error('SW registration failed:', err));
    });
}

modal.addEventListener('click', (e) => { if (e.target === modal) modal.classList.add('hidden'); });

// Run initial load
fetchWeatherAndAQI();
fetchTodoist();
fetchGoogleCalendar();
// Refresh every 10 mins
setInterval(() => { fetchWeatherAndAQI(); fetchTodoist(); fetchGoogleCalendar(); }, 600000);

// --- Wake Lock (Prevent Sleep) ---
let wakeLock = null;

async function requestWakeLock() {
    if ('wakeLock' in navigator) {
        try {
            wakeLock = await navigator.wakeLock.request('screen');
            console.log('Wake Lock active');
            wakeLock.addEventListener('release', () => {
                console.log('Wake Lock released');
            });
        } catch (err) {
            console.error(`Wake Lock error: ${err.name}, ${err.message}`);
        }
    }
}

// Re-acquire lock when page becomes visible again
document.addEventListener('visibilitychange', async () => {
    if (wakeLock !== null && document.visibilityState === 'visible') {
        await requestWakeLock();
    }
});

requestWakeLock();
