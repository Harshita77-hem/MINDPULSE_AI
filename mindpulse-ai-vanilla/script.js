"use strict";

/* =========================================================
   1. DATA — dropdown options + validation ranges, mirroring
      the backend's StudentData model exactly.
   ========================================================= */

const GENDER_OPTIONS = ["Male", "Female"];
const ACADEMIC_LEVEL_OPTIONS = ["UnderGraduate", "Graduate", "High School"];
const PLATFORM_OPTIONS = [
  "Facebook", "LinkedIn", "Instagram", "Snapchat", "Twitter",
  "YouTube", "TikTok", "LINE", "KakaoTalk", "VKkontakte", "WhatsApp", "WeChat",
];
const PURPOSE_OPTIONS = ["Networking", "Education", "Entertainment", "News"];
const STRESS_OPTIONS = ["Low", "Medium", "High", "Very High"];
const COUNTRY_SUGGESTIONS = [
  "Other", "India", "USA", "Canada", "Australia", "UK", "Germany", "Mexico", "Turkey", "France",
];

// Backend-enforced ranges. daily_unlocks has no upper bound (ge=0 only).
const FIELD_LIMITS = {
  age: { min: 10, max: 100 },
  avg_daily_usage_hours: { min: 0, max: 24 },
  daily_unlocks: { min: 0 },
  study_hours: { min: 0, max: 24 },
  physical_activity_hours: { min: 0, max: 24 },
  sleep_hours_per_night: { min: 0, max: 24 },
};

// Select/segmented fields with no numeric range, but still required.
const REQUIRED_CATEGORICAL_FIELDS = {
  gender: "Select a gender.",
  country: "Select a country.",
  academic_level: "Select an academic level.",
  most_used_platform: "Select a platform.",
  purpose_of_use: "Select a purpose.",
  stress_level: "Select a stress level.",
};

const DEFAULT_STRESS_VALUE = ""; // no default — the person must pick one

/* =========================================================
   2. API LAYER — the only place that talks to the FastAPI
      backend. Kept separate from every DOM/rendering concern.
   ========================================================= */

const API_BASE_URL = "https://mindpulse-ai-1-cmto.onrender.com";

class ApiError extends Error {
  constructor(kind, message) {
    super(message);
    this.kind = kind; // "connection" | "validation" | "server"
  }
}

async function getPrediction(formValues) {
  const payload = {
    age: Number(formValues.age),
    gender: formValues.gender,
    country: formValues.country,
    academic_level: formValues.academic_level,
    most_used_platform: formValues.most_used_platform,
    purpose_of_use: formValues.purpose_of_use,
    avg_daily_usage_hours: Number(formValues.avg_daily_usage_hours),
    daily_unlocks: Number(formValues.daily_unlocks),
    study_hours: Number(formValues.study_hours),
    physical_activity_hours: Number(formValues.physical_activity_hours),
    sleep_hours_per_night: Number(formValues.sleep_hours_per_night),
    stress_level: formValues.stress_level,
  };

  let response;
  try {
    response = await fetch(`${API_BASE_URL}/predict`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch (networkError) {
    throw new ApiError("connection", "Unable to connect to the prediction service.");
  }

  if (!response.ok) {
    if (response.status === 422 || response.status === 400) {
      let detail = "Please check the values you entered and try again.";
      try {
        const body = await response.json();
        if (body && body.detail) {
          detail = Array.isArray(body.detail)
            ? body.detail.map((d) => d.msg).join(" ")
            : String(body.detail);
        }
      } catch {
        // response body wasn't JSON — keep the default message
      }
      throw new ApiError("validation", detail);
    }
    throw new ApiError("server", "The prediction service returned an unexpected error.");
  }

  const data = await response.json();
  if (typeof data.predicted_mental_health_score !== "number") {
    throw new ApiError("server", "The prediction service returned an unexpected response.");
  }
  return data.predicted_mental_health_score;
}

async function checkApiStatus() {
  const candidatePaths = ["/", "/docs"];
  for (const path of candidatePaths) {
    try {
      const response = await fetch(`${API_BASE_URL}${path}`, { method: "GET" });
      if (response.ok || response.status === 404) return true;
    } catch {
      // try next candidate
    }
  }
  return false;
}

/* =========================================================
   3. VALIDATION
   ========================================================= */

function validateNumberField(key, rawValue) {
  const limits = FIELD_LIMITS[key];
  if (rawValue === "" || rawValue === null || rawValue === undefined) {
    return "This field is required.";
  }
  const value = Number(rawValue);
  if (Number.isNaN(value)) return "Enter a valid number.";
  if (value < limits.min) return `Must be ${limits.min} or greater.`;
  if (limits.max !== undefined && value > limits.max) {
    return `Must be between ${limits.min} and ${limits.max}.`;
  }
  return "";
}

function validateForm(values) {
  const errors = {};
  for (const key of Object.keys(FIELD_LIMITS)) {
    const message = validateNumberField(key, values[key]);
    if (message) errors[key] = message;
  }
  for (const [key, message] of Object.entries(REQUIRED_CATEGORICAL_FIELDS)) {
    if (!values[key] || !String(values[key]).trim()) {
      errors[key] = message;
    }
  }
  return errors;
}

/* =========================================================
   4. DOM SETUP — populate selects/datalist, read form values
   ========================================================= */

function fillSelect(id, options, defaultValue) {
  const select = document.getElementById(id);
  select.innerHTML = "";
  for (const option of options) {
    const el = document.createElement("option");
    el.value = option;
    el.textContent = option;
    select.appendChild(el);
  }
  select.value = defaultValue;
}

// Same as fillSelect, but leaves nothing pre-chosen: a disabled "Select"
// placeholder is shown until the person actively picks a value.
function fillSelectWithPlaceholder(id, options) {
  const select = document.getElementById(id);
  select.innerHTML = "";
  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.textContent = "Select";
  placeholder.disabled = true;
  placeholder.selected = true;
  select.appendChild(placeholder);
  for (const option of options) {
    const el = document.createElement("option");
    el.value = option;
    el.textContent = option;
    select.appendChild(el);
  }
}

function populateFormControls() {
  fillSelectWithPlaceholder("field-gender", GENDER_OPTIONS);
  fillSelectWithPlaceholder("field-country", COUNTRY_SUGGESTIONS);
  fillSelectWithPlaceholder("field-academic_level", ACADEMIC_LEVEL_OPTIONS);
  fillSelectWithPlaceholder("field-most_used_platform", PLATFORM_OPTIONS);
  fillSelectWithPlaceholder("field-purpose_of_use", PURPOSE_OPTIONS);
  document.getElementById("field-stress_level").value = DEFAULT_STRESS_VALUE;
}

function readFormValues() {
  return {
    age: document.getElementById("field-age").value,
    gender: document.getElementById("field-gender").value,
    country: document.getElementById("field-country").value,
    academic_level: document.getElementById("field-academic_level").value,
    most_used_platform: document.getElementById("field-most_used_platform").value,
    purpose_of_use: document.getElementById("field-purpose_of_use").value,
    avg_daily_usage_hours: document.getElementById("field-avg_daily_usage_hours").value,
    daily_unlocks: document.getElementById("field-daily_unlocks").value,
    study_hours: document.getElementById("field-study_hours").value,
    physical_activity_hours: document.getElementById("field-physical_activity_hours").value,
    sleep_hours_per_night: document.getElementById("field-sleep_hours_per_night").value,
    stress_level: document.getElementById("field-stress_level").value,
  };
}

function showFieldError(key, message) {
  const wrapper = document.querySelector(`[data-field="${key}"]`);
  if (!wrapper) return;
  wrapper.classList.toggle("field--error", Boolean(message));
  const errorEl = wrapper.querySelector(".field-error");
  if (errorEl) errorEl.textContent = message || "";
}

function clearAllFieldErrors() {
  document.querySelectorAll(".field").forEach((wrapper) => {
    wrapper.classList.remove("field--error");
    const errorEl = wrapper.querySelector(".field-error");
    if (errorEl) errorEl.textContent = "";
  });
}

/* =========================================================
   5. RESULT CARD RENDERING (idle / loading / error / success)
   ========================================================= */

const GAUGE_MIN = 0;
const GAUGE_MAX = 10; // visualization only, see README

const resultPanels = {
  idle: document.getElementById("result-idle"),
  loading: document.getElementById("result-loading"),
  error: document.getElementById("result-error"),
  success: document.getElementById("result-success"),
};

let relativeTimeTimer = null;
let predictionTimestamp = null;

function showResultPanel(name) {
  for (const key of Object.keys(resultPanels)) {
    resultPanels[key].hidden = key !== name;
  }
}

// The gauge arc is drawn with pathLength="100", so its dasharray is just
// a 0–100 percentage of the arc — no circumference math needed.
function setGaugeFraction(fraction) {
  const gaugeProgress = document.getElementById("gauge-progress");
  const visible = Math.max(0, Math.min(1, fraction)) * 100;
  gaugeProgress.style.strokeDasharray = `${visible} ${100 - visible}`;
  gaugeProgress.style.strokeDashoffset = "0";
}

function renderResultIdle() {
  clearInterval(relativeTimeTimer);
  setGaugeFraction(0);
  showResultPanel("idle");
  hideWellness();
}

function renderResultLoading() {
  clearInterval(relativeTimeTimer);
  setGaugeFraction(0);
  showResultPanel("loading");
  hideWellness();
}

function renderResultError(title, detail) {
  clearInterval(relativeTimeTimer);
  setGaugeFraction(0);
  document.getElementById("result-error-title").textContent = title;
  document.getElementById("result-error-detail").textContent = detail;
  showResultPanel("error");
  hideWellness();
}

function formatRelativeTime(timestamp) {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 5) return "Prediction generated just now";
  if (seconds < 60) return `Prediction generated ${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  return `Prediction generated ${minutes}m ago`;
}

function renderResultSuccess(score) {
  showResultPanel("success");

  const clamped = Math.min(Math.max(score, GAUGE_MIN), GAUGE_MAX);
  const fraction = (clamped - GAUGE_MIN) / (GAUGE_MAX - GAUGE_MIN);
  setGaugeFraction(fraction);

  document.getElementById("gauge-number").textContent = score.toFixed(2);

  document.getElementById("result-success").classList.remove("reveal-on-result");
  // Force reflow so the entrance animation replays on every new prediction.
  void document.getElementById("result-success").offsetWidth;
  document.getElementById("result-success").classList.add("reveal-on-result");

  predictionTimestamp = Date.now();
  const timestampEl = document.getElementById("result-timestamp");
  timestampEl.textContent = formatRelativeTime(predictionTimestamp);
  clearInterval(relativeTimeTimer);
  relativeTimeTimer = setInterval(() => {
    timestampEl.textContent = formatRelativeTime(predictionTimestamp);
  }, 1000);
}

/* =========================================================
   6. PREDICTION SUMMARY + BEHAVIORAL SIGNALS
   ========================================================= */

const SIGNAL_CARDS = [
  {
    key: "avg_daily_usage_hours", title: "Digital usage", description: "Reported social-media usage",
    suffix: " hrs/day",
    icon: '<path d="M17 2H7a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2z"/><line x1="12" y1="18" x2="12.01" y2="18"/>',
  },
  {
    key: "sleep_hours_per_night", title: "Sleep", description: "Reported nightly sleep",
    suffix: " hrs/night",
    icon: '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>',
  },
  {
    key: "study_hours", title: "Study", description: "Reported daily study time",
    suffix: " hrs/day",
    icon: '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>',
  },
  {
    key: "physical_activity_hours", title: "Physical activity", description: "Reported daily activity",
    suffix: " hrs/day",
    icon: '<path d="M6.5 6.5 17.5 17.5"/><path d="m21 21-1-1"/><path d="m3 3 1 1"/><path d="m18 22 4-4"/><path d="m2 6 4-4"/><path d="m3 10 7-7"/><path d="m14 21 7-7"/>',
  },
  {
    key: "stress_level", title: "Stress", description: "Self-reported stress level",
    suffix: "",
    icon: '<path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/>',
  },
];

function renderSignals(values) {
  const signalsGrid = document.getElementById("signals-grid");
  signalsGrid.innerHTML = "";
  for (const card of SIGNAL_CARDS) {
    const el = document.createElement("div");
    el.className = "signal-card glass-panel";
    el.innerHTML = `
      <div class="signal-card-icon">
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${card.icon}</svg>
      </div>
      <span class="signal-card-title">${card.title}</span>
      <span class="signal-card-value">${values[card.key]}${card.suffix}</span>
      <span class="signal-card-desc">${card.description}</span>
    `;
    signalsGrid.appendChild(el);
  }

  const signalsWrap = document.getElementById("signals-wrap");
  signalsWrap.hidden = false;
  signalsWrap.classList.remove("reveal-on-result");
  void signalsWrap.offsetWidth;
  signalsWrap.classList.add("reveal-on-result");
}

function hideSignals() {
  document.getElementById("signals-wrap").hidden = true;
}

/* =========================================================
   6b. PERSONALIZED WELLNESS INSIGHTS
      Rule-based, derived entirely from the current form values —
      never a diagnosis, always framed as suggestions. Stress and
      sleep and digital usage are always shown; activity and study
      are added only when they need attention, keeping the section
      to 3–5 cards instead of always showing all five.
   ========================================================= */

function iconFor(key) {
  const card = SIGNAL_CARDS.find((c) => c.key === key);
  return card ? card.icon : "";
}

function evaluateSleep(values) {
  const hours = Number(values.sleep_hours_per_night);
  if (hours < 6) {
    return {
      title: "Prioritize your sleep",
      text: "Your reported sleep duration is relatively low. Try maintaining a consistent sleep schedule and gradually increasing your nightly rest.",
      action: "Set a consistent bedtime and build up your rest gradually.",
      needsAttention: true,
    };
  }
  if (hours < 7) {
    return {
      title: "Build a consistent sleep routine",
      text: "Try keeping a regular bedtime and reducing screen use before sleep to support better rest.",
      action: "Keep a regular bedtime and dim screens beforehand.",
      needsAttention: true,
    };
  }
  return {
    title: "Maintain your sleep routine",
    text: "Keep your current sleep routine consistent and protect your regular rest schedule.",
    action: "Keep your current sleep schedule steady.",
    needsAttention: false,
  };
}

function evaluateDigitalUsage(values) {
  const hours = Number(values.avg_daily_usage_hours);
  if (hours > 5) {
    return {
      title: "Create screen-free periods",
      text: "Consider taking regular breaks from social media, especially during study sessions and before bedtime.",
      action: "Schedule short breaks away from your phone.",
      needsAttention: true,
    };
  }
  if (hours >= 3) {
    return {
      title: "Keep your digital usage balanced",
      text: "Use short screen breaks during the day and avoid unnecessary scrolling during focused activities.",
      action: "Add brief screen breaks during focused activities.",
      needsAttention: true,
    };
  }
  return {
    title: "Maintain your digital balance",
    text: "Your reported social-media usage is relatively moderate. Continue keeping intentional boundaries around screen time.",
    action: "Keep your current screen-time boundaries.",
    needsAttention: false,
  };
}

function evaluateStress(values) {
  const level = values.stress_level;
  if (level === "Very High") {
    return {
      title: "Make time for stress management",
      text: "Consider short relaxation activities such as breathing exercises, walking, journaling, or talking to someone you trust.",
      action: "Try a short breathing or relaxation break today.",
      needsAttention: true,
    };
  }
  if (level === "High") {
    return {
      title: "Focus on stress management",
      text: "Try adding short breaks, physical activity, breathing exercises, or another relaxing activity to your daily routine.",
      action: "Add a short break or relaxing activity today.",
      needsAttention: true,
    };
  }
  if (level === "Medium") {
    return {
      title: "Keep stress in check",
      text: "Regular breaks, physical activity and a consistent routine may help you manage everyday stress.",
      action: "Keep regular breaks part of your routine.",
      needsAttention: true,
    };
  }
  return {
    title: "Maintain your current balance",
    text: "Continue with the habits and routines that help you maintain a manageable stress level.",
    action: "Keep doing what's working for you.",
    needsAttention: false,
  };
}

function evaluatePhysicalActivity(values) {
  const hours = Number(values.physical_activity_hours);
  if (hours < 1) {
    return {
      title: "Add more movement",
      text: "Try incorporating short walks, stretching, exercise, or other enjoyable physical activities into your day.",
      action: "Take a short walk or stretch today.",
      needsAttention: true,
    };
  }
  return {
    title: "Keep moving",
    text: "Continue including regular physical activity in your daily routine.",
    action: "Keep your activity routine consistent.",
    needsAttention: false,
  };
}

function evaluateStudyBalance(values) {
  const hours = Number(values.study_hours);
  if (hours > 8) {
    return {
      title: "Balance study and recovery",
      text: "Long study periods can be tiring. Try using focused study sessions with regular short breaks and time for recovery.",
      action: "Add short breaks between study sessions.",
      needsAttention: true,
    };
  }
  if (hours >= 4) {
    return {
      title: "Keep a balanced study routine",
      text: "Use focused study sessions with regular breaks and protect time for sleep and physical activity.",
      action: "Protect breaks and rest around study time.",
      needsAttention: false,
    };
  }
  return {
    title: "Create a consistent study routine",
    text: "Try setting small focused study blocks and taking regular breaks to maintain consistency.",
    action: "Set small focused study blocks daily.",
    needsAttention: true,
  };
}

// Priority order: stress, sleep, digital usage, physical activity, study.
// The top three are always shown; activity and study are only added when
// they flag needsAttention, keeping the section to 3–5 relevant cards
// instead of always padding it out to five.
function getWellnessSuggestions(values) {
  const ranked = [
    { key: "stress_level", icon: iconFor("stress_level"), ...evaluateStress(values) },
    { key: "sleep_hours_per_night", icon: iconFor("sleep_hours_per_night"), ...evaluateSleep(values) },
    { key: "avg_daily_usage_hours", icon: iconFor("avg_daily_usage_hours"), ...evaluateDigitalUsage(values) },
    { key: "physical_activity_hours", icon: iconFor("physical_activity_hours"), ...evaluatePhysicalActivity(values) },
    { key: "study_hours", icon: iconFor("study_hours"), ...evaluateStudyBalance(values) },
  ];

  const guaranteed = ranked.slice(0, 3);
  const optional = ranked.slice(3).filter((suggestion) => suggestion.needsAttention);
  return [...guaranteed, ...optional];
}

function renderWellness(values) {
  const suggestions = getWellnessSuggestions(values);

  const wellnessGrid = document.getElementById("wellness-grid");
  wellnessGrid.innerHTML = "";
  for (const suggestion of suggestions) {
    const el = document.createElement("div");
    el.className = "wellness-card glass-panel";
    el.innerHTML = `
      <div class="wellness-card-icon">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${suggestion.icon}</svg>
      </div>
      <h4 class="wellness-card-title">${suggestion.title}</h4>
      <p class="wellness-card-text">${suggestion.text}</p>
      <p class="wellness-card-action"><span class="wellness-card-action-label">Try this</span>${suggestion.action}</p>
    `;
    wellnessGrid.appendChild(el);
  }

  const wellnessWrap = document.getElementById("wellness-wrap");
  wellnessWrap.hidden = false;
  wellnessWrap.classList.remove("reveal-on-result");
  void wellnessWrap.offsetWidth;
  wellnessWrap.classList.add("reveal-on-result");
}

function hideWellness() {
  document.getElementById("wellness-wrap").hidden = true;
}

/* =========================================================
   7. NAVBAR STATUS INDICATOR
   ========================================================= */

const STATUS_COPY = {
  checking: "Checking API…",
  online: "API Connected",
  offline: "API Offline",
};

async function pollApiStatus() {
  const dot = document.getElementById("status-dot");
  const label = document.getElementById("status-dot-label");
  const isOnline = await checkApiStatus();
  const status = isOnline ? "online" : "offline";
  dot.className = `status-dot status-dot--${status}`;
  label.textContent = STATUS_COPY[status];
}

/* =========================================================
   8. WIRE EVERYTHING UP
   ========================================================= */

const ERROR_COPY = {
  connection: {
    title: "Unable to connect to the prediction service.",
    detail: "Make sure the FastAPI backend is running on port 2200.",
  },
  validation: {
    title: "Some values weren't accepted by the model.",
    detail: "",
  },
  server: {
    title: "The prediction service ran into a problem.",
    detail: "Please try again in a moment.",
  },
};

let lastAttemptedValues = null;
let isSubmitting = false;

async function runPrediction(values) {
  lastAttemptedValues = values;
  isSubmitting = true;
  document.getElementById("predict-submit").disabled = true;
  document.getElementById("predict-submit").textContent = "Reading your signal…";
  renderResultLoading();

  try {
    const score = await getPrediction(values);
    renderResultSuccess(score);
    renderSignals(values);
    renderWellness(values);
  } catch (err) {
    const kind = err instanceof ApiError ? err.kind : "server";
    const copy = ERROR_COPY[kind] || ERROR_COPY.server;
    const detail = kind === "validation" ? err.message : copy.detail;
    renderResultError(copy.title, detail);
    hideSignals();
  } finally {
    isSubmitting = false;
    document.getElementById("predict-submit").disabled = false;
    document.getElementById("predict-submit").textContent = "Read my signal";
  }
}

function handleSubmit(event) {
  event.preventDefault();
  if (isSubmitting) return;

  const values = readFormValues();
  const errors = validateForm(values);

  clearAllFieldErrors();
  const hasErrors = Object.keys(errors).length > 0;
  if (hasErrors) {
    for (const [key, message] of Object.entries(errors)) {
      showFieldError(key, message);
    }
    return;
  }

  runPrediction(values);
}

function handleFieldBlur(key) {
  if (!FIELD_LIMITS[key]) return;
  const value = document.getElementById(`field-${key}`).value;
  const message = validateNumberField(key, value);
  showFieldError(key, message);
}

// Segmented button group for stress level: clicking a pill sets the
// hidden input's value (what readFormValues() and the payload use) and
// toggles which pill looks selected.
function initSegmentedFields() {
  document.querySelectorAll(".segmented-group").forEach((group) => {
    const wrapper = group.closest("[data-field]");
    const hiddenInput = wrapper.querySelector("input[type=hidden]");
    group.querySelectorAll(".segmented-option").forEach((option) => {
      option.addEventListener("click", () => {
        group
          .querySelectorAll(".segmented-option")
          .forEach((el) => el.classList.toggle("is-active", el === option));
        hiddenInput.value = option.dataset.value;
        showFieldError(wrapper.dataset.field, "");
      });
    });
  });
}

// Clear a select's error as soon as the person picks a real value.
function initSelectErrorClearing() {
  for (const key of Object.keys(REQUIRED_CATEGORICAL_FIELDS)) {
    if (key === "stress_level") continue; // handled by initSegmentedFields
    const select = document.getElementById(`field-${key}`);
    if (select) select.addEventListener("change", () => showFieldError(key, ""));
  }
}

function initScrollTopButton() {
  const button = document.getElementById("scroll-top");
  if (!button) return;
  window.addEventListener("scroll", () => {
    button.hidden = window.scrollY < 400;
  });
  button.addEventListener("click", () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  });
}

function init() {
  populateFormControls();
  initSegmentedFields();
  initSelectErrorClearing();
  initScrollTopButton();

  document.getElementById("predict-form").addEventListener("submit", handleSubmit);
  document.getElementById("result-retry").addEventListener("click", () => {
    if (lastAttemptedValues) runPrediction(lastAttemptedValues);
  });

  for (const key of Object.keys(FIELD_LIMITS)) {
    const input = document.getElementById(`field-${key}`);
    if (input) input.addEventListener("blur", () => handleFieldBlur(key));
  }

  renderResultIdle();

  pollApiStatus();
  setInterval(pollApiStatus, 15000);
}

document.addEventListener("DOMContentLoaded", init);