const state = {
  user: null,
  ggwave: null,
  ggwaveInstance: null,
  ggwaveReady: null,
  ggwaveParams: null,
  sampleRate: 48000,
  encodedWaveform: null,
  encodedSamples: null,
  encodedBlob: null,
  audioContext: null,
  stream: null,
  sourceNode: null,
  analyserNode: null,
  processorNode: null,
  recording: false,
  recordedChunks: [],
  visualiserFrame: null,
  visualiserPanel: null,
  activeDecodePanel: null,
  audioWorkletRegistered: false,
  scanHistory: [],
  encodeHistory: [],
  transmissionMode: 'audible',
};

const views = {
  landing: document.getElementById('landing-view'),
  auth: document.getElementById('auth-view'),
  dashboard: document.getElementById('dashboard-view'),
};

const elements = {
  authForm: document.getElementById('auth-form'),
  encodeInput: document.getElementById('encode-input'),
  generateSound: document.getElementById('generate-sound'),
  playSound: document.getElementById('play-sound'),
  downloadSound: document.getElementById('download-sound'),
  previewAudio: document.getElementById('preview-audio'),
  toast: document.getElementById('toast'),
};

const tabs = Array.from(document.querySelectorAll('.tab'));
const tabContents = Array.from(document.querySelectorAll('.tab-content'));
const textDecoder = new TextDecoder();
const MAX_HISTORY_ITEMS = 12;

const MODE_CONFIG = {
  audible: {
    label: 'Audible',
    note: 'Audible — hearable chirps suitable for most devices.',
    idleText: 'Audible mode ready — tap to scan.',
    listeningText: 'Listening (audible)… keep the speaker nearby.',
  },
  ultrasound: {
    label: 'Ultrasound',
    note: 'Ultrasound — inaudible high-frequency transmission (best within ~1 m).',
    idleText: 'Ultrasound mode ready — place devices close together.',
    listeningText: 'Listening (ultrasound)… keep devices within about 1 m.',
  },
};
const decodePanels = Array.from(document.querySelectorAll('[data-role="decode-panel"]')).map((panel) => ({
  root: panel,
  startButton: panel.querySelector('[data-action="start-recording"]'),
  stopButton: panel.querySelector('[data-action="stop-recording"]'),
  indicator: panel.querySelector('[data-indicator]'),
  status: panel.querySelector('[data-status]'),
  resultCard: panel.querySelector('[data-result]'),
  decodedText: panel.querySelector('[data-decoded-text]'),
  copyButton: panel.querySelector('[data-action="copy-decoded"]'),
  canvas: panel.querySelector('canvas'),
  canvasContext: null,
  linkPreview: panel.querySelector('[data-link-preview]'),
  linkAnchor: panel.querySelector('[data-link-anchor]'),
  linkImageWrapper: panel.querySelector('[data-link-image-wrapper]'),
  linkImage: panel.querySelector('[data-link-image]'),
  linkTitle: panel.querySelector('[data-link-title]'),
  linkDescription: panel.querySelector('[data-link-description]'),
  linkHost: panel.querySelector('[data-link-host]'),
  linkPreviewPending: null,
  historyContainer: panel.querySelector('[data-history]'),
  historyList: panel.querySelector('[data-history-list]'),
  historyEmpty: panel.querySelector('[data-history-empty]'),
}));

decodePanels.forEach((panel) => {
  if (panel.historyEmpty) {
    panel.historyEmpty.style.display = 'block';
  }
  if (panel.historyList) {
    panel.historyList.style.display = 'none';
  }
});

const encodeHistoryElements = {
  container: document.querySelector('[data-encode-history]'),
  list: document.querySelector('[data-encode-history-list]'),
  empty: document.querySelector('[data-encode-history-empty]'),
};

if (encodeHistoryElements.empty) {
  encodeHistoryElements.empty.style.display = 'block';
}
if (encodeHistoryElements.list) {
  encodeHistoryElements.list.style.display = 'none';
}

const modeButtons = Array.from(document.querySelectorAll('[data-mode-option]'));
const modeNotes = Array.from(document.querySelectorAll('[data-mode-note]'));

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

function showView(name) {
  Object.values(views).forEach((view) => view.classList.remove('active'));
  const view = views[name];
  if (view) {
    view.classList.add('active');
  }
}

function setActiveTab(name) {
  tabs.forEach((tab) => {
    tab.classList.toggle('active', tab.dataset.tab === name);
  });
  tabContents.forEach((content) => {
    content.classList.toggle('active', content.dataset.content === name);
  });
}

function loadUser() {
  const raw = localStorage.getItem('audiolink-user');
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch (err) {
    console.warn('Failed to parse user from storage', err);
    return null;
  }
}

function saveUser(user) {
  if (user) {
    localStorage.setItem('audiolink-user', JSON.stringify(user));
  } else {
    localStorage.removeItem('audiolink-user');
  }
}

async function rebuildGGWave(sampleRateOverride) {
  if (!window.ggwave_factory) {
    throw new Error('ggwave library not loaded. Check vendor script.');
  }

  if (state.ggwaveReady) {
    await state.ggwaveReady;
  }

  state.ggwaveReady = (async () => {
    if (typeof sampleRateOverride === 'number' && Number.isFinite(sampleRateOverride)) {
      state.sampleRate = Math.round(sampleRateOverride);
    }

    if (state.ggwave && state.ggwaveInstance !== null) {
      try {
        state.ggwave.free(state.ggwaveInstance);
      } catch (err) {
        console.warn('Failed to free previous ggwave instance', err);
      }
      state.ggwaveInstance = null;
    }

    const module = await window.ggwave_factory();
    try {
      module.disableLog();
    } catch (err) {
      console.warn('Unable to disable ggwave logs', err);
    }

    const params = module.getDefaultParameters();
    params.sampleRateInp = state.sampleRate;
    params.sampleRateOut = state.sampleRate;
    params.sampleFormatInp = module.SampleFormat.GGWAVE_SAMPLE_FORMAT_I16;
    params.sampleFormatOut = module.SampleFormat.GGWAVE_SAMPLE_FORMAT_I16;
    params.operatingMode = module.GGWAVE_OPERATING_MODE_RX_AND_TX;
    const instance = module.init(params);
    if (instance === undefined || instance === null) {
      throw new Error('Received invalid ggwave instance pointer');
    }

    state.ggwave = module;
    state.ggwaveInstance = instance;
    state.ggwaveParams = params;
  })();

  try {
    await state.ggwaveReady;
  } finally {
    state.ggwaveReady = null;
  }
}

async function ensureAudioContext() {
  if (!state.audioContext) {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    const context = new AudioContext();
    state.audioContext = context;
    state.audioWorkletRegistered = false;

    const actualRate = Math.round(context.sampleRate);
    if (actualRate !== state.sampleRate) {
      const restoreEncode = elements.generateSound.disabled;
      elements.generateSound.disabled = true;
      const startButtonsWereEnabled = decodePanels.some(
        (panel) => panel.startButton && panel.startButton.disabled === false
      );
      setDecodeStartButtonsEnabled(false);
      try {
        await rebuildGGWave(actualRate);
      } finally {
        elements.generateSound.disabled = restoreEncode;
        if (startButtonsWereEnabled) {
          setDecodeStartButtonsEnabled(true);
        } else {
          setDecodeStartButtonsEnabled(false);
        }
      }
    }
    return context;
  }

  if (state.audioContext.state === 'suspended') {
    await state.audioContext.resume();
  }

  return state.audioContext;
}

function cleanupRecordingNodes() {
  if (state.processorNode) {
    state.processorNode.disconnect();
    const isWorkletNode = typeof AudioWorkletNode !== 'undefined' && state.processorNode instanceof AudioWorkletNode;
    if (isWorkletNode) {
      state.processorNode.port.onmessage = null;
    } else {
      state.processorNode.onaudioprocess = null;
    }
  }
  if (state.analyserNode) {
    state.analyserNode.disconnect();
  }
  if (state.sourceNode) {
    try {
      state.sourceNode.disconnect();
    } catch (err) {
      console.warn('Source already disconnected', err);
    }
  }
  state.processorNode = null;
  state.analyserNode = null;
  state.sourceNode = null;
}

function stopStream() {
  if (state.stream) {
    state.stream.getTracks().forEach((track) => track.stop());
  }
  state.stream = null;
}

function showToast(message) {
  if (!elements.toast) return;
  elements.toast.textContent = message;
  elements.toast.classList.add('active');
  window.setTimeout(() => {
    elements.toast.classList.remove('active');
  }, 2400);
}

function isAudioEngineReady() {
  return !!(state.ggwave && state.ggwaveInstance !== null && !state.ggwaveReady);
}

function setDecodeStartButtonsEnabled(enabled) {
  const shouldEnable = enabled && !state.recording && isAudioEngineReady();
  decodePanels.forEach((panel) => {
    if (panel.startButton) {
      panel.startButton.disabled = !shouldEnable;
    }
  });
}

function getModeConfig(mode) {
  return MODE_CONFIG[mode] || MODE_CONFIG.audible;
}

function formatModeLabel(mode) {
  return mode === 'ultrasound' ? 'Ultrasound' : mode === 'audible' ? 'Audible' : '';
}

function updateModeNotes(mode) {
  const config = getModeConfig(mode);
  modeNotes.forEach((note) => {
    note.textContent = config.note;
  });
}

function updateModeButtons(mode) {
  modeButtons.forEach((button) => {
    const buttonMode = button.dataset.modeOption === 'ultrasound' ? 'ultrasound' : 'audible';
    button.classList.toggle('active', buttonMode === mode);
  });
}

function updateIdleStatuses() {
  if (state.recording) return;
  const config = getModeConfig(state.transmissionMode);
  decodePanels.forEach((panel) => {
    if (panel.status) {
      panel.status.textContent = config.idleText;
    }
  });
}

function setTransmissionMode(mode, { skipSave = false } = {}) {
  const normalized = mode === 'ultrasound' ? 'ultrasound' : 'audible';
  state.transmissionMode = normalized;
  updateModeButtons(normalized);
  updateModeNotes(normalized);
  if (!skipSave) {
    try {
      localStorage.setItem('audiolink-mode', normalized);
    } catch (err) {
      console.warn('Failed to persist mode selection', err);
    }
  }
  updateIdleStatuses();
}

function initTransmissionMode() {
  try {
    const saved = localStorage.getItem('audiolink-mode');
    const initial = saved === 'ultrasound' ? 'ultrasound' : 'audible';
    setTransmissionMode(initial, { skipSave: true });
  } catch (err) {
    console.warn('Failed to restore mode selection', err);
    setTransmissionMode('audible', { skipSave: true });
  }
}

function toggleRecordingUI(panel, active) {
  if (!panel) return;
  const config = getModeConfig(state.transmissionMode);
  if (active) {
    setDecodeStartButtonsEnabled(false);
  } else if (isAudioEngineReady()) {
    setDecodeStartButtonsEnabled(true);
  }

  if (panel.stopButton) {
    panel.stopButton.disabled = !active;
  }

  if (panel.indicator) {
    panel.indicator.classList.toggle('active', active);
  }

  if (panel.status) {
    panel.status.textContent = active ? config.listeningText : config.idleText;
  }

  if (!active) {
    updateIdleStatuses();
  }
}

function formatRelativeTime(timestamp) {
  if (!timestamp) return '';
  const diff = Date.now() - timestamp;
  const seconds = Math.floor(diff / 1000);
  if (seconds < 45) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min${minutes === 1 ? '' : 's'} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hr${hours === 1 ? '' : 's'} ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} day${days === 1 ? '' : 's'} ago`;
  const date = new Date(timestamp);
  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function getScanHistoryKey() {
  return state.user ? `audiolink-scan-history-${state.user.email}` : 'audiolink-scan-history-public';
}

function loadScanHistory() {
  const key = getScanHistoryKey();
  try {
    const raw = localStorage.getItem(key);
    if (!raw) {
      state.scanHistory = [];
      return;
    }
    const parsed = JSON.parse(raw);
    state.scanHistory = Array.isArray(parsed)
      ? parsed
          .filter((item) => item && item.url)
          .map((item) => ({
            id: item.id || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            text: item.text || '',
            url: item.url,
            timestamp: item.timestamp || Date.now(),
            meta: item.meta || null,
            mode: item.mode === 'ultrasound' ? 'ultrasound' : 'audible',
          }))
      : [];
  } catch (err) {
    console.warn('Failed to load scan history', err);
    state.scanHistory = [];
  }
  if (state.scanHistory.length > MAX_HISTORY_ITEMS) {
    state.scanHistory.length = MAX_HISTORY_ITEMS;
  }
}

function saveScanHistory() {
  const key = getScanHistoryKey();
  try {
    localStorage.setItem(key, JSON.stringify(state.scanHistory));
  } catch (err) {
    console.warn('Failed to save scan history', err);
  }
}

function renderScanHistory() {
  decodePanels.forEach((panel) => {
    if (!panel.historyList || !panel.historyEmpty) return;
    const items = state.scanHistory.slice(0, MAX_HISTORY_ITEMS);
    const list = panel.historyList;
    const empty = panel.historyEmpty;

    list.innerHTML = '';

    if (!items.length) {
      empty.style.display = 'block';
      list.style.display = 'none';
      return;
    }

    empty.style.display = 'none';
    list.style.display = 'flex';

    items.forEach((entry) => {
      const li = document.createElement('li');
      li.className = 'history-item';

      const anchor = document.createElement('a');
      anchor.href = entry.url || '#';
      anchor.target = '_blank';
      anchor.rel = 'noopener noreferrer';
      anchor.textContent = entry.meta?.title || entry.url || entry.text || 'View link';
      li.appendChild(anchor);

      const metaLine = document.createElement('span');
      metaLine.className = 'history-item__meta';
      let hostText = '';
      if (entry.meta?.siteName) {
        hostText = entry.meta.siteName;
      } else if (entry.url) {
        try {
          hostText = new URL(entry.url).hostname;
        } catch (err) {
          hostText = entry.url;
        }
      }

      const relative = formatRelativeTime(entry.timestamp);
      const metaParts = [];
      const modeLabel = formatModeLabel(entry.mode);
      if (modeLabel) metaParts.push(modeLabel);
      if (hostText) metaParts.push(hostText);
      if (relative) metaParts.push(relative);
      if (metaParts.length) {
        metaLine.textContent = metaParts.join(' • ');
        li.appendChild(metaLine);
      }

      const descriptionText = entry.meta?.description || '';
      if (descriptionText) {
        const desc = document.createElement('p');
        desc.className = 'history-item__description';
        desc.textContent = descriptionText;
        li.appendChild(desc);
      }

      if (!descriptionText && entry.text) {
        const original = document.createElement('p');
        original.className = 'history-item__description';
        original.textContent = entry.text;
        li.appendChild(original);
      }

      list.appendChild(li);
    });
  });
}

function getEncodeHistoryKey() {
  if (!state.user) return null;
  return `audiolink-encode-history-${state.user.email}`;
}

function loadEncodeHistory() {
  const key = getEncodeHistoryKey();
  if (!key) {
    state.encodeHistory = [];
    return;
  }
  try {
    const raw = localStorage.getItem(key);
    if (!raw) {
      state.encodeHistory = [];
      return;
    }
    const parsed = JSON.parse(raw);
    state.encodeHistory = Array.isArray(parsed)
      ? parsed
          .filter((item) => item && item.url)
          .map((item) => ({
            id: item.id || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            text: item.text || '',
            url: item.url,
            timestamp: item.timestamp || Date.now(),
            meta: item.meta || null,
            mode: item.mode === 'ultrasound' ? 'ultrasound' : 'audible',
          }))
      : [];
  } catch (err) {
    console.warn('Failed to load encode history', err);
    state.encodeHistory = [];
  }
  if (state.encodeHistory.length > MAX_HISTORY_ITEMS) {
    state.encodeHistory.length = MAX_HISTORY_ITEMS;
  }
}

function saveEncodeHistory() {
  const key = getEncodeHistoryKey();
  if (!key) return;
  try {
    localStorage.setItem(key, JSON.stringify(state.encodeHistory));
  } catch (err) {
    console.warn('Failed to save encode history', err);
  }
}

function renderEncodeHistory() {
  if (!encodeHistoryElements.container || !encodeHistoryElements.list || !encodeHistoryElements.empty) {
    return;
  }

  const items = state.encodeHistory.slice(0, MAX_HISTORY_ITEMS);
  const { list, empty } = encodeHistoryElements;
  list.innerHTML = '';

  if (!state.user) {
    empty.textContent = 'Log in to generate and track audio links.';
    empty.style.display = 'block';
    list.style.display = 'none';
    return;
  }

  if (!items.length) {
    empty.textContent = 'No generated links yet.';
    empty.style.display = 'block';
    list.style.display = 'none';
    return;
  }

  empty.style.display = 'none';
  list.style.display = 'flex';

  items.forEach((entry) => {
    const li = document.createElement('li');
    li.className = 'history-item';

    const anchor = document.createElement('a');
    anchor.href = entry.url || '#';
    anchor.target = '_blank';
    anchor.rel = 'noopener noreferrer';
    anchor.textContent = entry.meta?.title || entry.url || entry.text || 'View link';
    li.appendChild(anchor);

    const metaLine = document.createElement('span');
    metaLine.className = 'history-item__meta';
    let hostText = '';
    if (entry.meta?.siteName) {
      hostText = entry.meta.siteName;
    } else if (entry.url) {
      try {
        hostText = new URL(entry.url).hostname;
      } catch (err) {
        hostText = entry.url;
      }
    }
    const relative = formatRelativeTime(entry.timestamp);
    const metaParts = [];
    const modeLabel = formatModeLabel(entry.mode);
    if (modeLabel) metaParts.push(modeLabel);
    if (hostText) metaParts.push(hostText);
    if (relative) metaParts.push(relative);
    if (metaParts.length) {
      metaLine.textContent = metaParts.join(' • ');
      li.appendChild(metaLine);
    }

    const encodeDescription = entry.meta?.description || entry.text;
    if (encodeDescription) {
      const snippet = document.createElement('p');
      snippet.className = 'history-item__description';
      snippet.textContent = encodeDescription;
      li.appendChild(snippet);
    }

    list.appendChild(li);
  });
}

function refreshHistories() {
  loadScanHistory();
  renderScanHistory();
  loadEncodeHistory();
  renderEncodeHistory();
}

async function addEncodeHistoryEntry(text) {
  if (!state.user) return;
  const detectedUrl = detectFirstUrl(text);
  if (!detectedUrl) return;
  const normalized = normalizeUrl(detectedUrl);
  if (!normalized) return;

  const entry = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    text,
    url: normalized,
    timestamp: Date.now(),
    meta: null,
    mode: state.transmissionMode,
  };

  state.encodeHistory = state.encodeHistory.filter((item) => item.url !== normalized);
  state.encodeHistory.unshift(entry);
  if (state.encodeHistory.length > MAX_HISTORY_ITEMS) {
    state.encodeHistory.length = MAX_HISTORY_ITEMS;
  }
  saveEncodeHistory();
  renderEncodeHistory();

  try {
    const metadata = await fetchLinkMetadata(normalized);
    const hasEntry = state.encodeHistory.some((item) => item.id === entry.id);
    if (hasEntry) {
      entry.meta = {
        title: metadata.title || normalized,
        description: metadata.description || '',
        image: metadata.image || '',
        siteName: metadata.siteName || '',
      };
      saveEncodeHistory();
      renderEncodeHistory();
    }
  } catch (err) {
    console.warn('Encode history metadata fetch failed', err);
    const hasEntry = state.encodeHistory.some((item) => item.id === entry.id);
    if (hasEntry) {
      entry.meta = entry.meta || {
        title: normalized,
        description: '',
        image: '',
        siteName: '',
      };
      saveEncodeHistory();
      renderEncodeHistory();
    }
  }
}

const urlMatchRegex = /((https?:\/\/|www\.)[^\s]+)/i;

function stripTrailingPunctuation(str) {
  return str.replace(/[),.?!'"\]]+$/gu, '');
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

function hideLinkPreview(panel) {
  panel.linkPreviewPending = null;
  if (!panel.linkPreview) return;
  panel.linkPreview.classList.add('hidden');
  panel.linkPreview.classList.remove('loading');
  if (panel.linkTitle) panel.linkTitle.textContent = '';
  if (panel.linkDescription) panel.linkDescription.textContent = '';
  if (panel.linkHost) panel.linkHost.textContent = '';
  if (panel.linkImageWrapper) panel.linkImageWrapper.classList.add('hidden');
  if (panel.linkImage) panel.linkImage.removeAttribute('src');
  if (panel.linkAnchor) panel.linkAnchor.href = '#';
}

async function fetchLinkMetadata(url) {
  if (!window.fetch || typeof DOMParser === 'undefined') {
    throw new Error('Metadata fetch not supported');
  }

  const parser = new DOMParser();
  const targets = [`https://r.jina.ai/${encodeURI(url)}`];

  try {
    const original = new URL(url);
    if (original.origin === window.location.origin) {
      targets.push(url);
    }
  } catch (err) {
    // ignore parse errors
  }

  let lastError = null;
  for (const target of targets) {
    try {
      const response = await fetch(target);
      if (!response.ok) {
        lastError = new Error(`Metadata request failed: ${response.status}`);
        continue;
      }
      const html = await response.text();
      const doc = parser.parseFromString(html, 'text/html');
      const getContent = (selector) => doc.querySelector(selector)?.getAttribute('content')?.trim() || '';
      const title = getContent('meta[property="og:title"]') || doc.title?.trim() || '';
      const description =
        getContent('meta[property="og:description"]') || getContent('meta[name="description"]') || '';
      const image = getContent('meta[property="og:image"]') || '';
      const siteName = getContent('meta[property="og:site_name"]') || '';
      return { title, description, image, siteName };
    } catch (err) {
      lastError = err;
    }
  }

  throw lastError || new Error('Unable to fetch link metadata');
}

async function showLinkPreview(panel, rawUrl, historyEntry) {
  if (!panel.linkPreview || !panel.linkAnchor) return;

  const normalized = normalizeUrl(rawUrl);
  if (!normalized) {
    hideLinkPreview(panel);
    if (historyEntry) {
      historyEntry.meta = null;
      saveScanHistory();
      renderScanHistory();
    }
    return;
  }

  let hostname = normalized;
  try {
    hostname = new URL(normalized).hostname;
  } catch (err) {
    // ignore parse errors and fall back to the normalized string
  }

  panel.linkPreviewPending = Symbol('linkPreview');
  const requestToken = panel.linkPreviewPending;

  panel.linkAnchor.href = normalized;
  if (panel.linkHost) panel.linkHost.textContent = hostname;
  if (panel.linkTitle) panel.linkTitle.textContent = hostname;
  if (panel.linkDescription) panel.linkDescription.textContent = 'Fetching preview...';
  if (panel.linkImageWrapper) panel.linkImageWrapper.classList.add('hidden');
  if (panel.linkImage) panel.linkImage.removeAttribute('src');
  panel.linkPreview.classList.remove('hidden');
  panel.linkPreview.classList.add('loading');

  if (historyEntry) {
    const hasEntry = state.scanHistory.some((item) => item.id === historyEntry.id);
    if (hasEntry) {
      historyEntry.url = normalized;
      historyEntry.meta = {
        siteName: hostname,
      };
      saveScanHistory();
      renderScanHistory();
    }
  }

  try {
    const metadata = await fetchLinkMetadata(normalized);
    if (panel.linkPreviewPending !== requestToken) return;

    panel.linkPreview.classList.remove('loading');

    const title = metadata.title || hostname;
    const description = metadata.description || normalized;
    const siteName = metadata.siteName || hostname;

    if (panel.linkTitle) panel.linkTitle.textContent = title;
    if (panel.linkDescription) panel.linkDescription.textContent = description;
    if (panel.linkHost) panel.linkHost.textContent = siteName;

    if (panel.linkImage && panel.linkImageWrapper) {
      if (metadata.image) {
        panel.linkImage.src = metadata.image;
        panel.linkImage.alt = title;
        panel.linkImageWrapper.classList.remove('hidden');
      } else {
        panel.linkImage.removeAttribute('src');
        panel.linkImageWrapper.classList.add('hidden');
      }
    }

    if (historyEntry) {
      const hasEntry = state.scanHistory.some((item) => item.id === historyEntry.id);
      if (hasEntry) {
        historyEntry.meta = {
          title,
          description,
          image: metadata.image || '',
          siteName,
        };
        saveScanHistory();
        renderScanHistory();
      }
    }
  } catch (err) {
    console.warn('Link preview fetch failed', err);
    if (panel.linkPreviewPending !== requestToken) return;
    panel.linkPreview.classList.remove('loading');
    if (panel.linkTitle) panel.linkTitle.textContent = hostname;
    if (panel.linkDescription) panel.linkDescription.textContent = normalized;
    if (panel.linkHost) panel.linkHost.textContent = hostname;
    if (panel.linkImageWrapper) panel.linkImageWrapper.classList.add('hidden');
    if (panel.linkImage) panel.linkImage.removeAttribute('src');
    if (historyEntry) {
      const hasEntry = state.scanHistory.some((item) => item.id === historyEntry.id);
      if (hasEntry) {
        historyEntry.meta = {
          title: hostname,
          description: normalized,
          image: '',
          siteName: hostname,
        };
        saveScanHistory();
        renderScanHistory();
      }
    }
  } finally {
    if (panel.linkPreviewPending === requestToken) {
      panel.linkPreviewPending = null;
    }
  }
}

function updateLinkPreview(panel, text, historyEntry) {
  if (!panel.linkPreview) return;
  const detectedUrl = detectFirstUrl(text);
  if (!detectedUrl) {
    hideLinkPreview(panel);
    if (historyEntry) {
      const hasEntry = state.scanHistory.some((item) => item.id === historyEntry.id);
      if (hasEntry) {
        historyEntry.meta = null;
        saveScanHistory();
        renderScanHistory();
      }
    }
    return;
  }
  void showLinkPreview(panel, detectedUrl, historyEntry);
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

function getProtocolIdForCurrentMode() {
  if (!state.ggwave || !state.ggwave.ProtocolId) return null;
  const { ProtocolId } = state.ggwave;
  return state.transmissionMode === 'ultrasound'
    ? ProtocolId.GGWAVE_PROTOCOL_ULTRASOUND_FAST
    : ProtocolId.GGWAVE_PROTOCOL_AUDIBLE_FAST;
}

function mergeInt16Chunks(chunks) {
  const total = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
  const merged = new Int16Array(total);
  let offset = 0;
  chunks.forEach((chunk) => {
    merged.set(chunk, offset);
    offset += chunk.length;
  });
  return merged;
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

  writeString(0, 'RIFF');
  view.setUint32(4, 36 + dataLength, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true);
  writeString(36, 'data');
  view.setUint32(40, dataLength, true);

  let offset = 44;
  for (let i = 0; i < int16Data.length; i += 1) {
    view.setInt16(offset, int16Data[i], true);
    offset += 2;
  }

  return new Blob([view], { type: 'audio/wav' });
}

function playPreviewAudio() {
  if (!state.encodedBlob) return;
  elements.previewAudio.hidden = false;
  if (elements.previewAudio.src) {
    elements.previewAudio.currentTime = 0;
  } else {
    const url = URL.createObjectURL(state.encodedBlob);
    elements.previewAudio.src = url;
  }
  elements.previewAudio.play().catch((err) => {
    console.warn('Unable to autoplay audio preview', err);
    showToast('Press play on the audio player to hear the sound.');
  });
}

function resetEncodeUI() {
  state.encodedBlob = null;
  state.encodedWaveform = null;
  state.encodedSamples = null;
  elements.playSound.disabled = true;
  elements.downloadSound.disabled = true;
  elements.previewAudio.hidden = true;
  if (elements.previewAudio.src) {
    URL.revokeObjectURL(elements.previewAudio.src);
    elements.previewAudio.src = '';
  }
}

function renderVisualiser(panel) {
  if (state.visualiserFrame && state.visualiserPanel && state.visualiserPanel !== panel) {
    cancelAnimationFrame(state.visualiserFrame);
    state.visualiserFrame = null;
    state.visualiserPanel = null;
  }

  if (!state.analyserNode || !state.recording || !panel) {
    if (state.visualiserFrame) {
      cancelAnimationFrame(state.visualiserFrame);
      state.visualiserFrame = null;
      state.visualiserPanel = null;
    }
    return;
  }

  const canvas = panel.canvas;
  if (!canvas) return;

  const ctx = panel.canvasContext || canvas.getContext('2d');
  panel.canvasContext = ctx;

  const rect = canvas.getBoundingClientRect();
  const width = Math.max(1, Math.floor(rect.width));
  const height = Math.max(1, Math.floor(rect.height));
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }

  const bufferLength = state.analyserNode.fftSize;
  const dataArray = new Uint8Array(bufferLength);

  const draw = () => {
    if (!state.analyserNode || !state.recording || state.activeDecodePanel !== panel) {
      if (state.visualiserFrame) {
        cancelAnimationFrame(state.visualiserFrame);
        state.visualiserFrame = null;
        state.visualiserPanel = null;
      }
      return;
    }

    state.analyserNode.getByteTimeDomainData(dataArray);

    ctx.fillStyle = 'rgba(10, 14, 20, 0.8)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.lineWidth = 2;
    ctx.strokeStyle = 'rgba(109, 113, 255, 0.85)';
    ctx.beginPath();

    const sliceWidth = canvas.width / bufferLength;
    let x = 0;

    for (let i = 0; i < bufferLength; i += 1) {
      const v = dataArray[i] / 128.0;
      const y = (v * canvas.height) / 2;

      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
      x += sliceWidth;
    }

    ctx.lineTo(canvas.width, canvas.height / 2);
    ctx.stroke();

    state.visualiserFrame = requestAnimationFrame(draw);
    state.visualiserPanel = panel;
  };

  state.visualiserFrame = requestAnimationFrame(draw);
  state.visualiserPanel = panel;
}

async function handleGenerateSound() {
  try {
    await ensureAudioContext();
  } catch (err) {
    console.warn('Unable to initialise audio context before encoding', err);
  }

  if (state.ggwaveReady) {
    try {
      await state.ggwaveReady;
    } catch (err) {
      console.error('Audio engine failed to initialise', err);
      showToast('Audio engine failed to load. Refresh the page to try again.');
      return;
    }
  }

  if (!state.ggwave || state.ggwaveInstance === null) {
    showToast('Audio engine is still warming up. Try again in a second.');
    return;
  }
  const text = elements.encodeInput.value.trim();
  if (!text) {
    showToast('Enter text to encode into sound.');
    resetEncodeUI();
    return;
  }

  try {
    const protocolId = getProtocolIdForCurrentMode() || state.ggwave.ProtocolId.GGWAVE_PROTOCOL_AUDIBLE_FAST;
    const waveform = state.ggwave.encode(state.ggwaveInstance, text, protocolId, 10);

    if (!waveform || !waveform.length) {
      throw new Error('No waveform returned from ggwave.');
    }

    const waveformCopy = new Int8Array(waveform);
    const int16Samples = new Int16Array(waveformCopy.buffer.slice(0));
    state.encodedWaveform = waveformCopy;
    state.encodedSamples = int16Samples;
    state.encodedBlob = createWavBlob(int16Samples, state.sampleRate);
    elements.playSound.disabled = false;
    elements.downloadSound.disabled = false;
    elements.previewAudio.hidden = false;

    if (elements.previewAudio.src) {
      URL.revokeObjectURL(elements.previewAudio.src);
    }
    elements.previewAudio.src = URL.createObjectURL(state.encodedBlob);
    elements.previewAudio.load();
    showToast('Sound link ready — press play to preview.');
    if (state.user) {
      void addEncodeHistoryEntry(text);
    }
  } catch (err) {
    console.error('Failed to generate sound', err);
    showToast('Something went wrong while generating the sound.');
  }
}

function handleDownloadSound() {
  if (!state.encodedBlob) return;
  const link = document.createElement('a');
  link.href = URL.createObjectURL(state.encodedBlob);
  link.download = 'audio-link.wav';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.setTimeout(() => URL.revokeObjectURL(link.href), 2000);
}

async function handleStartRecording(panel) {
  if (!panel) return;
  if (state.recording) {
    showToast('Already listening — stop the current scan first.');
    return;
  }

  try {
    await ensureAudioContext();
  } catch (err) {
    console.warn('Unable to initialise audio context before recording', err);
  }

  if (state.ggwaveReady) {
    try {
      await state.ggwaveReady;
    } catch (err) {
      console.error('Audio engine failed to initialise', err);
      showToast('Audio engine failed to load. Refresh the page to try again.');
      return;
    }
  }

  if (state.ggwaveInstance === null) {
    showToast('Audio engine is still warming up. Try again in a moment.');
    return;
  }

  const audioContext = state.audioContext || (await ensureAudioContext());

  hideLinkPreview(panel);
  panel.linkPreviewPending = null;

  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        noiseSuppression: false,
        echoCancellation: false,
        autoGainControl: false,
        channelCount: 1,
      },
    });
    state.stream = stream;
  } catch (err) {
    console.error('Microphone permission denied', err);
    showToast('Microphone access is required to decode sounds.');
    return;
  }

  await audioContext.resume();

  state.sourceNode = audioContext.createMediaStreamSource(state.stream);
  state.analyserNode = audioContext.createAnalyser();
  state.analyserNode.fftSize = 512;
  state.analyserNode.smoothingTimeConstant = 0.85;

  state.recordedChunks = [];

  if (audioContext.audioWorklet && audioContext.audioWorklet.addModule) {
    if (!state.audioWorkletRegistered) {
      const workletBlob = new Blob([recorderWorkletSource], {
        type: 'application/javascript',
      });
      const workletUrl = URL.createObjectURL(workletBlob);
      try {
        await audioContext.audioWorklet.addModule(workletUrl);
        state.audioWorkletRegistered = true;
      } finally {
        URL.revokeObjectURL(workletUrl);
      }
    }

    const recorderNode = new AudioWorkletNode(audioContext, 'ggwave-recorder');
    recorderNode.port.onmessage = (event) => {
      const buffer = event.data;
      if (buffer && buffer.byteLength) {
        state.recordedChunks.push(new Int16Array(buffer));
      }
    };

    state.processorNode = recorderNode;
    state.sourceNode.connect(state.analyserNode);
    state.analyserNode.connect(state.processorNode);
    const silentGain = audioContext.createGain();
    silentGain.gain.value = 0;
    state.processorNode.connect(silentGain);
    silentGain.connect(audioContext.destination);
  } else {
    console.warn('Falling back to deprecated ScriptProcessorNode');
    state.processorNode = audioContext.createScriptProcessor(2048, 1, 1);
    const silentGain = audioContext.createGain();
    silentGain.gain.value = 0;

    state.sourceNode.connect(state.analyserNode);
    state.analyserNode.connect(state.processorNode);
    state.processorNode.connect(silentGain);
    silentGain.connect(audioContext.destination);

    state.processorNode.onaudioprocess = (event) => {
      if (!state.recording) return;
      const channelData = event.inputBuffer.getChannelData(0);
      const chunk = convertFloat32ToInt16(channelData);
      state.recordedChunks.push(chunk);
    };
  }

  state.activeDecodePanel = panel;
  if (panel.resultCard) {
    panel.resultCard.classList.add('hidden');
  }
  if (panel.decodedText) {
    panel.decodedText.textContent = '';
  }

  state.recording = true;
  toggleRecordingUI(panel, true);
  renderVisualiser(panel);
  const modeConfig = getModeConfig(state.transmissionMode);
  showToast(modeConfig.listeningText);
}

async function handleStopRecording(panel, { skipDecode = false } = {}) {
  const targetPanel = panel || state.activeDecodePanel;
  if (!state.recording || !targetPanel) return;
  state.recording = false;

  hideLinkPreview(targetPanel);
  toggleRecordingUI(targetPanel, false);
  if (state.visualiserFrame) {
    cancelAnimationFrame(state.visualiserFrame);
    state.visualiserFrame = null;
    state.visualiserPanel = null;
  }

  cleanupRecordingNodes();
  stopStream();

  if (skipDecode) {
    state.recordedChunks = [];
    state.activeDecodePanel = null;
    if (isAudioEngineReady()) {
      setDecodeStartButtonsEnabled(true);
    }
    return;
  }

  if (!state.recordedChunks.length) {
    showToast('No audio captured — try again.');
    state.activeDecodePanel = null;
    hideLinkPreview(targetPanel);
    if (isAudioEngineReady()) {
      setDecodeStartButtonsEnabled(true);
    }
    return;
  }

  const merged = mergeInt16Chunks(state.recordedChunks);
  state.recordedChunks = [];
  if (!merged.length) {
    showToast('No audio captured — try again.');
    state.activeDecodePanel = null;
    hideLinkPreview(targetPanel);
    if (isAudioEngineReady()) {
      setDecodeStartButtonsEnabled(true);
    }
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
    const decoded = state.ggwave.decode(state.ggwaveInstance, byteView);
    let displayText = '';
    if (decoded && decoded.length) {
      let end = decoded.length;
      while (end > 0 && decoded[end - 1] === 0) {
        end -= 1;
      }
      const trimmed = decoded.subarray(0, end);
      displayText = trimmed.length ? textDecoder.decode(trimmed) : '';
    }

    if (displayText) {
      let historyEntry = null;
      const detectedUrl = detectFirstUrl(displayText);
      if (detectedUrl) {
        const normalized = normalizeUrl(detectedUrl);
        if (normalized) {
          historyEntry = {
            id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            text: displayText,
            url: normalized,
            timestamp: Date.now(),
            meta: null,
            mode: state.transmissionMode,
          };
          state.scanHistory = state.scanHistory.filter((entry) => entry.url !== normalized);
          state.scanHistory.unshift(historyEntry);
          if (state.scanHistory.length > MAX_HISTORY_ITEMS) {
            state.scanHistory.length = MAX_HISTORY_ITEMS;
          }
          saveScanHistory();
          renderScanHistory();
        }
      }

      if (targetPanel.decodedText) {
        targetPanel.decodedText.textContent = displayText;
      }
      if (targetPanel.resultCard) {
        targetPanel.resultCard.classList.remove('hidden');
      }
      updateLinkPreview(targetPanel, displayText, historyEntry);
      showToast('Decoded a message successfully.');
    } else {
      if (targetPanel.decodedText) {
        targetPanel.decodedText.textContent = 'No clear transmission detected.';
      }
      if (targetPanel.resultCard) {
        targetPanel.resultCard.classList.remove('hidden');
      }
      hideLinkPreview(targetPanel);
      showToast('No readable message found in the recording.');
    }
  } catch (err) {
    console.error('Failed to decode sound', err);
    hideLinkPreview(targetPanel);
    showToast('Decoding failed. Try recording the sound again.');
  } finally {
    state.activeDecodePanel = null;
    if (isAudioEngineReady()) {
      setDecodeStartButtonsEnabled(true);
    }
    updateIdleStatuses();
  }
}

async function handleAuthSubmit(event) {
  event.preventDefault();
  const formData = new FormData(elements.authForm);
  const email = (formData.get('email') || '').toString().trim().toLowerCase();
  const password = (formData.get('password') || '').toString();

  if (!email || !password) {
    showToast('Please fill in both email and password.');
    return;
  }

  state.user = { email };
  saveUser(state.user);
  showView('dashboard');
  refreshHistories();
  updateIdleStatuses();
  showToast(`Signed in as ${email}`);
}

function handleLogout() {
  state.user = null;
  saveUser(null);
  showView('landing');
  refreshHistories();
  updateIdleStatuses();
  showToast('Logged out.');
}

async function bootstrap() {
  const storedUser = loadUser();
  if (storedUser) {
    state.user = storedUser;
    showView('dashboard');
  } else {
    showView('landing');
  }

  elements.generateSound.disabled = true;
  setDecodeStartButtonsEnabled(false);
  decodePanels.forEach((panel) => {
    if (panel.stopButton) {
      panel.stopButton.disabled = true;
    }
  });

  initTransmissionMode();
  refreshHistories();

  try {
    await rebuildGGWave();
    elements.generateSound.disabled = false;
    setDecodeStartButtonsEnabled(true);
    decodePanels.forEach((panel) => {
      if (panel.stopButton) {
        panel.stopButton.disabled = true;
      }
    });
    showToast('Audio engine ready — you can encode or decode now.');
  } catch (err) {
    console.error('Failed to initialise ggwave', err);
    showToast('Could not load audio engine. Refresh to try again.');
    state.ggwaveReady = null;
  }
}

function wireEvents() {
  const authButton = document.querySelector('[data-action="open-auth"]');
  authButton?.addEventListener('click', () => showView('auth'));

  modeButtons.forEach((button) => {
    button.addEventListener('click', () => {
      const selectedMode = button.dataset.modeOption === 'ultrasound' ? 'ultrasound' : 'audible';
      if (state.recording && selectedMode !== state.transmissionMode) {
        showToast('Stop listening before switching modes.');
        return;
      }
      setTransmissionMode(selectedMode);
    });
  });

  const scrollScanButton = document.querySelector('[data-action="scroll-to-scan"]');
  scrollScanButton?.addEventListener('click', () => {
    showView('landing');
    if (decodePanels[0]?.root) {
      decodePanels[0].root.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  });

  document
    .querySelector('[data-action="open-encode"]')
    ?.addEventListener('click', () => {
      showView('auth');
      setActiveTab('encode');
    });

  document
    .querySelector('[data-action="back-home"]')
    ?.addEventListener('click', () => showView('landing'));

  document
    .querySelector('[data-action="logout"]')
    ?.addEventListener('click', handleLogout);

  tabs.forEach((tab) =>
    tab.addEventListener('click', () => setActiveTab(tab.dataset.tab))
  );

  elements.authForm.addEventListener('submit', handleAuthSubmit);
  elements.generateSound.addEventListener('click', handleGenerateSound);
  elements.playSound.addEventListener('click', playPreviewAudio);
  elements.downloadSound.addEventListener('click', handleDownloadSound);

  decodePanels.forEach((panel) => {
    panel.startButton?.addEventListener('click', () => handleStartRecording(panel));
    panel.stopButton?.addEventListener('click', () => handleStopRecording(panel));
    panel.copyButton?.addEventListener('click', async () => {
      const text = panel.decodedText?.textContent?.trim();
      if (!text) {
        showToast('Nothing to copy yet.');
        return;
      }
      if (!navigator.clipboard) {
        showToast('Clipboard not available in this browser.');
        return;
      }
      try {
        await navigator.clipboard.writeText(text);
        showToast('Copied to clipboard.');
      } catch (err) {
        console.warn('Clipboard copy failed', err);
        showToast('Copy failed. Try selecting the text manually.');
      }
    });
  });

  window.addEventListener('beforeunload', () => {
    cleanupRecordingNodes();
    stopStream();
    if (state.audioContext) {
      state.audioContext.close();
    }
    if (state.ggwave && state.ggwaveInstance !== null) {
      try {
        state.ggwave.free(state.ggwaveInstance);
      } catch (err) {
        console.warn('Failed to free ggwave instance', err);
      }
    }
  });
}

wireEvents();
bootstrap();
