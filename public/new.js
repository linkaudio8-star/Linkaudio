const scannerState = {
  ggwave: null,
  ggwaveInstance: null,
  ggwaveReady: null,
  sampleRate: 48000,
  audioContext: null,
  audioWorkletRegistered: false,
  stream: null,
  sourceNode: null,
  analyserNode: null,
  processorNode: null,
  recording: false,
  recordedChunks: [],
  countdownTimer: null,
  countdownValue: 0,
  scanTimeout: null,
  activeState: "idle",
  user: null,
  transmissionMode: "audible",
  encodedBlob: null,
  encodedWaveform: null,
  encodedSamples: null,
  encodedBaseSamples: null,
  encodeGain: 1,
  loopingPlayback: false,
  encodeHistory: [],
  billing: {
    plan: "free",
    planUpdatedAt: null,
    subscriptionStatus: null,
    subscriptionPeriodEnd: null,
    lastConfirmedSession: null,
  },
  autoDecodeSampleCount: 0,
  autoDecodeActive: false,
  autoDecodeInProgress: false,
};

const pageType = document.body?.dataset?.page || "index";

const textDecoder = new TextDecoder();
const SCAN_DURATION_SECONDS = 30;
const ENCODE_GAIN_MIN = 0.4;
const ENCODE_GAIN_MAX = 1.6;
const ENCODE_GAIN_DEFAULT = 1;
const ENCODE_GAIN_SLIDER_MIN = Math.round(ENCODE_GAIN_MIN * 100);
const ENCODE_GAIN_SLIDER_MAX = Math.round(ENCODE_GAIN_MAX * 100);
const ENCODE_GAIN_STORAGE_KEY = "audiolink-encode-gain";
let lastEncodeGainStorageKey = null;
const recorderWorkletSource = `class GGWaveRecorder extends AudioWorkletProcessor {
  process(inputs) {
    if (!inputs || inputs.length === 0) return true;
    const channel = inputs[0][0];
    if (!channel) return true;

    const chunk = new Int16Array(channel.length);
    for (let i = 0; i < channel.length; i += 1) {
      const clipped = Math.max(-1, Math.min(1, channel[i]));
      chunk[i] = Math.round(clipped * 0x7fff);
    }

    const buffer = chunk.buffer;
    this.port.postMessage(buffer, [buffer]);
    return true;
  }
}

registerProcessor('ggwave-recorder', GGWaveRecorder);`;

const selectors = {
  openScan: "#scan-now-button",
  overlay: "#scan-overlay",
  closeButtons: "[data-scan-action='close']",
  stopButton: "#scan-stop-button",
  tryAgainButton: "#scan-try-again",
  openLinkButton: "#scan-open-link",
  countdown: "#scan-countdown",
  statusText: "#scan-status",
  resultText: "#scan-result-text",
  toast: "#scan-toast",
  toastMessage: "#scan-toast-message",
  stateContainers: {
    scanning: "#scan-state-scanning",
    success: "#scan-state-success",
    timeout: "#scan-state-timeout",
  },
  waveBars: "[data-scan-wave]",
  loginOverlay: "#login-overlay",
  loginForm: "#login-form",
  loginCloseButtons: "[data-login-action='close']",
  loginEmail: "#login-email",
  loginPassword: "#login-password",
  registerForm: "#register-form",
  registerEmail: "#register-email",
  registerPassword: "#register-password",
  registerConfirmPassword: "#register-confirm-password",
  authModeTabs: "[data-auth-mode-tab]",
  authForms: "[data-auth-form]",
  authError: "#auth-error",
  authTriggers: "[data-auth-trigger]",
  headerLogin: "#header-login",
  headerUser: "#header-user",
  headerUserEmail: "#header-user-email",
  headerLogout: "#header-logout",
  headerGetStarted: "#header-get-started",
  dashboardUserEmail: "#dashboard-user-email",
  dashboardModeLabel: "#dashboard-mode-label",
  dashboardLastResult: "#dashboard-last-result",
  dashboardTotalLinks: "#dashboard-total-links",
  dashboardLastGenerated: "#dashboard-last-generated",
  encodeInput: "#new-encode-input",
  generateButton: "#new-generate-sound",
  playButton: "#new-play-sound",
  playLoopButton: "#new-loop-sound",
  downloadButton: "#new-download-sound",
  previewAudio: "#new-preview-audio",
  encodeVolume: "#encode-volume-slider",
  encodeVolumeValue: "#encode-volume-value",
  upgradeButtons: "[data-upgrade-plan]",
  planPill: "#dashboard-plan-pill",
  modeLabel: "#mode-toggle-label",
  modeAudible: "#mode-audible",
  modeUltrasound: "#mode-ultrasound",
  historyList: "#encode-history-list",
  historyEmpty: "#encode-history-empty",
  historyCount: "#encode-history-count",
  heroLogin: "#hero-login",
  dashboardScanButton: "#dashboard-scan-button",
  lastDecodeCard: "#last-decode-card",
  lastDecodeText: "#last-decode-text",
  lastDecodeLink: "#last-decode-link",
  scanButtonSpinner: "#scan-button-spinner",
  scanButtonIcon: "#scan-button-icon",
  scanButtonLabel: "#scan-button-label",
  inlineScanStatus: "#inline-scan-status",
  checkoutSuccessCard: "#checkout-success-card",
  checkoutCancelCard: "#checkout-cancel-card",
  checkoutSuccessSession: "#checkout-success-session",
  checkoutSuccessDismiss: "#checkout-success-dismiss",
  checkoutCancelDismiss: "#checkout-cancel-dismiss",
};

const dom = {};

function cacheDom() {
  dom.openScan = document.querySelector(selectors.openScan);
  dom.overlay = document.querySelector(selectors.overlay);
  dom.closeButtons = Array.from(document.querySelectorAll(selectors.closeButtons));
  dom.stopButton = document.querySelector(selectors.stopButton);
  dom.tryAgainButton = document.querySelector(selectors.tryAgainButton);
  dom.openLinkButton = document.querySelector(selectors.openLinkButton);
  dom.countdown = document.querySelector(selectors.countdown);
  dom.statusText = document.querySelector(selectors.statusText);
  dom.resultText = document.querySelector(selectors.resultText);
  dom.toast = document.querySelector(selectors.toast);
  dom.toastMessage = document.querySelector(selectors.toastMessage);
  dom.waveBars = Array.from(document.querySelectorAll(selectors.waveBars));
  dom.stateContainers = {
    scanning: document.querySelector(selectors.stateContainers.scanning),
    success: document.querySelector(selectors.stateContainers.success),
    timeout: document.querySelector(selectors.stateContainers.timeout),
  };
  dom.loginOverlay = document.querySelector(selectors.loginOverlay);
  dom.loginForm = document.querySelector(selectors.loginForm);
  dom.loginCloseButtons = Array.from(document.querySelectorAll(selectors.loginCloseButtons));
  dom.loginEmail = document.querySelector(selectors.loginEmail);
  dom.loginPassword = document.querySelector(selectors.loginPassword);
  dom.registerForm = document.querySelector(selectors.registerForm);
  dom.registerEmail = document.querySelector(selectors.registerEmail);
  dom.registerPassword = document.querySelector(selectors.registerPassword);
  dom.registerConfirmPassword = document.querySelector(selectors.registerConfirmPassword);
  dom.authModeTabs = Array.from(document.querySelectorAll(selectors.authModeTabs));
  dom.authForms = Array.from(document.querySelectorAll(selectors.authForms));
  dom.authError = document.querySelector(selectors.authError);
  dom.authTriggers = Array.from(document.querySelectorAll(selectors.authTriggers));
  dom.headerLogin = document.querySelector(selectors.headerLogin);
  dom.headerUser = document.querySelector(selectors.headerUser);
  dom.headerUserEmail = document.querySelector(selectors.headerUserEmail);
  dom.headerLogout = document.querySelector(selectors.headerLogout);
  dom.headerGetStarted = document.querySelector(selectors.headerGetStarted);
  dom.dashboardUserEmail = document.querySelector(selectors.dashboardUserEmail);
  dom.dashboardModeLabel = document.querySelector(selectors.dashboardModeLabel);
  dom.dashboardLastResult = document.querySelector(selectors.dashboardLastResult);
  dom.dashboardTotalLinks = document.querySelector(selectors.dashboardTotalLinks);
  dom.dashboardLastGenerated = document.querySelector(selectors.dashboardLastGenerated);
  dom.encodeInput = document.querySelector(selectors.encodeInput);
  dom.generateButton = document.querySelector(selectors.generateButton);
  dom.playButton = document.querySelector(selectors.playButton);
  dom.playLoopButton = document.querySelector(selectors.playLoopButton);
  dom.playLoopLabel = dom.playLoopButton
    ? dom.playLoopButton.querySelector("[data-loop-label]")
    : null;
  dom.downloadButton = document.querySelector(selectors.downloadButton);
  dom.previewAudio = document.querySelector(selectors.previewAudio);
  dom.encodeVolume = document.querySelector(selectors.encodeVolume);
  dom.encodeVolumeValue = document.querySelector(selectors.encodeVolumeValue);
  dom.upgradeButtons = Array.from(document.querySelectorAll(selectors.upgradeButtons || []));
  dom.planPill = document.querySelector(selectors.planPill);
  dom.modeLabel = document.querySelector(selectors.modeLabel);
  dom.modeAudible = document.querySelector(selectors.modeAudible);
  dom.modeUltrasound = document.querySelector(selectors.modeUltrasound);
  dom.historyList = document.querySelector(selectors.historyList);
  dom.historyEmpty = document.querySelector(selectors.historyEmpty);
  dom.historyCount = document.querySelector(selectors.historyCount);
  dom.heroLogin = document.querySelector(selectors.heroLogin);
  dom.dashboardScanButton = document.querySelector(selectors.dashboardScanButton);
  dom.lastDecodeCard = document.querySelector(selectors.lastDecodeCard);
  dom.lastDecodeText = document.querySelector(selectors.lastDecodeText);
  dom.lastDecodeLink = document.querySelector(selectors.lastDecodeLink);
  dom.scanButtonSpinner = document.querySelector(selectors.scanButtonSpinner);
  dom.scanButtonIcon = document.querySelector(selectors.scanButtonIcon);
  dom.scanButtonLabel = document.querySelector(selectors.scanButtonLabel);
  dom.inlineScanStatus = document.querySelector(selectors.inlineScanStatus);
  dom.checkoutSuccessCard = document.querySelector(selectors.checkoutSuccessCard);
  dom.checkoutCancelCard = document.querySelector(selectors.checkoutCancelCard);
  dom.checkoutSuccessSession = document.querySelector(selectors.checkoutSuccessSession);
  dom.checkoutSuccessDismiss = document.querySelector(selectors.checkoutSuccessDismiss);
  dom.checkoutCancelDismiss = document.querySelector(selectors.checkoutCancelDismiss);
  dom.nextPaymentLabel = document.querySelector("#dashboard-next-payment");
}

function showToast(message) {
  if (!dom.toast || !dom.toastMessage) return;
  dom.toastMessage.textContent = message;
  dom.toast.classList.add("opacity-100");
  dom.toast.classList.remove("pointer-events-none");
  window.setTimeout(() => {
    dom.toast.classList.remove("opacity-100");
    dom.toast.classList.add("pointer-events-none");
  }, 2600);
}

const MAX_HISTORY_ITEMS = 12;
const AUTH_MODES = {
  LOGIN: "login",
  REGISTER: "register",
};
let activeAuthMode = AUTH_MODES.LOGIN;

function clearAuthError() {
  if (!dom.authError) return;
  dom.authError.textContent = "";
  dom.authError.classList.add("hidden");
}

function setAuthError(message) {
  if (!dom.authError) return;
  if (message) {
    dom.authError.textContent = message;
    dom.authError.classList.remove("hidden");
  } else {
    clearAuthError();
  }
}

function setAuthMode(mode) {
  const normalized = mode === AUTH_MODES.REGISTER ? AUTH_MODES.REGISTER : AUTH_MODES.LOGIN;
  activeAuthMode = normalized;
  if (Array.isArray(dom.authForms)) {
    dom.authForms.forEach((form) => {
      const formMode = form.dataset.authForm;
      const isActive = formMode === normalized;
      form.classList.toggle("hidden", !isActive);
    });
  }
  if (Array.isArray(dom.authModeTabs)) {
    dom.authModeTabs.forEach((tab) => {
      const tabMode = tab.dataset.authModeTab;
      const isActive = tabMode === normalized;
      tab.classList.toggle("bg-white", isActive);
      tab.classList.toggle("shadow-sm", isActive);
      tab.classList.toggle("text-slate-800", isActive);
      tab.classList.toggle("text-slate-500", !isActive);
    });
  }
  clearAuthError();
  const overlayVisible = dom.loginOverlay && !dom.loginOverlay.classList.contains("hidden");
  if (!overlayVisible) {
    return;
  }
  if (normalized === AUTH_MODES.LOGIN) {
    dom.loginEmail?.focus();
  } else {
    dom.registerEmail?.focus();
  }
}

function setButtonLoadingState(button, isLoading, loadingLabel) {
  if (!button) return;
  if (isLoading) {
    if (!button.dataset.originalText) {
      button.dataset.originalText = button.textContent || "";
    }
    button.disabled = true;
    button.textContent = loadingLabel;
  } else {
    button.disabled = false;
    if (button.dataset.originalText !== undefined) {
      button.textContent = button.dataset.originalText;
      delete button.dataset.originalText;
    }
  }
}

async function apiRequest(path, { method = "GET", body, headers } = {}) {
  const options = {
    method,
    credentials: "include",
    headers: {
      Accept: "application/json",
      ...headers,
    },
  };
  if (body !== undefined) {
    options.headers["Content-Type"] = "application/json";
    options.body = JSON.stringify(body);
  }
  const response = await fetch(path, options);
  const contentType = response.headers.get("content-type") || "";
  let payload = null;
  if (contentType.includes("application/json")) {
    payload = await response.json();
  } else {
    payload = await response.text();
  }
  if (!response.ok) {
    try {
      console.error("API request failed", {
        method,
        requestedPath: path,
        resolvedUrl: response.url,
        status: response.status,
        payload,
      });
    } catch (logErr) {
      console.warn("Failed to log API error details", logErr);
    }
    const error = new Error(
      (payload && payload.error) || (typeof payload === "string" ? payload : "Request failed"),
    );
    error.status = response.status;
    error.body = payload;
    throw error;
  }
  return payload;
}

async function fetchActiveSession() {
  try {
    const session = await apiRequest("/api/session");
    if (session && session.authenticated && session.user) {
      return session.user;
    }
  } catch (err) {
    console.warn("Failed to fetch session", err);
  }
  return null;
}

async function performLogin(email, password) {
  const result = await apiRequest("/api/login", {
    method: "POST",
    body: { email, password },
  });
  if (result && result.user) {
    return result.user;
  }
  return null;
}

async function performRegister(email, password) {
  const result = await apiRequest("/api/register", {
    method: "POST",
    body: { email, password },
  });
  if (result && result.user) {
    return result.user;
  }
  return null;
}

async function performLogout() {
  try {
    await apiRequest("/api/logout", { method: "POST" });
  } catch (err) {
    console.warn("Failed to log out", err);
  }
}

async function startPlanCheckout(plan, button) {
  const targetPlan = plan || "pro";
  if (scannerState.billing?.plan === "pro") {
    showToast("You're already on the Pro plan.");
    return;
  }
  setButtonLoadingState(button, true, "Redirecting…");
  try {
    const response = await apiRequest(`/api/checkout/${targetPlan}`, {
      method: "POST",
      body: {
        plan: targetPlan,
        email: scannerState.user?.email || null,
      },
    });
    if (response && response.url) {
      window.location.href = response.url;
      return;
    }
    throw new Error("Checkout link unavailable.");
  } catch (err) {
    console.error("Checkout failed", err);
    showToast(err.body?.error || err.message || "Unable to start checkout.");
  } finally {
    setButtonLoadingState(button, false);
  }
}

function handleCheckoutNotices() {
  if (!dom.checkoutSuccessCard && !dom.checkoutCancelCard) return;
  const params = new URLSearchParams(window.location.search);
  const status = params.get("checkout");
  const sessionId = params.get("session_id");

  const hideCards = () => {
    dom.checkoutSuccessCard?.classList.add("hidden");
    dom.checkoutCancelCard?.classList.add("hidden");
    dom.checkoutSuccessSession?.classList.add("hidden");
  };

  if (status === "success" && dom.checkoutSuccessCard) {
    dom.checkoutSuccessCard.classList.remove("hidden");
    if (dom.checkoutSuccessSession) {
      if (sessionId) {
        dom.checkoutSuccessSession.textContent = sessionId;
        dom.checkoutSuccessSession.classList.remove("hidden");
      } else {
        dom.checkoutSuccessSession.classList.add("hidden");
      }
    }
    dom.checkoutSuccessDismiss?.addEventListener("click", hideCards, { once: true });
    if (sessionId) {
      void confirmCheckoutSession(sessionId);
    } else {
      void refreshBillingStatus();
    }
  } else if (status === "cancelled" && dom.checkoutCancelCard) {
    dom.checkoutCancelCard.classList.remove("hidden");
    dom.checkoutCancelDismiss?.addEventListener("click", hideCards, { once: true });
    void refreshBillingStatus();
  }

  if (status) {
    params.delete("checkout");
    if (sessionId) params.delete("session_id");
    const cleaned = `${window.location.pathname}${params.toString() ? `?${params.toString()}` : ""}${
      window.location.hash
    }`;
    window.history.replaceState({}, document.title, cleaned);
  }
}

function getEncodeHistoryKey() {
  if (!scannerState.user || !scannerState.user.email) return null;
  return `new-encode-history-${scannerState.user.email}`;
}

function loadEncodeHistory() {
  const key = getEncodeHistoryKey();
  if (!key) {
    scannerState.encodeHistory = [];
    return;
  }
  try {
    const raw = localStorage.getItem(key);
    if (!raw) {
      scannerState.encodeHistory = [];
      return;
    }
    const parsed = JSON.parse(raw);
    scannerState.encodeHistory = Array.isArray(parsed)
      ? parsed
          .filter((item) => item && item.url)
          .map((item) => ({
            id: item.id || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            text: item.text || "",
            url: item.url,
            timestamp: item.timestamp || Date.now(),
            mode: item.mode === "ultrasound" ? "ultrasound" : "audible",
            scanCount: typeof item.scanCount === "number" && Number.isFinite(item.scanCount) ? item.scanCount : 0,
            lastScan: typeof item.lastScan === "number" && Number.isFinite(item.lastScan) ? item.lastScan : null,
            scanEvents: Array.isArray(item.scanEvents)
              ? item.scanEvents
                  .map((value) => {
                    const ts = Number(value);
                    return Number.isFinite(ts) ? ts : null;
                  })
                  .filter((value) => value !== null)
              : [],
          }))
      : [];
  } catch (err) {
    console.warn("Failed to parse encode history", err);
    scannerState.encodeHistory = [];
  }
  if (scannerState.encodeHistory.length > MAX_HISTORY_ITEMS) {
    scannerState.encodeHistory.length = MAX_HISTORY_ITEMS;
  }
}

function saveEncodeHistory() {
  const key = getEncodeHistoryKey();
  if (!key) return;
  try {
    localStorage.setItem(key, JSON.stringify(scannerState.encodeHistory));
  } catch (err) {
    console.warn("Failed to persist encode history", err);
  }
}

function formatRelativeTime(value) {
  if (!value) return "Just now";
  const timestamp = typeof value === "number" ? value : Date.parse(value);
  if (Number.isNaN(timestamp)) {
    return "Just now";
  }
  const diff = Date.now() - timestamp;
  const seconds = Math.max(0, Math.round(diff / 1000));
  const intervals = [
    { label: "d", seconds: 86400 },
    { label: "h", seconds: 3600 },
    { label: "m", seconds: 60 },
  ];
  for (const interval of intervals) {
    if (seconds >= interval.seconds) {
      const count = Math.floor(seconds / interval.seconds);
      return `${count}${interval.label} ago`;
    }
  }
  return "Just now";
}

function renderEncodeHistory() {
  if (!dom.historyList || !dom.historyEmpty || !dom.historyCount) return;
  const items = scannerState.encodeHistory;
  dom.historyList.innerHTML = "";

  if (!items.length) {
    dom.historyEmpty.classList.remove("hidden");
    dom.historyCount.textContent = "0 items";
    return;
  }

  const totalScans = items.reduce((acc, item) => acc + (Number(item.scanCount) || 0), 0);
  dom.historyEmpty.classList.add("hidden");
  dom.historyCount.textContent = `${items.length} item${items.length === 1 ? "" : "s"} • ${totalScans} scan${totalScans === 1 ? "" : "s"}`;

  const createIconButton = (label, svgMarkup, handler) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className =
      "history-icon-button inline-flex flex-1 items-center justify-center rounded-2xl border border-slate-100 bg-white px-3 py-2 text-xs font-semibold text-slate-600 transition hover:border-slate-200 hover:text-slate-900";
    button.innerHTML = `${svgMarkup}<span class="sr-only">${label}</span>`;
    button.addEventListener("click", handler);
    return button;
  };

  items.forEach((entry) => {
    const li = document.createElement("li");
    li.className =
      "rounded-3xl border border-slate-100 bg-white/95 p-5 shadow-[0_15px_50px_-30px_rgba(15,23,42,0.35)]";

    const header = document.createElement("div");
    header.className = "flex items-start justify-between gap-3";
    const titleWrap = document.createElement("div");
    const displayText = entry.url || entry.text || "Untitled link";
    titleWrap.innerHTML = `<p class="break-words text-base font-semibold text-slate-900">${displayText}</p><p class="text-xs text-slate-400">${formatRelativeTime(entry.timestamp)}</p>`;
    header.appendChild(titleWrap);
    const modeBadge = document.createElement("span");
    modeBadge.className = "rounded-full bg-[#f4f5ff] px-3 py-1 text-xs font-semibold text-slate-500";
    modeBadge.textContent = entry.mode === "ultrasound" ? "Ultrasound" : "Audible";
    header.appendChild(modeBadge);
    li.appendChild(header);

    const stats = document.createElement("div");
    const scanCount = typeof entry.scanCount === "number" ? entry.scanCount : 0;
    const lastScanLabel = entry.lastScan ? formatRelativeTime(entry.lastScan) : "No scans yet";
    stats.className = "mt-4 flex flex-wrap items-center gap-3 text-xs text-slate-500";
    stats.innerHTML = `<span class="inline-flex items-center gap-1"><svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5 text-[#8b5cf6]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M4 12h16M4 6h16M4 18h16" /></svg>${scanCount} scan${scanCount === 1 ? "" : "s"}</span><span>Last scan: ${lastScanLabel}</span>`;
    li.appendChild(stats);

    const controls = document.createElement("div");
    controls.className = "mt-4 grid grid-cols-3 gap-2";
    controls.appendChild(
      createIconButton(
        "Play link",
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="currentColor" d="M8 5v14l11-7z"/></svg>',
        () => {
          void handleHistoryAction(entry, "play");
        },
      ),
    );
    controls.appendChild(
      createIconButton(
        "Loop playback",
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M4 12a8 8 0 0113.856-4.856M20 12a8 8 0 01-13.856 4.856M12 6v6l3 3"/></svg>',
        () => {
          void handleHistoryAction(entry, "loop");
        },
      ),
    );
    controls.appendChild(
      createIconButton(
        "Download audio",
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M6 20h12M12 4v10m0 0l4-4m-4 4l-4-4"/></svg>',
        () => {
          void handleHistoryAction(entry, "download");
        },
      ),
    );
    li.appendChild(controls);

    const secondaryControls = document.createElement("div");
    secondaryControls.className = "mt-4 grid gap-2 text-xs text-slate-500 sm:grid-cols-2";
    const openBtn = document.createElement("button");
    openBtn.type = "button";
    openBtn.className =
      "flex-1 rounded-2xl border border-slate-100 bg-white px-4 py-2 text-left font-semibold text-slate-600";
    openBtn.textContent = "Open link";
    openBtn.addEventListener("click", () => {
      const normalized = entry.url ? normalizeUrl(entry.url) : null;
      if (normalized) {
        window.open(normalized, "_blank", "noopener");
      }
    });
    const copyBtn = document.createElement("button");
    copyBtn.type = "button";
    copyBtn.className =
      "flex-1 rounded-2xl border border-slate-100 bg-white px-4 py-2 text-left font-semibold text-slate-600";
    copyBtn.textContent = "Copy text";
    copyBtn.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(entry.text || entry.url || "");
        showToast("Copied to clipboard.");
      } catch (err) {
        console.warn("Clipboard copy failed", err);
        showToast("Copy failed. Try again.");
      }
    });
    secondaryControls.appendChild(openBtn);
    secondaryControls.appendChild(copyBtn);
    li.appendChild(secondaryControls);

    const loopToggle = document.createElement("button");
    loopToggle.type = "button";
    loopToggle.className =
      "mt-4 inline-flex w-full items-center gap-3 rounded-2xl border border-slate-100 bg-[#f8f9ff] px-4 py-2 text-left text-xs font-semibold text-slate-600";
    loopToggle.innerHTML =
      '<span class="inline-flex h-4 w-7 items-center rounded-full bg-slate-300"><span class="block h-4 w-4 rounded-full bg-white shadow"></span></span><span>Loop in background</span>';
    loopToggle.addEventListener("click", () => {
      void handleHistoryAction(entry, "loop");
    });
    li.appendChild(loopToggle);

    dom.historyList.appendChild(li);
  });
}


function updateModeUI() {
  if (dom.modeLabel) {
    dom.modeLabel.textContent = scannerState.transmissionMode === "ultrasound" ? "Ultrasound Mode" : "Audible Mode";
  }
  if (dom.modeAudible && dom.modeUltrasound) {
    const isAudible = scannerState.transmissionMode === "audible";
    const isUltra = scannerState.transmissionMode === "ultrasound";
    dom.modeAudible.classList.toggle("bg-white", isAudible);
    dom.modeAudible.classList.toggle("shadow", isAudible);
    dom.modeAudible.classList.toggle("text-slate-900", isAudible);
    dom.modeAudible.classList.toggle("text-slate-500", !isAudible);
    dom.modeUltrasound.classList.toggle("bg-white", isUltra);
    dom.modeUltrasound.classList.toggle("shadow", isUltra);
    dom.modeUltrasound.classList.toggle("text-slate-900", isUltra);
    dom.modeUltrasound.classList.toggle("text-slate-500", !isUltra);
  }
  if (dom.dashboardModeLabel) {
    dom.dashboardModeLabel.textContent = scannerState.transmissionMode === "ultrasound" ? "Ultrasound" : "Audible";
  }
  document.querySelectorAll("[data-mode-label-secondary]").forEach((node) => {
    node.textContent = scannerState.transmissionMode === "ultrasound" ? "Ultrasound" : "Audible";
  });
}

function resetBillingState() {
  scannerState.billing = {
    plan: "free",
    planUpdatedAt: null,
    subscriptionStatus: null,
    subscriptionPeriodEnd: null,
    lastConfirmedSession: null,
  };
  updatePlanUI();
}

function updateBillingState(partial) {
  scannerState.billing = {
    ...scannerState.billing,
    ...partial,
  };
  if (scannerState.user) {
    scannerState.user.plan = scannerState.billing.plan;
    scannerState.user.planUpdatedAt = scannerState.billing.planUpdatedAt;
    scannerState.user.stripeSubscriptionStatus = scannerState.billing.subscriptionStatus;
    scannerState.user.stripeSubscriptionPeriodEnd = scannerState.billing.subscriptionPeriodEnd;
  }
  updatePlanUI();
}

function hydratePlanFromUser(user) {
  if (!user) {
    resetBillingState();
    return;
  }
  updateBillingState({
    plan: user.plan || "free",
    planUpdatedAt: user.planUpdatedAt || null,
    subscriptionStatus: user.stripeSubscriptionStatus || null,
    subscriptionPeriodEnd: user.stripeSubscriptionPeriodEnd || null,
  });
}

function getPlanDisplay(plan) {
  const normalized = plan === "pro" ? "pro" : "free";
  return normalized === "pro" ? "Pro Plan" : "Free Plan";
}

function updatePlanUI() {
  const plan = scannerState.billing?.plan || "free";
  const display = getPlanDisplay(plan);
  const isPro = plan === "pro";
  if (dom.planPill) {
    dom.planPill.textContent = display;
    dom.planPill.classList.toggle("bg-white/80", !isPro);
    dom.planPill.classList.toggle("text-slate-600", !isPro);
    dom.planPill.classList.toggle("border-slate-100", !isPro);
    dom.planPill.classList.toggle("bg-violet-50", isPro);
    dom.planPill.classList.toggle("text-violet-700", isPro);
    dom.planPill.classList.toggle("border-violet-200", isPro);
  }
  dom.upgradeButtons?.forEach((button) => {
    if (!button.dataset.originalText) {
      button.dataset.originalText = button.textContent || "";
    }
    if (!button.dataset.proText) {
      button.dataset.proText = "Pro plan active";
    }
    button.disabled = isPro;
    if (isPro) {
      button.textContent = button.dataset.proText;
      button.classList.add("opacity-60", "cursor-not-allowed");
    } else {
      button.textContent = button.dataset.originalText;
      button.classList.remove("opacity-60", "cursor-not-allowed");
    }
  });
  if (dom.nextPaymentLabel) {
    if (isPro) {
      const nextPayment = scannerState.billing?.subscriptionPeriodEnd
        ? formatNextPayment(scannerState.billing.subscriptionPeriodEnd)
        : "Included in current period";
      dom.nextPaymentLabel.textContent = nextPayment;
    } else {
      dom.nextPaymentLabel.textContent = "Upgrade to unlock";
    }
  }
}

function formatNextPayment(isoString) {
  if (!isoString) return "Included in current period";
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) {
    return "Included in current period";
  }
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

async function refreshBillingStatus() {
  if (!scannerState.user) return;
  try {
    const status = await apiRequest("/api/billing/status");
    if (status) {
      updateBillingState({
        plan: status.plan || "free",
        planUpdatedAt: status.planUpdatedAt || null,
        subscriptionStatus: status.stripeSubscriptionStatus || null,
        subscriptionPeriodEnd: status.stripeSubscriptionPeriodEnd || null,
      });
    }
  } catch (err) {
    if (err && err.status === 401) {
      resetBillingState();
    } else {
      console.warn("Failed to refresh billing status", err);
    }
  }
}

async function confirmCheckoutSession(sessionId) {
  if (!sessionId) return;
  if (scannerState.billing.lastConfirmedSession === sessionId) {
    return;
  }
  try {
    const result = await apiRequest("/api/billing/confirm", {
      method: "POST",
      body: { sessionId },
    });
    if (result) {
      scannerState.billing.lastConfirmedSession = sessionId;
      updateBillingState({
        plan: result.plan || "pro",
        planUpdatedAt: result.planUpdatedAt || new Date().toISOString(),
        subscriptionStatus: result.stripeSubscriptionStatus || null,
        subscriptionPeriodEnd: result.stripeSubscriptionPeriodEnd || null,
      });
      showToast("Pro subscription activated.");
    }
  } catch (err) {
    console.error("Failed to confirm checkout session", err);
    showToast(err.body?.error || err.message || "Unable to confirm subscription.");
    await refreshBillingStatus();
  }
}

function setTransmissionMode(mode) {
  const normalized = mode === "ultrasound" ? "ultrasound" : "audible";
  scannerState.transmissionMode = normalized;
  updateModeUI();
  showToast(`${normalized === "ultrasound" ? "Ultrasound" : "Audible"} mode active for encoding.`);
}

function updateDashboardStats() {
  if (dom.dashboardTotalLinks) {
    dom.dashboardTotalLinks.textContent = String(scannerState.encodeHistory.length);
  }
  if (dom.dashboardLastGenerated) {
    const last = scannerState.encodeHistory[0];
    dom.dashboardLastGenerated.textContent = last
      ? new Date(last.timestamp).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
      : "—";
  }
}

function updateLastResultDisplays(value) {
  if (dom.dashboardLastResult) {
    dom.dashboardLastResult.textContent = value;
  }
  document.querySelectorAll("[data-last-result-secondary]").forEach((node) => {
    node.textContent = value;
  });
  updateLandingDecodeCard(value);
}

function updateLandingDecodeCard(value) {
  if (!dom.lastDecodeCard) return;
  const trimmed = (value || "").trim();
  if (!trimmed || trimmed === "None") {
    dom.lastDecodeCard.classList.add("hidden");
    if (dom.lastDecodeLink) {
      dom.lastDecodeLink.classList.add("hidden");
      dom.lastDecodeLink.removeAttribute("href");
      dom.lastDecodeLink.textContent = "";
    }
    if (dom.lastDecodeText) {
      dom.lastDecodeText.textContent = "";
    }
    return;
  }

  dom.lastDecodeCard.classList.remove("hidden");
  if (dom.lastDecodeText) {
    dom.lastDecodeText.textContent = trimmed;
  }

  const detectedUrl = detectFirstUrl(trimmed);
  if (dom.lastDecodeLink) {
    if (detectedUrl) {
      const normalized = normalizeUrl(detectedUrl);
      dom.lastDecodeLink.href = normalized || detectedUrl;
      let label = detectedUrl;
      try {
        if (normalized) {
          label = new URL(normalized).hostname;
        }
      } catch (err) {
        label = detectedUrl;
      }
      dom.lastDecodeLink.textContent = label;
      dom.lastDecodeLink.classList.remove("hidden");
    } else {
      dom.lastDecodeLink.classList.add("hidden");
      dom.lastDecodeLink.removeAttribute("href");
      dom.lastDecodeLink.textContent = "";
    }
  }
}

function incrementEncodeHistoryScanCount(rawValue) {
  if (!scannerState.user) return;
  const trimmed = (rawValue || "").trim();
  if (!trimmed) return;
  const detectedUrl = detectFirstUrl(trimmed);
  const key = detectedUrl ? normalizeUrl(detectedUrl) : trimmed;
  if (!key) return;
  const entry = scannerState.encodeHistory.find((item) => item.url === key);
  if (!entry) return;
  entry.scanCount = (entry.scanCount || 0) + 1;
  const now = Date.now();
  entry.lastScan = now;
  if (!Array.isArray(entry.scanEvents)) {
    entry.scanEvents = [];
  }
  entry.scanEvents.push(now);
  const MAX_EVENTS = 12;
  if (entry.scanEvents.length > MAX_EVENTS) {
    entry.scanEvents.splice(0, entry.scanEvents.length - MAX_EVENTS);
  }
  saveEncodeHistory();
  renderEncodeHistory();
  updateDashboardStats();
}

function handleDecodingSuccess(displayText) {
  const detectedUrl = detectFirstUrl(displayText);
  if (dom.resultText) {
    dom.resultText.textContent = displayText;
  }
  if (dom.openLinkButton) {
    if (detectedUrl) {
      const normalized = normalizeUrl(detectedUrl);
      dom.openLinkButton.dataset.url = normalized || "";
      dom.openLinkButton.classList.remove("hidden");
    } else {
      dom.openLinkButton.dataset.url = "";
      dom.openLinkButton.classList.add("hidden");
    }
  }
  incrementEncodeHistoryScanCount(displayText);
  updateLastResultDisplays(displayText);
  setScanState("success");
  showToast("Decoded a message successfully.");
}

function finishAutoDecode(displayText) {
  scannerState.autoDecodeActive = false;
  scannerState.autoDecodeSampleCount = 0;
  scannerState.autoDecodeInProgress = false;
  resetCountdown();
  cleanupRecordingNodes();
  stopStream();
  scannerState.recording = false;
  scannerState.recordedChunks = [];
  handleDecodingSuccess(displayText);
}

function decodeBufferWithScratch(int16Data) {
  if (!scannerState.ggwave) return "";
  try {
    const module = scannerState.ggwave;
    const params = module.getDefaultParameters();
    params.sampleRateInp = scannerState.sampleRate;
    params.sampleRateOut = scannerState.sampleRate;
    params.sampleFormatInp = module.SampleFormat.GGWAVE_SAMPLE_FORMAT_I16;
    params.sampleFormatOut = module.SampleFormat.GGWAVE_SAMPLE_FORMAT_I16;
    params.operatingMode = module.GGWAVE_OPERATING_MODE_RX;
    const instance = module.init(params);
    if (instance === undefined || instance === null) {
      return "";
    }
    try {
      const byteView = new Int8Array(int16Data.buffer.slice(0));
      const decoded = module.decode(instance, byteView);
      if (decoded && decoded.length) {
        let end = decoded.length;
        while (end > 0 && decoded[end - 1] === 0) {
          end -= 1;
        }
        if (end > 0) {
          const trimmed = decoded.subarray(0, end);
          return textDecoder.decode(trimmed).trim();
        }
      }
    } finally {
      try {
        module.free(instance);
      } catch (err) {
        console.warn("Failed to free scratch ggwave instance", err);
      }
    }
  } catch (err) {
    console.warn("Scratch decode failed", err);
  }
  return "";
}

function maybeAutoDecode() {
  if (!scannerState.recording || !scannerState.autoDecodeActive) return;
  if (scannerState.autoDecodeInProgress) return;
  const threshold = Math.max(1024, Math.round(scannerState.sampleRate * 0.8));
  if (scannerState.autoDecodeSampleCount < threshold) {
    return;
  }
  scannerState.autoDecodeInProgress = true;
  try {
    const merged = mergeInt16Chunks(scannerState.recordedChunks);
    if (!merged.length) {
      return;
    }
    let maxAmplitude = 0;
    for (let i = 0; i < merged.length; i += 1) {
      const sample = Math.abs(merged[i]);
      if (sample > maxAmplitude) {
        maxAmplitude = sample;
      }
    }
    if (maxAmplitude > 0 && maxAmplitude < 5000) {
      const scale = Math.min(6, 20000 / maxAmplitude);
      for (let i = 0; i < merged.length; i += 1) {
        merged[i] = Math.max(-32768, Math.min(32767, Math.round(merged[i] * scale)));
      }
    }
    const displayText = decodeBufferWithScratch(merged);
    if (displayText) {
      finishAutoDecode(displayText);
      return;
    }
  } catch (err) {
    console.warn("Auto decode attempt failed", err);
  } finally {
    scannerState.autoDecodeSampleCount = 0;
    scannerState.autoDecodeInProgress = false;
  }
}

function applyUserState() {
  hydratePlanFromUser(scannerState.user);
  restoreEncodeGain();
  updateEncodeGainUI();
  if (scannerState.encodedBaseSamples) {
    renderEncodedAudio({ skipHistory: true, resetPlayback: false });
  }

  const loggedIn = !!(scannerState.user && scannerState.user.email);
  if (dom.headerLogin) {
    dom.headerLogin.classList.toggle("hidden", loggedIn);
  }
  if (dom.headerUser) {
    dom.headerUser.classList.toggle("hidden", !loggedIn);
  }
  if (dom.headerGetStarted) {
    dom.headerGetStarted.classList.toggle("hidden", loggedIn);
  }
  if (dom.headerUserEmail) {
    dom.headerUserEmail.textContent = scannerState.user?.email || "";
  }
  if (dom.dashboardUserEmail) {
    dom.dashboardUserEmail.textContent = scannerState.user?.email || "—";
  }

  if (loggedIn) {
    loadEncodeHistory();
    renderEncodeHistory();
    updateDashboardStats();
    const last = scannerState.encodeHistory[0];
    updateLastResultDisplays(last ? last.text : "None");
  } else {
    scannerState.encodeHistory = [];
    if (dom.historyList) dom.historyList.innerHTML = "";
    if (dom.historyEmpty) dom.historyEmpty.classList.remove("hidden");
    if (dom.historyCount) dom.historyCount.textContent = "0 items";
    updateDashboardStats();
    updateLastResultDisplays("None");
  }
}

function openLoginOverlay({ mode } = {}) {
  if (!dom.loginOverlay) return;
  dom.loginOverlay.classList.remove("hidden");
  dom.loginOverlay.setAttribute("aria-hidden", "false");
  setAuthMode(mode || activeAuthMode);
}

function closeLoginOverlay() {
  if (!dom.loginOverlay) return;
  dom.loginOverlay.classList.add("hidden");
  dom.loginOverlay.setAttribute("aria-hidden", "true");
  if (dom.loginForm) {
    dom.loginForm.reset();
  }
  if (dom.registerForm) {
    dom.registerForm.reset();
  }
  clearAuthError();
  activeAuthMode = AUTH_MODES.LOGIN;
  setAuthMode(activeAuthMode);
}

async function rebuildGGWave(sampleRateOverride) {
  if (!window.ggwave_factory) {
    throw new Error("ggwave library not loaded. Check vendor script.");
  }

  if (scannerState.ggwaveReady) {
    await scannerState.ggwaveReady;
  }

  scannerState.ggwaveReady = (async () => {
    if (typeof sampleRateOverride === "number" && Number.isFinite(sampleRateOverride)) {
      scannerState.sampleRate = Math.round(sampleRateOverride);
    }

    if (scannerState.ggwave && scannerState.ggwaveInstance !== null) {
      try {
        scannerState.ggwave.free(scannerState.ggwaveInstance);
      } catch (err) {
        console.warn("Failed to free previous ggwave instance", err);
      }
      scannerState.ggwaveInstance = null;
    }

    const module = await window.ggwave_factory();
    try {
      module.disableLog();
    } catch (err) {
      console.warn("Unable to disable ggwave logs", err);
    }

    const params = module.getDefaultParameters();
    params.sampleRateInp = scannerState.sampleRate;
    params.sampleRateOut = scannerState.sampleRate;
    params.sampleFormatInp = module.SampleFormat.GGWAVE_SAMPLE_FORMAT_I16;
    params.sampleFormatOut = module.SampleFormat.GGWAVE_SAMPLE_FORMAT_I16;
    params.operatingMode = module.GGWAVE_OPERATING_MODE_RX_AND_TX;
    const instance = module.init(params);
    if (instance === undefined || instance === null) {
      throw new Error("Received invalid ggwave instance pointer");
    }

    scannerState.ggwave = module;
    scannerState.ggwaveInstance = instance;
  })();

  try {
    await scannerState.ggwaveReady;
  } finally {
    scannerState.ggwaveReady = null;
  }
}

async function ensureAudioContext() {
  if (!scannerState.audioContext) {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) {
      throw new Error("Web Audio API is not supported in this browser.");
    }
    const context = new AudioContext();
    scannerState.audioContext = context;
    scannerState.audioWorkletRegistered = false;

    const actualRate = Math.round(context.sampleRate);
    if (actualRate !== scannerState.sampleRate) {
      try {
        await rebuildGGWave(actualRate);
      } catch (err) {
        console.error("Failed to rebuild ggwave with new sample rate", err);
      }
    }
    return context;
  }

  if (scannerState.audioContext.state === "suspended") {
    await scannerState.audioContext.resume();
  }

  return scannerState.audioContext;
}

function cleanupRecordingNodes() {
  const { processorNode, analyserNode, sourceNode } = scannerState;

  if (processorNode) {
    try {
      processorNode.disconnect();
    } catch (err) {
      console.warn("Processor node disconnect failed", err);
    }
    if (typeof AudioWorkletNode !== "undefined" && processorNode instanceof AudioWorkletNode) {
      processorNode.port.onmessage = null;
    } else if (processorNode.onaudioprocess) {
      processorNode.onaudioprocess = null;
    }
  }

  if (analyserNode) {
    try {
      analyserNode.disconnect();
    } catch (err) {
      console.warn("Analyser node disconnect failed", err);
    }
  }

  if (sourceNode) {
    try {
      sourceNode.disconnect();
    } catch (err) {
      console.warn("Source node disconnect failed", err);
    }
  }

  scannerState.processorNode = null;
  scannerState.analyserNode = null;
  scannerState.sourceNode = null;
  scannerState.autoDecodeActive = false;
  scannerState.autoDecodeSampleCount = 0;
  scannerState.autoDecodeInProgress = false;
}

function stopStream() {
  if (scannerState.stream) {
    scannerState.stream.getTracks().forEach((track) => {
      try {
        track.stop();
      } catch (err) {
        console.warn("Error stopping track", err);
      }
    });
  }
  scannerState.stream = null;
}

function convertFloat32ToInt16(buffer) {
  const len = buffer.length;
  const result = new Int16Array(len);
  for (let i = 0; i < len; i += 1) {
    const clipped = Math.max(-1, Math.min(1, buffer[i]));
    result[i] = clipped * 0x7fff;
  }
  return result;
}

function mergeInt16Chunks(chunks) {
  if (!chunks.length) {
    return new Int16Array();
  }
  const total = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
  const merged = new Int16Array(total);
  let offset = 0;
  chunks.forEach((chunk) => {
    merged.set(chunk, offset);
    offset += chunk.length;
  });
  return merged;
}

const urlMatchRegex = /((https?:\/\/|www\.)[^\s]+)/i;

function stripTrailingPunctuation(str) {
  return str.replace(/[),.?!'"\]]+$/gu, "");
}

function detectFirstUrl(text) {
  if (!text) return null;
  const match = text.match(urlMatchRegex);
  if (!match) return null;
  return stripTrailingPunctuation(match[0]);
}

function normalizeUrl(rawUrl) {
  if (!rawUrl) return null;
  const trimmed = rawUrl.trim();
  if (!trimmed) return null;
  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }
  return `https://${trimmed}`;
}

function getProtocolIdForMode(mode) {
  if (!scannerState.ggwave || !scannerState.ggwave.ProtocolId) return null;
  const { ProtocolId } = scannerState.ggwave;
  return mode === "ultrasound"
    ? ProtocolId.GGWAVE_PROTOCOL_ULTRASOUND_FAST
    : ProtocolId.GGWAVE_PROTOCOL_AUDIBLE_FAST;
}

function getProtocolIdForCurrentMode() {
  return getProtocolIdForMode(scannerState.transmissionMode);
}

function createWavBlob(int16Data, sampleRate) {
  const bytesPerSample = 2;
  const blockAlign = bytesPerSample;
  const byteRate = sampleRate * blockAlign;
  const dataLength = int16Data.length * bytesPerSample;
  const buffer = new ArrayBuffer(44 + dataLength);
  const view = new DataView(buffer);

  function writeString(offset, str) {
    for (let i = 0; i < str.length; i += 1) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  }

  writeString(0, "RIFF");
  view.setUint32(4, 36 + dataLength, true);
  writeString(8, "WAVE");
  writeString(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true);
  writeString(36, "data");
  view.setUint32(40, dataLength, true);

  let offset = 44;
  for (let i = 0; i < int16Data.length; i += 1) {
    view.setInt16(offset, int16Data[i], true);
    offset += 2;
  }

  return new Blob([view], { type: "audio/wav" });
}

function clampEncodeGain(value) {
  if (!Number.isFinite(value)) {
    return ENCODE_GAIN_DEFAULT;
  }
  return Math.min(ENCODE_GAIN_MAX, Math.max(ENCODE_GAIN_MIN, value));
}

function sliderValueToGain(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return ENCODE_GAIN_DEFAULT;
  }
  const clampedPercent = Math.min(ENCODE_GAIN_SLIDER_MAX, Math.max(ENCODE_GAIN_SLIDER_MIN, Math.round(numeric)));
  return clampEncodeGain(clampedPercent / 100);
}

function gainToSliderValue(gain) {
  const numeric = Number(gain);
  if (!Number.isFinite(numeric)) {
    return Math.round(ENCODE_GAIN_DEFAULT * 100);
  }
  const percent = Math.round(numeric * 100);
  return Math.min(ENCODE_GAIN_SLIDER_MAX, Math.max(ENCODE_GAIN_SLIDER_MIN, percent));
}

function getEncodeGainStorageKey() {
  if (scannerState.user && scannerState.user.id) {
    return `${ENCODE_GAIN_STORAGE_KEY}-${scannerState.user.id}`;
  }
  return null;
}

function saveEncodeGain() {
  const value = clampEncodeGain(scannerState.encodeGain);
  const serialised = value.toFixed(3);
  try {
    localStorage.setItem(ENCODE_GAIN_STORAGE_KEY, serialised);
    const userSpecificKey = getEncodeGainStorageKey();
    if (userSpecificKey) {
      localStorage.setItem(userSpecificKey, serialised);
      lastEncodeGainStorageKey = userSpecificKey;
    } else {
      lastEncodeGainStorageKey = ENCODE_GAIN_STORAGE_KEY;
    }
  } catch (err) {
    console.warn("Failed to save encode gain preference", err);
  }
}

function restoreEncodeGain() {
  let targetGain = ENCODE_GAIN_DEFAULT;
  try {
    const userSpecificKey = getEncodeGainStorageKey();
    lastEncodeGainStorageKey = userSpecificKey || ENCODE_GAIN_STORAGE_KEY;
    if (userSpecificKey) {
      const rawUser = localStorage.getItem(userSpecificKey);
      if (rawUser !== null) {
        const parsedUser = Number(rawUser);
        if (Number.isFinite(parsedUser)) {
          targetGain = clampEncodeGain(parsedUser);
        }
      } else {
        const rawDefault = localStorage.getItem(ENCODE_GAIN_STORAGE_KEY);
        if (rawDefault !== null) {
          const parsedDefault = Number(rawDefault);
          if (Number.isFinite(parsedDefault)) {
            targetGain = clampEncodeGain(parsedDefault);
          }
        }
      }
    } else {
      const raw = localStorage.getItem(ENCODE_GAIN_STORAGE_KEY);
      if (raw !== null) {
        const parsed = Number(raw);
        if (Number.isFinite(parsed)) {
          targetGain = clampEncodeGain(parsed);
        }
      }
    }
  } catch (err) {
    console.warn("Failed to restore encode gain preference", err);
  }
  scannerState.encodeGain = clampEncodeGain(targetGain);
}

function updateEncodeGainUI() {
  const sliderValue = gainToSliderValue(scannerState.encodeGain);
  if (dom.encodeVolume) {
    dom.encodeVolume.value = String(sliderValue);
  }
  if (dom.encodeVolumeValue) {
    dom.encodeVolumeValue.textContent = `${sliderValue}%`;
  }
}

function applyGainToSamples(baseSamples, gain) {
  if (!baseSamples) {
    return null;
  }
  const multiplier = clampEncodeGain(gain);
  const output = new Int16Array(baseSamples.length);
  for (let i = 0; i < baseSamples.length; i += 1) {
    let sample = baseSamples[i] * multiplier;
    if (sample > 32767) sample = 32767;
    else if (sample < -32768) sample = -32768;
    output[i] = Math.round(sample);
  }
  return output;
}

function renderEncodedAudio({ sourceText, skipHistory = false, resetPlayback = false } = {}) {
  if (!scannerState.encodedBaseSamples) {
    return;
  }

  const scaledSamples = applyGainToSamples(scannerState.encodedBaseSamples, scannerState.encodeGain);
  if (!scaledSamples) {
    return;
  }

  const previousBlobUrl = dom.previewAudio?.src || null;
  const wasPlaying = !resetPlayback && dom.previewAudio && !dom.previewAudio.paused && !dom.previewAudio.ended;
  const resumeLoop = !resetPlayback && scannerState.loopingPlayback;

  scannerState.encodedSamples = scaledSamples;
  scannerState.encodedWaveform = new Int8Array(scaledSamples.buffer.slice(0));
  scannerState.encodedBlob = createWavBlob(scaledSamples, scannerState.sampleRate);

  if (dom.previewAudio) {
    if (previousBlobUrl) {
      URL.revokeObjectURL(previousBlobUrl);
    }
    dom.previewAudio.src = URL.createObjectURL(scannerState.encodedBlob);
    dom.previewAudio.classList.remove("hidden");
    dom.previewAudio.loop = resumeLoop;
    if (resetPlayback) {
      dom.previewAudio.pause();
      dom.previewAudio.currentTime = 0;
    } else if (wasPlaying) {
      const playbackPromise = dom.previewAudio.play();
      if (playbackPromise && typeof playbackPromise.catch === "function") {
        playbackPromise.catch(() => {});
      }
    }
  }

  scannerState.loopingPlayback = resumeLoop;

  if (dom.playButton) dom.playButton.disabled = false;
  if (dom.playLoopButton) dom.playLoopButton.disabled = false;
  if (dom.downloadButton) dom.downloadButton.disabled = false;

  if (!skipHistory && sourceText) {
    addEncodeHistoryEntry(sourceText);
  }

  updateLoopButtonState();
}

function handleEncodeGainChange(event) {
  if (!event || !event.target) return;
  const gain = sliderValueToGain(event.target.value);
  scannerState.encodeGain = gain;
  updateEncodeGainUI();
  saveEncodeGain();
  if (scannerState.encodedBaseSamples) {
    renderEncodedAudio({ skipHistory: true, resetPlayback: false });
  }
}

function applyEncodedAudio(int16Samples, { sourceText, skipHistory = false } = {}) {
  scannerState.encodedBaseSamples = new Int16Array(int16Samples);
  stopLoopPlayback({ updateButton: false });
  scannerState.loopingPlayback = false;
  renderEncodedAudio({ sourceText, skipHistory, resetPlayback: true });
}

function updateLoopButtonState() {
  if (!dom.playLoopButton) return;
  const hasAudio = !!scannerState.encodedBlob;
  dom.playLoopButton.disabled = !hasAudio;
  dom.playLoopButton.setAttribute("aria-pressed", scannerState.loopingPlayback ? "true" : "false");
  if (dom.playLoopLabel) {
    dom.playLoopLabel.textContent = scannerState.loopingPlayback ? "Stop looping" : "Loop in background";
  }
}

function stopLoopPlayback({ updateButton = true } = {}) {
  if (dom.previewAudio) {
    dom.previewAudio.pause();
    dom.previewAudio.loop = false;
    dom.previewAudio.currentTime = 0;
  }
  scannerState.loopingPlayback = false;
  if (updateButton) {
    updateLoopButtonState();
  }
}

function toggleLoopPlayback() {
  if (!scannerState.encodedBlob || !dom.previewAudio) {
    showToast("Generate a sound link first.");
    return;
  }

  if (scannerState.loopingPlayback) {
    stopLoopPlayback();
    showToast("Looping stopped.");
    return;
  }

  if (!dom.previewAudio.src) {
    dom.previewAudio.src = URL.createObjectURL(scannerState.encodedBlob);
  }

  dom.previewAudio.classList.remove("hidden");
  dom.previewAudio.loop = true;
  dom.previewAudio.currentTime = 0;
  scannerState.loopingPlayback = true;

  const playPromise = dom.previewAudio.play();
  updateLoopButtonState();
  showToast("Looping playback started.");

  if (playPromise && typeof playPromise.catch === "function") {
    playPromise.catch((err) => {
      console.warn("Loop playback failed", err);
      stopLoopPlayback();
      showToast("Playback blocked — press play on the audio controls.");
    });
  }
}

function resetEncodeUI() {
  stopLoopPlayback({ updateButton: false });
  scannerState.encodedBlob = null;
  scannerState.encodedSamples = null;
  scannerState.encodedWaveform = null;
  scannerState.encodedBaseSamples = null;
  if (dom.playButton) {
    dom.playButton.disabled = true;
  }
  if (dom.playLoopButton) {
    dom.playLoopButton.disabled = true;
    dom.playLoopButton.setAttribute("aria-pressed", "false");
  }
  if (dom.downloadButton) {
    dom.downloadButton.disabled = true;
  }
  if (dom.previewAudio) {
    if (dom.previewAudio.src) {
      URL.revokeObjectURL(dom.previewAudio.src);
    }
    dom.previewAudio.src = "";
    dom.previewAudio.classList.add("hidden");
  }
  updateLoopButtonState();
}

function addEncodeHistoryEntry(text) {
  const trimmedText = text.trim();
  const detectedUrl = detectFirstUrl(text);
  const normalized = detectedUrl ? normalizeUrl(detectedUrl) : null;
  const targetUrl = normalized || trimmedText;
  const existing = scannerState.encodeHistory.find((item) => item.url === targetUrl);

  const entry = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    text: trimmedText,
    url: targetUrl,
    timestamp: Date.now(),
    mode: scannerState.transmissionMode,
    scanCount: existing?.scanCount || 0,
    lastScan: existing?.lastScan || null,
    scanEvents: Array.isArray(existing?.scanEvents) ? existing.scanEvents.slice(-MAX_HISTORY_ITEMS) : [],
  };

  scannerState.encodeHistory = scannerState.encodeHistory.filter((item) => item.url !== entry.url);
  scannerState.encodeHistory.unshift(entry);
  if (scannerState.encodeHistory.length > MAX_HISTORY_ITEMS) {
    scannerState.encodeHistory.length = MAX_HISTORY_ITEMS;
  }
  saveEncodeHistory();
  renderEncodeHistory();
  updateDashboardStats();
  updateLastResultDisplays(text);
}

async function handleGenerateSound() {
  if (!scannerState.user) {
    showToast("Sign in to generate sound links.");
    openLoginOverlay();
    return;
  }

  try {
    await ensureAudioContext();
  } catch (err) {
    console.error("Unable to initialise audio context before encoding", err);
    showToast("Unable to initialise audio. Check microphone permissions.");
    return;
  }
  stopLoopPlayback();

  if (scannerState.ggwaveReady) {
    try {
      await scannerState.ggwaveReady;
    } catch (err) {
      console.error("Audio engine failed to initialise", err);
      showToast("Audio engine failed to load. Refresh and try again.");
      return;
    }
  }

  if (!scannerState.ggwave || scannerState.ggwaveInstance === null) {
    showToast("Audio engine still loading. Try again in a moment.");
    return;
  }

  const text = dom.encodeInput?.value.trim();
  if (!text) {
    showToast("Enter text or a link before generating.");
    resetEncodeUI();
    return;
  }

  try {
    const protocolId =
      getProtocolIdForCurrentMode() || scannerState.ggwave.ProtocolId.GGWAVE_PROTOCOL_AUDIBLE_FAST;
    const waveform = scannerState.ggwave.encode(scannerState.ggwaveInstance, text, protocolId, 10);
    if (!waveform || !waveform.length) {
      throw new Error("No waveform returned from ggwave.");
    }
    const waveformCopy = new Int8Array(waveform);
    const int16Samples = new Int16Array(waveformCopy.buffer.slice(0));

    applyEncodedAudio(int16Samples, { sourceText: text });
    showToast("Sound link ready — press play to preview.");
    if (dom.encodeInput) {
      dom.encodeInput.value = "";
    }
  } catch (err) {
    console.error("Failed to generate sound", err);
    showToast("Something went wrong while generating the sound.");
    resetEncodeUI();
  }
}

async function handleHistoryAction(entry, intent) {
  if (!entry) return;
  if (!scannerState.user) {
    showToast("Sign in to use your history playback controls.");
    openLoginOverlay();
    return;
  }
  const payload = entry.text || entry.url;
  if (!payload) {
    showToast("This entry has no text to replay.");
    return;
  }

  try {
    await ensureAudioContext();
  } catch (err) {
    console.error("Audio context unavailable for history playback", err);
    showToast("Unable to prepare audio. Check browser permissions.");
    return;
  }

  if (scannerState.ggwaveReady) {
    try {
      await scannerState.ggwaveReady;
    } catch (err) {
      console.error("Audio engine failed before history playback", err);
      showToast("Audio engine failed to load. Refresh and try again.");
      return;
    }
  }

  if (!scannerState.ggwave || scannerState.ggwaveInstance === null) {
    showToast("Audio engine still loading. Try again in a moment.");
    return;
  }

  let protocolId =
    getProtocolIdForMode(entry.mode) || getProtocolIdForCurrentMode() || scannerState.ggwave.ProtocolId?.GGWAVE_PROTOCOL_AUDIBLE_FAST;

  if (!protocolId) {
    showToast("Unable to determine playback mode.");
    return;
  }

  try {
    const waveform = scannerState.ggwave.encode(scannerState.ggwaveInstance, payload, protocolId, 10);
    if (!waveform || !waveform.length) {
      throw new Error("Empty waveform from ggwave");
    }
    const waveformCopy = new Int8Array(waveform);
    const int16Samples = new Int16Array(waveformCopy.buffer.slice(0));
    applyEncodedAudio(int16Samples, { sourceText: payload, skipHistory: true });
  } catch (err) {
    console.error("Failed to regenerate sound from history", err);
    showToast("Unable to prepare this sound. Try regenerating it manually.");
    return;
  }

  if (intent === "play") {
    playEncodedAudio();
  } else if (intent === "loop") {
    stopLoopPlayback({ updateButton: false });
    toggleLoopPlayback();
  } else if (intent === "download") {
    handleDownloadSound();
  }
}

function playEncodedAudio() {
  if (!scannerState.encodedBlob || !dom.previewAudio) {
    showToast("Generate a sound link first.");
    return;
  }
  stopLoopPlayback({ updateButton: false });
  if (dom.previewAudio.src) {
    dom.previewAudio.currentTime = 0;
  } else {
    dom.previewAudio.src = URL.createObjectURL(scannerState.encodedBlob);
  }
  dom.previewAudio.loop = false;
  dom.previewAudio.classList.remove("hidden");
  dom.previewAudio
    .play()
    .catch((err) => {
      console.warn("Unable to autoplay audio preview", err);
      showToast("Press play on the audio player to listen.");
    });
  updateLoopButtonState();
}

function handleDownloadSound() {
  if (!scannerState.encodedBlob) {
    showToast("Generate a sound before downloading.");
    return;
  }
  const link = document.createElement("a");
  link.href = URL.createObjectURL(scannerState.encodedBlob);
  link.download = "audio-link.wav";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.setTimeout(() => URL.revokeObjectURL(link.href), 2000);
}


function updateWaveAnimation(active) {
  if (!dom.waveBars || !dom.waveBars.length) return;
  if (!active) {
    dom.waveBars.forEach((bar) => {
      bar.style.animationDuration = "";
    });
    return;
  }

  dom.waveBars.forEach((bar, index) => {
    const duration = (0.4 + Math.random() * 0.7).toFixed(2);
    const delay = (index * 0.08).toFixed(2);
    bar.style.animationDuration = `${duration}s`;
    bar.style.animationDelay = `${delay}s`;
  });
}

function updateInlineScanUI(state) {
  if (pageType !== "index" || !dom.openScan) return;

  const button = dom.openScan;
  const spinner = dom.scanButtonSpinner;
  const icon = dom.scanButtonIcon;
  const label = dom.scanButtonLabel;
  const status = dom.inlineScanStatus;

  const setButton = (disabled, text, showSpinner) => {
    button.disabled = disabled;
    if (label) label.textContent = text;
    if (spinner) spinner.classList.toggle("hidden", !showSpinner);
    if (icon) icon.classList.toggle("hidden", showSpinner);
    button.classList.toggle("opacity-60", disabled);
    button.classList.toggle("cursor-not-allowed", disabled);
    button.setAttribute("aria-busy", disabled ? "true" : "false");
  };

  switch (state) {
    case "scanning":
      setButton(true, "Listening…", true);
      if (status) {
        status.textContent = "Listening for sound links…";
      }
      break;
    case "success":
      setButton(false, "Scan Now", false);
      if (status) {
        status.textContent = "Decoded a message successfully. Check the latest scan below.";
      }
      break;
    case "timeout":
      setButton(false, "Scan Now", false);
      if (status) {
        status.textContent = "No sound link detected. Try scanning again.";
      }
      break;
    case "idle":
    default:
      setButton(false, "Scan Now", false);
      if (status) {
        status.textContent = "Tap scan to listen for audio links around you.";
      }
      break;
  }
}

function setScanState(nextState) {
  scannerState.activeState = nextState;
  Object.entries(dom.stateContainers || {}).forEach(([key, node]) => {
    if (!node) return;
    if (key === nextState) {
      node.classList.remove("hidden");
    } else {
      node.classList.add("hidden");
    }
  });

  if (nextState === "scanning") {
    updateWaveAnimation(true);
  } else {
    updateWaveAnimation(false);
  }

  updateInlineScanUI(nextState);
}

async function startInlineScan() {
  updateInlineScanUI("scanning");
  try {
    await handleStartRecording();
    if (
      !scannerState.recording &&
      scannerState.activeState !== "success" &&
      scannerState.activeState !== "timeout"
    ) {
      updateInlineScanUI("idle");
    }
  } catch (err) {
    console.error("Inline scan failed", err);
    updateInlineScanUI("idle");
  }
}

function resetCountdown() {
  if (scannerState.countdownTimer) {
    window.clearInterval(scannerState.countdownTimer);
    scannerState.countdownTimer = null;
  }

  if (scannerState.scanTimeout) {
    window.clearTimeout(scannerState.scanTimeout);
    scannerState.scanTimeout = null;
  }
}

function updateCountdown(value) {
  if (dom.countdown) {
    dom.countdown.textContent = `${value}s remaining`;
  }
  if (pageType === "index" && dom.inlineScanStatus && scannerState.activeState === "scanning") {
    dom.inlineScanStatus.textContent = `Listening for sound links… ${value}s remaining`;
  }
}

function closeOverlay() {
  if (!dom.overlay) return;
  dom.overlay.classList.add("hidden");
  dom.overlay.setAttribute("aria-hidden", "true");
  resetCountdown();
  if (scannerState.recording) {
    handleStopRecording({ skipDecode: true });
  }
  if (dom.resultText) {
    dom.resultText.textContent = "";
  }
  if (dom.openLinkButton) {
    dom.openLinkButton.dataset.url = "";
    dom.openLinkButton.classList.add("hidden");
  }
  setScanState("idle");
}

function openOverlay({ autoStart = false } = {}) {
  if (!dom.overlay) return;
  dom.overlay.classList.remove("hidden");
  dom.overlay.setAttribute("aria-hidden", "false");
  setScanState("scanning");
  updateCountdown(SCAN_DURATION_SECONDS);
  if (autoStart) {
    window.setTimeout(() => {
      void handleStartRecording();
    }, 60);
  }
}

async function handleStartRecording() {
  if (scannerState.recording) {
    showToast("Already listening — stop the current scan first.");
    return;
  }

  try {
    await ensureAudioContext();
  } catch (err) {
    console.error("Unable to initialise audio context", err);
    showToast("Unable to access audio context. Try again.");
  }

  if (scannerState.ggwaveReady) {
    try {
      await scannerState.ggwaveReady;
    } catch (err) {
      console.error("Audio engine failed to initialise", err);
      showToast("Audio engine failed to load. Reload the page and retry.");
      return;
    }
  }

  if (!scannerState.ggwave || scannerState.ggwaveInstance === null) {
    showToast("Audio engine still loading. Please wait a moment.");
    if (pageType === "index") {
      updateInlineScanUI("idle");
    }
    return;
  }

  const audioContext = scannerState.audioContext || (await ensureAudioContext());

  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        noiseSuppression: false,
        echoCancellation: false,
        autoGainControl: false,
        channelCount: 1,
      },
    });
    scannerState.stream = stream;
  } catch (err) {
    console.error("Microphone permission denied", err);
    showToast("Microphone access is required to scan sound links.");
    setScanState("timeout");
    if (pageType === "index") {
      updateInlineScanUI("timeout");
    }
    return;
  }

  await audioContext.resume();

  scannerState.recordedChunks = [];
  scannerState.autoDecodeActive = true;
  scannerState.autoDecodeSampleCount = 0;
  scannerState.autoDecodeInProgress = false;

  scannerState.sourceNode = audioContext.createMediaStreamSource(scannerState.stream);
  scannerState.analyserNode = audioContext.createAnalyser();
  scannerState.analyserNode.fftSize = 512;
  scannerState.analyserNode.smoothingTimeConstant = 0.85;

  if (audioContext.audioWorklet && audioContext.audioWorklet.addModule) {
    if (!scannerState.audioWorkletRegistered) {
      const workletBlob = new Blob([recorderWorkletSource], { type: "application/javascript" });
      const workletUrl = URL.createObjectURL(workletBlob);
      try {
        await audioContext.audioWorklet.addModule(workletUrl);
        scannerState.audioWorkletRegistered = true;
      } catch (err) {
        console.error("Failed to register audio worklet", err);
        showToast("Audio worklet registration failed. Try again.");
        URL.revokeObjectURL(workletUrl);
        if (pageType === "index") {
          updateInlineScanUI("idle");
        }
        return;
      }
      URL.revokeObjectURL(workletUrl);
    }

    const recorderNode = new AudioWorkletNode(audioContext, "ggwave-recorder");
    recorderNode.port.onmessage = (event) => {
      const buffer = event.data;
      if (buffer && buffer.byteLength) {
        scannerState.recordedChunks.push(new Int16Array(buffer));
        scannerState.autoDecodeSampleCount += buffer.byteLength / 2;
        maybeAutoDecode();
      }
    };

    const silentGain = audioContext.createGain();
    silentGain.gain.value = 0;

    scannerState.sourceNode.connect(scannerState.analyserNode);
    scannerState.analyserNode.connect(recorderNode);
    recorderNode.connect(silentGain);
    silentGain.connect(audioContext.destination);

    scannerState.processorNode = recorderNode;
  } else {
    console.warn("Falling back to ScriptProcessorNode");
    const processorNode = audioContext.createScriptProcessor(2048, 1, 1);
    const silentGain = audioContext.createGain();
    silentGain.gain.value = 0;

    processorNode.onaudioprocess = (event) => {
      if (!scannerState.recording) return;
      const channelData = event.inputBuffer.getChannelData(0);
      scannerState.recordedChunks.push(convertFloat32ToInt16(channelData));
      scannerState.autoDecodeSampleCount += channelData.length;
      maybeAutoDecode();
    };

    scannerState.sourceNode.connect(scannerState.analyserNode);
    scannerState.analyserNode.connect(processorNode);
    processorNode.connect(silentGain);
    silentGain.connect(audioContext.destination);
    scannerState.processorNode = processorNode;
  }

  scannerState.recording = true;
  setScanState("scanning");
  if (dom.statusText) {
    dom.statusText.textContent = "Listening for sound links...";
  }

  scannerState.countdownValue = SCAN_DURATION_SECONDS;
  updateCountdown(scannerState.countdownValue);
  resetCountdown();

  scannerState.countdownTimer = window.setInterval(() => {
    scannerState.countdownValue -= 1;
    if (scannerState.countdownValue <= 0) {
      updateCountdown(0);
      resetCountdown();
      void handleStopRecording({ skipDecode: false, timeout: true });
      return;
    }
    updateCountdown(scannerState.countdownValue);
  }, 1000);

  scannerState.scanTimeout = window.setTimeout(() => {
    resetCountdown();
    void handleStopRecording({ skipDecode: false, timeout: true });
  }, SCAN_DURATION_SECONDS * 1000);
}

async function handleStopRecording({ skipDecode = false, timeout = false } = {}) {
  if (!scannerState.recording) {
    return;
  }

  scannerState.recording = false;
  resetCountdown();
  cleanupRecordingNodes();
  stopStream();

  if (skipDecode) {
    setScanState(timeout ? "timeout" : "idle");
    return;
  }

  const merged = mergeInt16Chunks(scannerState.recordedChunks);
  scannerState.recordedChunks = [];

  if (!merged.length) {
    setScanState("timeout");
    showToast("No audio captured — try again.");
    return;
  }

  let maxAmplitude = 0;
  for (let i = 0; i < merged.length; i += 1) {
    const sample = Math.abs(merged[i]);
    if (sample > maxAmplitude) {
      maxAmplitude = sample;
    }
  }

  if (maxAmplitude > 0 && maxAmplitude < 5000) {
    const scale = Math.min(6, 20000 / maxAmplitude);
    for (let i = 0; i < merged.length; i += 1) {
      const amplified = Math.max(-32768, Math.min(32767, Math.round(merged[i] * scale)));
      merged[i] = amplified;
    }
  }

  try {
    const byteView = new Int8Array(merged.buffer);
    const decoded = scannerState.ggwave.decode(scannerState.ggwaveInstance, byteView);
    let displayText = "";

    if (decoded && decoded.length) {
      let end = decoded.length;
      while (end > 0 && decoded[end - 1] === 0) {
        end -= 1;
      }
      const trimmed = decoded.subarray(0, end);
      displayText = trimmed.length ? textDecoder.decode(trimmed) : "";
    }

    if (displayText) {
      handleDecodingSuccess(displayText);
    } else {
      setScanState("timeout");
      updateLastResultDisplays("No clear transmission detected.");
      showToast("No readable message found. Try again.");
    }
  } catch (err) {
    console.error("Failed to decode sound", err);
    setScanState("timeout");
    updateLastResultDisplays("Decoding failed.");
    showToast("Decoding failed. Try again.");
  }
}

function wireEvents() {
  if (dom.openScan) {
    dom.openScan.addEventListener("click", () => {
      if (pageType === "index") {
        void startInlineScan();
      } else {
        openOverlay({ autoStart: true });
      }
    });
  }

  dom.closeButtons?.forEach((button) => {
    button.addEventListener("click", () => {
      closeOverlay();
    });
  });

  dom.stopButton?.addEventListener("click", () => {
    void handleStopRecording({ skipDecode: false });
  });

  dom.tryAgainButton?.addEventListener("click", () => {
    setScanState("scanning");
    updateCountdown(SCAN_DURATION_SECONDS);
    void handleStartRecording();
  });

  dom.openLinkButton?.addEventListener("click", () => {
    const url = dom.openLinkButton.dataset.url;
    if (url) {
      window.open(url, "_blank", "noopener");
    }
  });

  if (dom.overlay) {
    dom.overlay.addEventListener("click", (event) => {
      if (event.target === dom.overlay) {
        closeOverlay();
      }
    });
  }

  if (Array.isArray(dom.authModeTabs)) {
    dom.authModeTabs.forEach((tab) => {
      tab.addEventListener("click", () => {
        const targetMode = tab.dataset.authModeTab === AUTH_MODES.REGISTER ? AUTH_MODES.REGISTER : AUTH_MODES.LOGIN;
        setAuthMode(targetMode);
      });
    });
  }

  dom.authTriggers?.forEach((trigger) => {
    trigger.addEventListener("click", (event) => {
      if (
        trigger.tagName === "A" ||
        (typeof trigger.type === "string" && trigger.type.toLowerCase() === "submit")
      ) {
        event.preventDefault();
      }
      const targetMode =
        trigger.dataset.authTrigger === AUTH_MODES.REGISTER ? AUTH_MODES.REGISTER : AUTH_MODES.LOGIN;
      openLoginOverlay({ mode: targetMode });
    });
  });

  dom.heroLogin?.addEventListener("click", () => {
    openLoginOverlay({ mode: AUTH_MODES.LOGIN });
  });

  dom.loginCloseButtons?.forEach((button) => {
    button.addEventListener("click", () => {
      closeLoginOverlay();
    });
  });

  dom.loginOverlay?.addEventListener("click", (event) => {
    if (event.target === dom.loginOverlay) {
      closeLoginOverlay();
    }
  });

  dom.loginForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    clearAuthError();
    const email = dom.loginEmail?.value.trim().toLowerCase();
    const password = dom.loginPassword?.value.trim();
    if (!email || !password) {
      setAuthError("Enter email and password to continue.");
      return;
    }
    const submitButton = event.submitter || dom.loginForm.querySelector('button[type="submit"]');
    setButtonLoadingState(submitButton, true, "Signing in…");
    try {
      const user = await performLogin(email, password);
      if (!user) {
        throw new Error("Invalid email or password.");
      }
      scannerState.user = user;
      applyUserState();
      void refreshBillingStatus();
      closeLoginOverlay();
      showToast(`Signed in as ${user.email}`);
      if (pageType === "index") {
        window.location.href = "./admin.html";
      }
    } catch (err) {
      console.error("Login failed", err);
      setAuthError(err.body?.error || err.message || "Unable to sign in. Try again.");
    } finally {
      setButtonLoadingState(submitButton, false);
    }
  });

  dom.registerForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    clearAuthError();
    const email = dom.registerEmail?.value.trim().toLowerCase();
    const password = dom.registerPassword?.value.trim();
    const confirm = dom.registerConfirmPassword?.value.trim();
    if (!email || !password || !confirm) {
      setAuthError("Please complete all fields to continue.");
      return;
    }
    if (password !== confirm) {
      setAuthError("Passwords do not match. Try again.");
      return;
    }
    if (password.length < 6) {
      setAuthError("Password must be at least 6 characters.");
      return;
    }
    const submitButton = event.submitter || dom.registerForm.querySelector('button[type="submit"]');
    setButtonLoadingState(submitButton, true, "Creating account…");
    try {
      const user = await performRegister(email, password);
      if (!user) {
        throw new Error("Registration failed.");
      }
      scannerState.user = user;
      applyUserState();
      void refreshBillingStatus();
      closeLoginOverlay();
      showToast(`Welcome, ${user.email}!`);
      if (pageType === "index") {
        window.location.href = "./admin.html";
      }
    } catch (err) {
      console.error("Registration failed", err);
      setAuthError(err.body?.error || err.message || "Unable to create account. Try again.");
    } finally {
      setButtonLoadingState(submitButton, false);
    }
  });

  dom.headerLogout?.addEventListener("click", async () => {
    await performLogout();
    scannerState.user = null;
    resetBillingState();
    applyUserState();
    resetEncodeUI();
    showToast("Logged out.");
    if (pageType === "admin") {
      window.location.href = "./index.html";
    }
  });

  dom.dashboardScanButton?.addEventListener("click", () => {
    openOverlay({ autoStart: true });
  });

  dom.modeAudible?.addEventListener("click", () => setTransmissionMode("audible"));
  dom.modeUltrasound?.addEventListener("click", () => setTransmissionMode("ultrasound"));

  dom.headerUser?.addEventListener("click", (event) => {
    const clickedLogout =
      dom.headerLogout && event.target instanceof Element && dom.headerLogout.contains(event.target);
    if (clickedLogout) return;
    if (scannerState.user && pageType === "index") {
      window.location.href = "/new/admin.html";
    }
  });

  dom.headerUser?.addEventListener("keydown", (event) => {
    if (event.target !== dom.headerUser) return;
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      if (scannerState.user && pageType === "index") {
        window.location.href = "/new/admin.html";
      }
    }
  });

  dom.generateButton?.addEventListener("click", () => {
    void handleGenerateSound();
  });

  dom.encodeVolume?.addEventListener("input", handleEncodeGainChange);
  dom.encodeVolume?.addEventListener("change", handleEncodeGainChange);

  dom.playButton?.addEventListener("click", () => {
    playEncodedAudio();
  });

  dom.playLoopButton?.addEventListener("click", () => {
    toggleLoopPlayback();
  });

  dom.upgradeButtons?.forEach((button) => {
    if (!button.dataset.originalText) {
      button.dataset.originalText = button.textContent || "";
    }
    button.addEventListener("click", () => {
      const plan = button.dataset.upgradePlan || "pro";
      void startPlanCheckout(plan, button);
    });
  });

  dom.downloadButton?.addEventListener("click", () => {
    handleDownloadSound();
  });

  window.addEventListener("beforeunload", () => {
    resetCountdown();
    cleanupRecordingNodes();
    stopStream();
    if (scannerState.audioContext) {
      scannerState.audioContext.close().catch(() => {});
    }
    if (scannerState.ggwave && scannerState.ggwaveInstance !== null) {
      try {
        scannerState.ggwave.free(scannerState.ggwaveInstance);
      } catch (err) {
        console.warn("Failed to free ggwave instance", err);
      }
    }
  });
}

async function initialiseScanner() {
  cacheDom();
  updatePlanUI();
  setAuthMode(activeAuthMode);
  wireEvents();
  handleCheckoutNotices();
  scannerState.user = await fetchActiveSession();
  if (pageType === "admin" && !scannerState.user) {
    window.location.href = "./index.html";
    return;
  }
  setScanState("idle");
  applyUserState();
  if (scannerState.user) {
    void refreshBillingStatus();
  }
  updateModeUI();
  resetEncodeUI();
  updateInlineScanUI("idle");

  try {
    await rebuildGGWave();
    showToast("Audio engine ready — start scanning anytime.");
  } catch (err) {
    console.error("Failed to initialise GGWave", err);
    showToast("Failed to load audio engine. Refresh the page to retry.");
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    initialiseScanner().catch((err) => {
      console.error("Scanner init error", err);
    });
  });
} else {
  initialiseScanner().catch((err) => {
    console.error("Scanner init error", err);
  });
}
