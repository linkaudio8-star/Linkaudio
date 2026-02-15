import {
  cacheDom as cacheDomFromUi,
  showToast as showToastFromUi,
  setButtonLoadingState as setButtonLoadingStateFromUi,
} from "./new/modules/ui.js";
import {
  AUTH_MODES,
  clearAuthError as clearAuthErrorFromAuth,
  setAuthError as setAuthErrorFromAuth,
  setAuthMode as setAuthModeFromAuth,
  apiRequest as apiRequestFromAuth,
  fetchActiveSession as fetchActiveSessionFromAuth,
  performLogin as performLoginFromAuth,
  performRegister as performRegisterFromAuth,
  performLogout as performLogoutFromAuth,
} from "./new/modules/auth.js";
import {
  resetBillingState as resetBillingStateFromBilling,
  hydratePlanFromUser as hydratePlanFromUserFromBilling,
  updatePlanUI as updatePlanUIFromBilling,
  refreshBillingStatus as refreshBillingStatusFromBilling,
  confirmCheckoutSession as confirmCheckoutSessionFromBilling,
  startPlanCheckout as startPlanCheckoutFromBilling,
  handleCheckoutNotices as handleCheckoutNoticesFromBilling,
} from "./new/modules/billing.js";
import {
  loadEncodeHistory as loadEncodeHistoryFromHistory,
  saveEncodeHistory as saveEncodeHistoryFromHistory,
  renderEncodeHistory as renderEncodeHistoryFromHistory,
  updateDashboardStats as updateDashboardStatsFromHistory,
  addEncodeHistoryEntry as addEncodeHistoryEntryFromHistory,
  incrementEncodeHistoryScanCount as incrementEncodeHistoryScanCountFromHistory,
} from "./new/modules/history.js";
import {
  createWavBlob as createWavBlobFromAudio,
  applyGainToSamples as applyGainToSamplesFromAudio,
  stopHistoryLoopPlayback as stopHistoryLoopPlaybackFromAudio,
  encodePayloadToWavBlob as encodePayloadToWavBlobFromAudio,
} from "./new/modules/audio.js";

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
  transmissionMode: "ultrasound",
  encodedBlob: null,
  encodedWaveform: null,
  encodedSamples: null,
  encodedBaseSamples: null,
  encodedTargetUrl: null,
  encodeGain: 1,
  loopingPlayback: false,
  historyLoopAudio: null,
  historyLoopObjectUrl: null,
  historyLoopEntryId: null,
  historyPlayAudio: null,
  historyPlayObjectUrl: null,
  historyPlayEntryId: null,
  currentHistoryEntryId: null,
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
const LAST_ENCODE_STORAGE_KEY = "audiolink-last-encode";
const ENCODE_DRAFT_STORAGE_KEY = "audiolink-encode-draft";
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

const dom = {};

function cacheDom() {
  cacheDomFromUi(dom);
}

function showToast(message) {
  showToastFromUi(dom, message);
}

let activeAuthMode = AUTH_MODES.LOGIN;

function clearAuthError() {
  clearAuthErrorFromAuth(dom);
}

function setAuthError(message) {
  setAuthErrorFromAuth(dom, message);
}

function setAuthMode(mode) {
  activeAuthMode = setAuthModeFromAuth(dom, mode);
}

function setButtonLoadingState(button, isLoading, loadingLabel) {
  setButtonLoadingStateFromUi(button, isLoading, loadingLabel);
}

async function apiRequest(path, { method = "GET", body, headers } = {}) {
  return apiRequestFromAuth(path, { method, body, headers });
}

async function fetchActiveSession() {
  return fetchActiveSessionFromAuth(apiRequest);
}

async function performLogin(email, password) {
  return performLoginFromAuth(email, password, apiRequest);
}

async function performRegister(email, password) {
  return performRegisterFromAuth(email, password, apiRequest);
}

async function performLogout() {
  await performLogoutFromAuth(apiRequest);
}

async function startPlanCheckout(plan, button) {
  await startPlanCheckoutFromBilling({
    scannerState,
    apiRequest,
    showToast,
    setButtonLoadingState,
    plan,
    button,
  });
}

function handleCheckoutNotices() {
  handleCheckoutNoticesFromBilling({
    dom,
    confirmCheckoutSession,
    refreshBillingStatus,
  });
}

function loadEncodeHistory() {
  loadEncodeHistoryFromHistory(scannerState);
}

function saveEncodeHistory() {
  saveEncodeHistoryFromHistory(scannerState);
}

function renderEncodeHistory() {
  renderEncodeHistoryFromHistory({
    scannerState,
    dom,
    onHistoryAction: handleHistoryAction,
    showToast,
  });
}

function updateCurrentBadgeVisibility() {
  if (!dom.currentBadge) return;
  dom.currentBadge.classList.toggle("hidden", !scannerState.currentHistoryEntryId);
}


function updateModeUI() {
  if (dom.modeLabel) {
    dom.modeLabel.textContent = "Ultrasound Mode";
  }
  if (dom.modeUltrasound) {
    dom.modeUltrasound.classList.add("bg-white", "shadow", "text-slate-900");
    dom.modeUltrasound.classList.remove("text-slate-500");
  }
  if (dom.dashboardModeLabel) {
    dom.dashboardModeLabel.textContent = "Ultrasound";
  }
  document.querySelectorAll("[data-mode-label-secondary]").forEach((node) => {
    node.textContent = "Ultrasound";
  });
}

function resetBillingState() {
  resetBillingStateFromBilling(scannerState, dom);
}

function hydratePlanFromUser(user) {
  hydratePlanFromUserFromBilling(scannerState, dom, user);
}

function updatePlanUI() {
  updatePlanUIFromBilling(scannerState, dom);
}


async function refreshBillingStatus() {
  await refreshBillingStatusFromBilling(scannerState, dom, apiRequest);
}

async function confirmCheckoutSession(sessionId) {
  await confirmCheckoutSessionFromBilling({
    scannerState,
    dom,
    apiRequest,
    showToast,
    sessionId,
  });
}

function setTransmissionMode(mode) {
  scannerState.transmissionMode = "ultrasound";
  updateModeUI();
  if (mode === "ultrasound") {
    showToast("Ultrasound mode active for encoding.");
  }
}

function updateDashboardStats() {
  updateDashboardStatsFromHistory(scannerState, dom);
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
  incrementEncodeHistoryScanCountFromHistory({
    scannerState,
    rawValue,
    detectFirstUrl,
    normalizeUrl,
    saveEncodeHistoryFn: saveEncodeHistory,
    renderEncodeHistoryFn: renderEncodeHistory,
    updateDashboardStatsFn: updateDashboardStats,
  });
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
    if (dom.encodeInput) {
      dom.encodeInput.value = loadEncodeDraft();
    }
    loadEncodeHistory();
    renderEncodeHistory();
    updateDashboardStats();
    const last = scannerState.encodeHistory[0];
    updateLastResultDisplays(last ? last.text : "None");
  } else {
    if (dom.encodeInput) {
      dom.encodeInput.value = "";
    }
    scannerState.encodeHistory = [];
    scannerState.currentHistoryEntryId = null;
    updateCurrentBadgeVisibility();
    if (dom.historyList) dom.historyList.innerHTML = "";
    if (dom.historyEmpty) dom.historyEmpty.classList.remove("hidden");
    if (dom.historyCount) dom.historyCount.textContent = "0 items";
    updateDashboardStats();
    updateLastResultDisplays("None");
  }
  updateCurrentBadgeVisibility();
  updateOpenLinkButtonState();
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

function resolveGeneratedTargetUrl(sourceText) {
  const raw = String(sourceText || "").trim();
  if (!raw) return null;
  const detected = detectFirstUrl(raw);
  if (detected) {
    return normalizeUrl(detected);
  }
  if (/^[a-z0-9.-]+\.[a-z]{2,}(\/|$)/i.test(raw)) {
    return normalizeUrl(raw);
  }
  return null;
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
  return createWavBlobFromAudio(int16Data, sampleRate);
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
    }
  } catch (err) {
    console.warn("Failed to save encode gain preference", err);
  }
}

function getLastEncodeStorageKey() {
  if (!scannerState.user || !scannerState.user.email) {
    return null;
  }
  return `${LAST_ENCODE_STORAGE_KEY}-${scannerState.user.email}`;
}

function getEncodeDraftStorageKey() {
  if (!scannerState.user || !scannerState.user.email) {
    return null;
  }
  return `${ENCODE_DRAFT_STORAGE_KEY}-${scannerState.user.email}`;
}

function saveLastGeneratedSound(sourceText) {
  const key = getLastEncodeStorageKey();
  if (!key) return;
  const trimmed = typeof sourceText === "string" ? sourceText.trim() : "";
  if (!trimmed) return;
  const payload = {
    text: trimmed,
    mode: "ultrasound",
    updatedAt: Date.now(),
  };
  try {
    localStorage.setItem(key, JSON.stringify(payload));
  } catch (err) {
    console.warn("Failed to persist last generated sound", err);
  }
}

function loadLastGeneratedSound() {
  const key = getLastEncodeStorageKey();
  if (!key) return null;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const value = typeof parsed?.text === "string" ? parsed.text.trim() : "";
    return value || null;
  } catch (err) {
    console.warn("Failed to read last generated sound", err);
    return null;
  }
}

function clearLastGeneratedSound() {
  const key = getLastEncodeStorageKey();
  if (!key) return;
  try {
    localStorage.removeItem(key);
  } catch (err) {
    console.warn("Failed to clear last generated sound", err);
  }
}

function saveEncodeDraft(text) {
  const key = getEncodeDraftStorageKey();
  if (!key) return;
  const value = typeof text === "string" ? text : "";
  try {
    localStorage.setItem(key, value);
  } catch (err) {
    console.warn("Failed to persist encode draft", err);
  }
}

function loadEncodeDraft() {
  const key = getEncodeDraftStorageKey();
  if (!key) return "";
  try {
    const raw = localStorage.getItem(key);
    return typeof raw === "string" ? raw : "";
  } catch (err) {
    console.warn("Failed to read encode draft", err);
    return "";
  }
}

function updateOpenLinkButtonState() {
  if (!dom.openLinkButtonGenerated) return;
  const fallbackFromInput = resolveGeneratedTargetUrl(dom.encodeInput?.value || "");
  const hasTarget = !!(scannerState.encodedTargetUrl || fallbackFromInput);
  dom.openLinkButtonGenerated.disabled = !hasTarget;
}

function restoreEncodeGain() {
  let targetGain = ENCODE_GAIN_DEFAULT;
  try {
    const userSpecificKey = getEncodeGainStorageKey();
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
  return applyGainToSamplesFromAudio(baseSamples, gain, clampEncodeGain);
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
  if (sourceText !== undefined) {
    scannerState.encodedTargetUrl = resolveGeneratedTargetUrl(sourceText);
  }

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
  updateOpenLinkButtonState();
  if (dom.deleteButtonGenerated) dom.deleteButtonGenerated.disabled = false;

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

function loadHistoryEntryIntoCurrent(entry, { showFeedback = false } = {}) {
  if (!entry) return false;
  const payload = entry.text || entry.url;
  if (!payload || !scannerState.ggwave || scannerState.ggwaveInstance === null) {
    return false;
  }
  try {
    const int16Samples = encodeTextToInt16Samples(payload);
    scannerState.currentHistoryEntryId = entry.id;
    applyEncodedAudio(int16Samples, { sourceText: payload, skipHistory: true });
    if (dom.encodeInput) {
      dom.encodeInput.value = payload;
    }
    saveEncodeDraft(payload);
    saveLastGeneratedSound(payload);
    updateCurrentBadgeVisibility();
    renderEncodeHistory();
    if (showFeedback) {
      showToast("Loaded selected sound.");
    }
    return true;
  } catch (err) {
    console.warn("Failed to load history item into current controls", err);
    return false;
  }
}

function encodeTextToInt16Samples(text) {
  const protocolId =
    getProtocolIdForCurrentMode() || scannerState.ggwave.ProtocolId.GGWAVE_PROTOCOL_AUDIBLE_FAST;
  const waveform = scannerState.ggwave.encode(scannerState.ggwaveInstance, text, protocolId, 10);
  if (!waveform || !waveform.length) {
    throw new Error("No waveform returned from ggwave.");
  }
  const waveformCopy = new Int8Array(waveform);
  return new Int16Array(waveformCopy.buffer.slice(0));
}

function restoreLastGeneratedSound() {
  if (pageType !== "admin" || !scannerState.user || !scannerState.ggwave || scannerState.ggwaveInstance === null) {
    return;
  }
  const lastSource = loadLastGeneratedSound();
  if (!lastSource) {
    return;
  }
  try {
    const int16Samples = encodeTextToInt16Samples(lastSource);
    scannerState.currentHistoryEntryId = null;
    applyEncodedAudio(int16Samples, { sourceText: lastSource, skipHistory: true });
    updateCurrentBadgeVisibility();
    renderEncodeHistory();
  } catch (err) {
    console.warn("Failed to restore last generated sound", err);
  }
}

function updateLoopButtonState() {
  if (!dom.playLoopButton) return;
  const hasAudio = !!scannerState.encodedBlob;
  dom.playLoopButton.disabled = !hasAudio;
  dom.playLoopButton.setAttribute("aria-pressed", scannerState.loopingPlayback ? "true" : "false");
  if (dom.playLoopTrack) {
    dom.playLoopTrack.classList.toggle("bg-emerald-400", scannerState.loopingPlayback);
    dom.playLoopTrack.classList.toggle("bg-slate-200", !scannerState.loopingPlayback);
  }
  if (dom.playLoopKnob) {
    dom.playLoopKnob.style.transform = scannerState.loopingPlayback ? "translateX(16px)" : "translateX(0px)";
  }
  if (dom.playLoopLabel) {
    dom.playLoopLabel.textContent = "Loop in background";
  }
}

function syncLoopPlaybackFromPreviewAudio() {
  if (!dom.previewAudio) return;
  const loopActive = !!(dom.previewAudio.loop && !dom.previewAudio.paused && !dom.previewAudio.ended);
  scannerState.loopingPlayback = loopActive;
  updateLoopButtonState();
}

function updatePlayButtonState() {
  if (!dom.playButton) return;
  const hasAudio = !!scannerState.encodedBlob;
  const isPlaying = !!(dom.previewAudio && !dom.previewAudio.paused && !dom.previewAudio.ended);
  dom.playButton.disabled = !hasAudio;
  dom.playButton.setAttribute("aria-pressed", isPlaying ? "true" : "false");
  dom.playButton.classList.toggle("bg-[#eef2ff]", isPlaying);
  dom.playButton.classList.toggle("text-[#5b4ff5]", isPlaying);
  dom.playButton.innerHTML = isPlaying
    ? '<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="currentColor" viewBox="0 0 24 24"><path d="M7 6h4v12H7zm6 0h4v12h-4z"/></svg>Pause'
    : '<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>Play';
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
  updatePlayButtonState();
}

function stopHistoryLoopPlayback({ rerender = true } = {}) {
  stopHistoryLoopPlaybackFromAudio(scannerState, rerender, renderEncodeHistory);
}

function stopHistoryPlayPlayback({ rerender = true } = {}) {
  if (scannerState.historyPlayAudio) {
    scannerState.historyPlayAudio.pause();
    scannerState.historyPlayAudio.currentTime = 0;
    scannerState.historyPlayAudio.src = "";
    scannerState.historyPlayAudio = null;
  }
  if (scannerState.historyPlayObjectUrl) {
    URL.revokeObjectURL(scannerState.historyPlayObjectUrl);
    scannerState.historyPlayObjectUrl = null;
  }
  scannerState.historyPlayEntryId = null;
  if (rerender) {
    renderEncodeHistory();
  }
}

function encodePayloadToWavBlob(payload, protocolId) {
  return encodePayloadToWavBlobFromAudio({
    scannerState,
    payload,
    protocolId,
    clampEncodeGain,
  });
}

function toggleLoopPlayback() {
  if (!scannerState.encodedBlob || !dom.previewAudio) {
    showToast("Generate a sound link first.");
    return;
  }

  syncLoopPlaybackFromPreviewAudio();

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
  scannerState.encodedTargetUrl = null;
  scannerState.currentHistoryEntryId = null;
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
  if (dom.openLinkButtonGenerated) {
    dom.openLinkButtonGenerated.disabled = true;
  }
  if (dom.deleteButtonGenerated) {
    dom.deleteButtonGenerated.disabled = true;
  }
  if (dom.previewAudio) {
    if (dom.previewAudio.src) {
      URL.revokeObjectURL(dom.previewAudio.src);
    }
    dom.previewAudio.src = "";
    dom.previewAudio.classList.add("hidden");
  }
  updateCurrentBadgeVisibility();
  updateOpenLinkButtonState();
  updateLoopButtonState();
  updatePlayButtonState();
}

function deleteHistoryEntryById(entryId) {
  if (!entryId) return;
  if (scannerState.historyPlayEntryId === entryId) {
    stopHistoryPlayPlayback({ rerender: false });
  }
  if (scannerState.historyLoopEntryId === entryId) {
    stopHistoryLoopPlayback({ rerender: false });
  }
  const removedEntry = scannerState.encodeHistory.find((item) => item.id === entryId) || null;
  const beforeLength = scannerState.encodeHistory.length;
  scannerState.encodeHistory = scannerState.encodeHistory.filter((item) => item.id !== entryId);
  if (scannerState.encodeHistory.length === beforeLength) return;
  if (scannerState.currentHistoryEntryId === entryId) {
    resetEncodeUI();
  }
  renderEncodeHistory();
  saveEncodeHistory();
  const lastGenerated = loadLastGeneratedSound();
  const removedText = (removedEntry?.text || removedEntry?.url || "").trim();
  if (lastGenerated && removedText && lastGenerated === removedText) {
    clearLastGeneratedSound();
  }
  updateDashboardStats();
  const last = scannerState.encodeHistory[0];
  updateLastResultDisplays(last ? last.text : "None");
}

function deleteCurrentSound() {
  const confirmDelete = window.confirm("Delete this sound?");
  if (!confirmDelete) return;
  const currentId = scannerState.currentHistoryEntryId;
  if (currentId) {
    deleteHistoryEntryById(currentId);
    showToast("Sound deleted.");
    return;
  }
  const draft = (dom.encodeInput?.value || "").trim();
  if (draft) {
    saveEncodeDraft("");
    if (dom.encodeInput) {
      dom.encodeInput.value = "";
    }
  }
  clearLastGeneratedSound();
  resetEncodeUI();
  showToast("Sound deleted.");
}

function addEncodeHistoryEntry(text) {
  addEncodeHistoryEntryFromHistory({
    text,
    scannerState,
    detectFirstUrl,
    normalizeUrl,
    saveEncodeHistoryFn: saveEncodeHistory,
    renderEncodeHistoryFn: renderEncodeHistory,
    updateDashboardStatsFn: updateDashboardStats,
    updateLastResultDisplays,
  });
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
    const int16Samples = encodeTextToInt16Samples(text);
    scannerState.currentHistoryEntryId = null;
    applyEncodedAudio(int16Samples, { sourceText: text });
    saveEncodeDraft(text);
    saveLastGeneratedSound(text);
    updateCurrentBadgeVisibility();
    renderEncodeHistory();
    showToast("Sound link ready — press play to preview.");
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

  if (intent === "delete") {
    const confirmDelete = window.confirm("Delete this sound?");
    if (!confirmDelete) return;
    stopHistoryLoopPlayback({ rerender: false });
    deleteHistoryEntryById(entry.id);
    showToast("Sound deleted.");
    return;
  }

  const isLoopingThisEntry =
    scannerState.historyLoopEntryId &&
    scannerState.historyLoopEntryId === entry.id &&
    scannerState.historyLoopAudio;
  const isPlayingThisEntry =
    scannerState.historyPlayEntryId &&
    scannerState.historyPlayEntryId === entry.id &&
    scannerState.historyPlayAudio;
  if (intent === "loop" && isLoopingThisEntry) {
    stopHistoryLoopPlayback();
    showToast("Looping stopped.");
    return;
  }
  if (intent === "play" && isPlayingThisEntry) {
    stopHistoryPlayPlayback();
    showToast("Playback stopped.");
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

  if (intent === "select") {
    loadHistoryEntryIntoCurrent(entry, { showFeedback: true });
    return;
  }

  let protocolId =
    getProtocolIdForMode(entry.mode) || getProtocolIdForCurrentMode() || scannerState.ggwave.ProtocolId?.GGWAVE_PROTOCOL_AUDIBLE_FAST;

  if (!protocolId) {
    showToast("Unable to determine playback mode.");
    return;
  }

  if (intent === "open") {
    const normalized = normalizeUrl(entry.url || payload);
    if (!normalized) {
      showToast("No valid URL to open.");
      return;
    }
    window.open(normalized, "_blank", "noopener");
    return;
  }

  let historyBlob;
  try {
    historyBlob = encodePayloadToWavBlob(payload, protocolId);
  } catch (err) {
    console.warn("Primary history encoding failed, trying fallback", err);
    try {
      const fallbackSamples = encodeTextToInt16Samples(String(payload || ""));
      const scaledFallback = applyGainToSamples(fallbackSamples, scannerState.encodeGain) || fallbackSamples;
      historyBlob = createWavBlob(scaledFallback, scannerState.sampleRate);
    } catch (fallbackErr) {
      console.error("Failed to regenerate sound from history", fallbackErr);
      showToast("Unable to prepare this sound. Try regenerating it manually.");
      return;
    }
  }

  const objectUrl = URL.createObjectURL(historyBlob);
  if (intent === "play") {
    stopHistoryLoopPlayback({ rerender: false });
    stopHistoryPlayPlayback({ rerender: false });
    const audio = new Audio(objectUrl);
    audio.loop = false;
    const cleanup = () => {
      if (scannerState.historyPlayObjectUrl) {
        URL.revokeObjectURL(scannerState.historyPlayObjectUrl);
      }
      scannerState.historyPlayObjectUrl = null;
      scannerState.historyPlayAudio = null;
      scannerState.historyPlayEntryId = null;
      audio.onended = null;
      audio.onerror = null;
      renderEncodeHistory();
    };
    scannerState.historyPlayAudio = audio;
    scannerState.historyPlayObjectUrl = objectUrl;
    scannerState.historyPlayEntryId = entry.id;
    renderEncodeHistory();
    audio.onended = cleanup;
    audio.onerror = cleanup;
    audio.play().catch((err) => {
      cleanup();
      console.warn("History playback failed", err);
      showToast("Playback blocked — press play on the audio controls.");
    });
    return;
  } else if (intent === "loop") {
    stopHistoryPlayPlayback({ rerender: false });
    stopHistoryLoopPlayback({ rerender: false });
    const loopAudio = new Audio(objectUrl);
    loopAudio.loop = true;
    loopAudio.currentTime = 0;
    scannerState.historyLoopAudio = loopAudio;
    scannerState.historyLoopObjectUrl = objectUrl;
    scannerState.historyLoopEntryId = entry.id;
    renderEncodeHistory();
    loopAudio.play().then(() => {
      showToast("Looping playback started.");
    }).catch((err) => {
      console.warn("History loop playback failed", err);
      stopHistoryLoopPlayback();
      showToast("Playback blocked — press play on the audio controls.");
    });
    return;
  } else if (intent === "download") {
    const link = document.createElement("a");
    link.href = objectUrl;
    link.download = "audio-link.wav";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 2000);
    return;
  } else {
    URL.revokeObjectURL(objectUrl);
    return;
  }
}

function playEncodedAudio() {
  if (!scannerState.encodedBlob || !dom.previewAudio) {
    showToast("Generate a sound link first.");
    return;
  }
  if (!dom.previewAudio.paused && !dom.previewAudio.ended) {
    dom.previewAudio.pause();
    updatePlayButtonState();
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
    })
    .finally(() => {
      updatePlayButtonState();
    });
  updateLoopButtonState();
  updatePlayButtonState();
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

function handleOpenGeneratedLink() {
  const fallbackFromInput = resolveGeneratedTargetUrl(dom.encodeInput?.value || "");
  const target = scannerState.encodedTargetUrl || fallbackFromInput;
  if (!target) {
    showToast("Generate a sound link from a URL first.");
    return;
  }
  scannerState.encodedTargetUrl = target;
  if (dom.openLinkButtonGenerated) {
    dom.openLinkButtonGenerated.disabled = false;
  }
  window.open(target, "_blank", "noopener");
}

function handleDeleteGeneratedSound() {
  deleteCurrentSound();
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
    stopHistoryPlayPlayback({ rerender: false });
    stopHistoryLoopPlayback({ rerender: false });
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

  dom.encodeInput?.addEventListener("input", (event) => {
    const value = event?.target && typeof event.target.value === "string" ? event.target.value : "";
    saveEncodeDraft(value);
    updateOpenLinkButtonState();
  });

  dom.encodeVolume?.addEventListener("input", handleEncodeGainChange);
  dom.encodeVolume?.addEventListener("change", handleEncodeGainChange);

  dom.playButton?.addEventListener("click", () => {
    playEncodedAudio();
  });
  dom.previewAudio?.addEventListener("play", updatePlayButtonState);
  dom.previewAudio?.addEventListener("pause", updatePlayButtonState);
  dom.previewAudio?.addEventListener("ended", updatePlayButtonState);
  dom.previewAudio?.addEventListener("play", syncLoopPlaybackFromPreviewAudio);
  dom.previewAudio?.addEventListener("pause", syncLoopPlaybackFromPreviewAudio);
  dom.previewAudio?.addEventListener("ended", syncLoopPlaybackFromPreviewAudio);

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
  dom.openLinkButtonGenerated?.addEventListener("click", () => {
    handleOpenGeneratedLink();
  });
  dom.deleteButtonGenerated?.addEventListener("click", () => {
    handleDeleteGeneratedSound();
  });

  window.addEventListener("beforeunload", () => {
    stopHistoryPlayPlayback({ rerender: false });
    stopHistoryLoopPlayback({ rerender: false });
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
    restoreLastGeneratedSound();
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
