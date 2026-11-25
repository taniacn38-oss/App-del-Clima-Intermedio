const API_KEY = "K3EXYPGNWNF88TSMNXG9W82JR"; // Reemplaza con tu clave de Visual Crossing Weather
const BASE_URL =
  "https://weather.visualcrossing.com/VisualCrossingWebServices/rest/services/timeline";

const searchForm = document.getElementById("search-form");
const locationInput = document.getElementById("location-input");
const refreshBtn = document.getElementById("refresh-btn");
const geoBtn = document.getElementById("geo-btn");

const loadingEl = document.getElementById("loading");
const errorBoxEl = document.getElementById("error-box");
const weatherContentEl = document.getElementById("weather-content");

const cityNameEl = document.getElementById("city-name");
const resolvedAddressEl = document.getElementById("resolved-address");
const conditionTextEl = document.getElementById("condition-text");
const currentTempEl = document.getElementById("current-temp");
const feelsLikeEl = document.getElementById("feels-like");
const windSpeedEl = document.getElementById("wind-speed");
const rainProbEl = document.getElementById("rain-prob");
const humidityEl = document.getElementById("humidity");
const pastHoursEl = document.getElementById("past-hours");
const nextHoursEl = document.getElementById("next-hours");

let currentQuery = "";

function setLoading(isLoading) {
  loadingEl.classList.toggle("hidden", !isLoading);
  if (isLoading) {
    errorBoxEl.classList.add("hidden");
  }
}

function showError(message) {
  errorBoxEl.textContent = message;
  errorBoxEl.classList.remove("hidden");
  weatherContentEl.classList.add("hidden");
}

function buildHourlyList(days, nowEpochSec) {
  const allHours = [];

  for (const day of days || []) {
    for (const hour of day.hours || []) {
      allHours.push({
        epoch: hour.datetimeEpoch,
        label: new Date(hour.datetimeEpoch * 1000).toLocaleTimeString("es-CO", {
          hour: "2-digit",
          minute: "2-digit",
          day: "2-digit",
          month: "short",
        }),
        temp: Math.round(hour.temp),
        precipprob: Math.round(hour.precipprob ?? 0),
        conditions: hour.conditions || "",
      });
    }
  }

  allHours.sort((a, b) => a.epoch - b.epoch);

  const twentyFourHoursSec = 24 * 3600;
  const past24h = allHours.filter(
    (h) => h.epoch < nowEpochSec && h.epoch >= nowEpochSec - twentyFourHoursSec,
  );
  const next24h = allHours.filter(
    (h) =>
      h.epoch >= nowEpochSec && h.epoch <= nowEpochSec + twentyFourHoursSec,
  );

  return { past24h, next24h };
}

function renderHourCards(container, hours) {
  container.innerHTML = "";

  if (!hours.length) {
    container.innerHTML = `<p class="muted">Sin datos horarios disponibles en este rango.</p>`;
    return;
  }

  const fragment = document.createDocumentFragment();
  for (const h of hours) {
    const card = document.createElement("div");
    card.className = "hour-card";
    card.innerHTML = `
      <div class="hour-time">${h.label}</div>
      <div class="hour-temp">${h.temp}°C</div>
      <div class="hour-meta">💧 ${h.precipprob}%</div>
      <div class="hour-meta">${h.conditions}</div>
    `;
    fragment.appendChild(card);
  }
  container.appendChild(fragment);
}

function renderWeather(data) {
  const current = data.currentConditions || {};
  const nowEpochSec = current.datetimeEpoch || Math.floor(Date.now() / 1000);

  cityNameEl.textContent = data.address;
  resolvedAddressEl.textContent = data.resolvedAddress || data.address;
  conditionTextEl.textContent = current.conditions || "Sin condición reportada";

  currentTempEl.textContent =
    current.temp !== undefined ? `${Math.round(current.temp)}°C` : "—°C";
  feelsLikeEl.textContent =
    current.feelslike !== undefined
      ? `Sensación: ${Math.round(current.feelslike)}°C`
      : "Sensación: —°C";

  windSpeedEl.textContent =
    current.windspeed !== undefined ? `${current.windspeed} km/h` : "— km/h";
  rainProbEl.textContent =
    current.precipprob !== undefined
      ? `${Math.round(current.precipprob)}%`
      : "—%";
  humidityEl.textContent =
    current.humidity !== undefined ? `${Math.round(current.humidity)}%` : "—%";

  const { past24h, next24h } = buildHourlyList(data.days, nowEpochSec);
  renderHourCards(pastHoursEl, past24h);
  renderHourCards(nextHoursEl, next24h);

  weatherContentEl.classList.remove("hidden");
}

async function fetchWeather(query) {
  if (!API_KEY || API_KEY === "TU_API_KEY_AQUI") {
    showError(
      "Configura primero tu API Key de Visual Crossing Weather en app.js.",
    );
    return;
  }

  const cleanQuery = query.trim();
  if (!cleanQuery) {
    showError("Por favor ingresa una ubicación válida.");
    return;
  }

  currentQuery = cleanQuery;
  setLoading(true);

  try {
    // Pedimos ayer y mañana (3 días en total) para cubrir 24h previas y 24h siguientes
    const url = `${BASE_URL}/${encodeURIComponent(
      cleanQuery,
    )}/yesterday/tomorrow?unitGroup=metric&lang=es&include=hours,current&key=${encodeURIComponent(
      API_KEY,
    )}&contentType=json`;

    const response = await fetch(url);
    if (!response.ok) {
      if (response.status === 400 || response.status === 404) {
        throw new Error(
          "No se encontró la ubicación indicada. Verifica el nombre e intenta de nuevo.",
        );
      }
      if (response.status === 401) {
        throw new Error("Clave de API inválida o sin permisos.");
      }
      throw new Error(
        `Error al consultar el clima (código ${response.status}).`,
      );
    }

    const data = await response.json();
    renderWeather(data);
  } catch (err) {
    showError(
      err.message || "Ocurrió un error inesperado al obtener el pronóstico.",
    );
  } finally {
    setLoading(false);
  }
}

function loadUserDefaultLocation() {
  if (!navigator.geolocation) {
    fetchWeather("Sogamoso, Boyacá");
    return;
  }

  setLoading(true);
  navigator.geolocation.getCurrentPosition(
    (position) => {
      const { latitude, longitude } = position.coords;
      fetchWeather(`${latitude},${longitude}`);
    },
    () => {
      // Si el usuario deniega el permiso o falla la geolocalización, usamos una ciudad por defecto
      fetchWeather("Sogamoso, Boyacá");
    },
    { timeout: 8000 },
  );
}

searchForm.addEventListener("submit", (event) => {
  event.preventDefault();
  fetchWeather(locationInput.value);
});

refreshBtn.addEventListener("click", () => {
  if (currentQuery) {
    fetchWeather(currentQuery);
  } else {
    loadUserDefaultLocation();
  }
});

geoBtn.addEventListener("click", () => {
  loadUserDefaultLocation();
});

// Vista por defecto al abrir la aplicación
loadUserDefaultLocation();
