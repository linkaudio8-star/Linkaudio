export const MAX_HISTORY_ITEMS = 12;
export const ONE_DAY_MS = 24 * 60 * 60 * 1000;
export const MAX_SCAN_EVENTS = 5000;

function normalizeScanEvents(rawEvents, now = Date.now()) {
  if (!Array.isArray(rawEvents) || rawEvents.length === 0) {
    return [];
  }
  const minTs = now - ONE_DAY_MS;
  const valid = rawEvents
    .map((value) => Number(value))
    .filter((value) => Number.isFinite(value) && value >= minTs && value <= now);
  if (!valid.length) {
    return [];
  }
  valid.sort((a, b) => a - b);
  if (valid.length > MAX_SCAN_EVENTS) {
    return valid.slice(valid.length - MAX_SCAN_EVENTS);
  }
  return valid;
}

function scanEventsWereNormalized(rawEvents, normalizedScanEvents) {
  if (!Array.isArray(rawEvents)) {
    return normalizedScanEvents.length > 0;
  }
  if (rawEvents.length !== normalizedScanEvents.length) {
    return true;
  }
  for (let i = 0; i < rawEvents.length; i += 1) {
    if (Number(rawEvents[i]) !== normalizedScanEvents[i]) {
      return true;
    }
  }
  return false;
}

export function getEncodeHistoryKey(scannerState) {
  if (!scannerState.user || !scannerState.user.email) return null;
  return `new-encode-history-${scannerState.user.email}`;
}

export function loadEncodeHistory(scannerState) {
  const key = getEncodeHistoryKey(scannerState);
  if (!key) {
    scannerState.encodeHistory = [];
    return;
  }
  let shouldPersistNormalized = false;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) {
      scannerState.encodeHistory = [];
      return;
    }
    const parsed = JSON.parse(raw);
    const now = Date.now();
    scannerState.encodeHistory = Array.isArray(parsed)
      ? parsed
          .filter((item) => item && item.url)
          .map((item) => {
            const rawScanEvents = Array.isArray(item.scanEvents) ? item.scanEvents : [];
            const scanEvents = normalizeScanEvents(rawScanEvents, now);
            if (scanEventsWereNormalized(rawScanEvents, scanEvents)) {
              shouldPersistNormalized = true;
            }
            return {
              id: item.id || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
              text: item.text || "",
              url: item.url,
              timestamp: item.timestamp || Date.now(),
              mode: "ultrasound",
              scanCount: typeof item.scanCount === "number" && Number.isFinite(item.scanCount) ? item.scanCount : 0,
              lastScan: typeof item.lastScan === "number" && Number.isFinite(item.lastScan) ? item.lastScan : null,
              scanEvents,
            };
          })
      : [];
  } catch (err) {
    console.warn("Failed to parse encode history", err);
    scannerState.encodeHistory = [];
  }
  if (scannerState.encodeHistory.length > MAX_HISTORY_ITEMS) {
    shouldPersistNormalized = true;
    scannerState.encodeHistory.length = MAX_HISTORY_ITEMS;
  }
  if (shouldPersistNormalized) {
    saveEncodeHistory(scannerState);
  }
}

export function saveEncodeHistory(scannerState) {
  const key = getEncodeHistoryKey(scannerState);
  if (!key) return;
  try {
    localStorage.setItem(key, JSON.stringify(scannerState.encodeHistory));
  } catch (err) {
    console.warn("Failed to persist encode history", err);
  }
}

export function formatRelativeTime(value) {
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

export function updateDashboardStats(scannerState, dom) {
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

export function renderEncodeHistory({
  scannerState,
  dom,
  onHistoryAction,
  showToast,
}) {
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

  const createIconButton = (label, svgMarkup, handler, className = "") => {
    const button = document.createElement("button");
    button.type = "button";
    button.className =
      `history-icon-button inline-flex flex-1 items-center justify-center rounded-2xl border border-slate-100 bg-white px-3 py-2 text-xs font-semibold text-slate-600 transition hover:border-slate-200 hover:text-slate-900 ${className}`.trim();
    button.innerHTML = `${svgMarkup}<span class="sr-only">${label}</span>`;
    button.addEventListener("click", handler);
    return button;
  };

  items.forEach((entry) => {
    const isPlayingThisEntry =
      scannerState.historyPlayEntryId &&
      scannerState.historyPlayEntryId === entry.id &&
      scannerState.historyPlayAudio;
    const isLoopingThisEntry =
      scannerState.historyLoopEntryId &&
      scannerState.historyLoopEntryId === entry.id &&
      scannerState.historyLoopAudio;
    const isPlaybackActive = isPlayingThisEntry || isLoopingThisEntry;
    const isCurrentEntry = scannerState.currentHistoryEntryId && scannerState.currentHistoryEntryId === entry.id;

    const li = document.createElement("li");
    li.className =
      "relative w-full overflow-hidden rounded-3xl border border-slate-100 bg-white/95 p-5 shadow-[0_15px_50px_-30px_rgba(15,23,42,0.35)] transition hover:-translate-y-0.5 hover:shadow-[0_20px_60px_-30px_rgba(15,23,42,0.45)]";
    if (isCurrentEntry) {
      li.classList.add("border-[#cfc7ff]", "bg-[#fafbff]");
    }
    li.addEventListener("click", (event) => {
      if (event.target instanceof Element && event.target.closest("button")) return;
      void onHistoryAction(entry, "select");
    });

    const header = document.createElement("div");
    header.className = "flex min-w-0 items-start gap-3";
    const titleWrap = document.createElement("div");
    titleWrap.className = "min-w-0 flex-1";
    const displayText = entry.url || entry.text || "Untitled link";
    titleWrap.innerHTML = `<p class="break-all text-base font-semibold text-slate-900">${displayText}</p><p class="text-xs text-slate-400">${formatRelativeTime(entry.timestamp)}</p>`;
    header.appendChild(titleWrap);
    const headerActions = document.createElement("div");
    headerActions.className = "ml-auto flex shrink-0 items-center gap-2";
    if (isCurrentEntry) {
      const currentBadge = document.createElement("span");
      currentBadge.className =
        "shrink-0 rounded-full bg-[#eef2ff] px-3 py-1 text-xs font-semibold text-slate-600";
      currentBadge.textContent = "Current";
      headerActions.appendChild(currentBadge);
    }
    header.appendChild(headerActions);
    li.appendChild(header);

    const stats = document.createElement("div");
    const scanCount = typeof entry.scanCount === "number" ? entry.scanCount : 0;
    const lastScanLabel = entry.lastScan ? formatRelativeTime(entry.lastScan) : "No scans yet";
    stats.className = "mt-4 flex flex-wrap items-center gap-3 text-xs text-slate-500";
    stats.innerHTML = `<span class="inline-flex items-center gap-1"><svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5 text-[#8b5cf6]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M4 12h16M4 6h16M4 18h16" /></svg>${scanCount} scan${scanCount === 1 ? "" : "s"}</span><span>Last scan: ${lastScanLabel}</span>`;
    li.appendChild(stats);

    const controls = document.createElement("div");
    controls.className = "mt-4 grid grid-cols-3 gap-2";
    const playBtn = document.createElement("button");
    playBtn.type = "button";
    playBtn.className = `history-icon-button inline-flex flex-1 items-center justify-center rounded-2xl border px-3 py-2 text-xs font-semibold transition ${
      isPlaybackActive
        ? "border-[#d9d2ff] bg-[#eef2ff] text-[#5b4ff5]"
        : "border-slate-100 bg-white text-slate-600 hover:border-slate-200 hover:text-slate-900"
    }`;
    playBtn.innerHTML = isPlaybackActive
      ? '<svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5" viewBox="0 0 24 24"><path fill="currentColor" d="M7 6h4v12H7zm6 0h4v12h-4z"/></svg><span class="sr-only">Pause</span>'
      : '<svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5" viewBox="0 0 24 24"><path fill="currentColor" d="M8 5v14l11-7z"/></svg><span class="sr-only">Play</span>';
    playBtn.addEventListener("click", () => {
      void onHistoryAction(entry, "play");
    });
    controls.appendChild(playBtn);
    controls.appendChild(
      createIconButton(
        "Open link",
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M13 7h4m0 0v4m0-4l-7 7M7 11v6h6"/></svg>',
        () => {
          void onHistoryAction(entry, "open");
        },
      ),
    );
    controls.appendChild(
      createIconButton(
        "Download audio",
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M6 20h12M12 4v10m0 0l4-4m-4 4l-4-4"/></svg>',
        () => {
          void onHistoryAction(entry, "download");
        },
      ),
    );
    li.appendChild(controls);

    const secondaryControls = document.createElement("div");
    secondaryControls.className = "mt-4 flex items-center justify-between gap-2 text-xs text-slate-500";
    const copyBtn = document.createElement("button");
    copyBtn.type = "button";
    copyBtn.className =
      "rounded-2xl border border-slate-100 bg-white px-4 py-2 text-left font-semibold text-slate-600";
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
    secondaryControls.appendChild(copyBtn);
    secondaryControls.appendChild(
      createIconButton(
        "Delete sound",
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.6" d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m-9 0l1 13h8l1-13M10 11v5m4-5v5"/></svg>',
        () => {
          void onHistoryAction(entry, "delete");
        },
        "h-9 w-9 flex-none rounded-lg border-slate-200 px-0 py-0 text-slate-400 hover:border-rose-200 hover:text-rose-500",
      ),
    );
    li.appendChild(secondaryControls);

    const loopToggle = document.createElement("button");
    loopToggle.type = "button";
    loopToggle.setAttribute("aria-pressed", isLoopingThisEntry ? "true" : "false");
    loopToggle.className =
      "mt-4 inline-flex w-full items-center gap-3 rounded-2xl border border-slate-100 bg-[#f8f9ff] px-4 py-2 text-left text-xs font-semibold text-slate-600";
    loopToggle.classList.toggle("border-emerald-200", isLoopingThisEntry);
    loopToggle.classList.toggle("bg-emerald-50/40", isLoopingThisEntry);
    loopToggle.classList.toggle("text-slate-700", isLoopingThisEntry);
    loopToggle.innerHTML = `
      <span class="inline-flex h-4 w-8 items-center rounded-full ${isLoopingThisEntry ? "bg-emerald-400" : "bg-slate-200"}">
        <span class="block h-4 w-4 rounded-full bg-white shadow transition-transform" style="transform: translateX(${isLoopingThisEntry ? "16px" : "0px"});"></span>
      </span>
      <span>Loop in background</span>
    `;
    loopToggle.addEventListener("click", () => {
      void onHistoryAction(entry, "loop");
    });
    li.appendChild(loopToggle);

    dom.historyList.appendChild(li);
  });
}

export function addEncodeHistoryEntry({
  text,
  scannerState,
  detectFirstUrl,
  normalizeUrl,
  saveEncodeHistoryFn,
  renderEncodeHistoryFn,
  updateDashboardStatsFn,
  updateLastResultDisplays,
}) {
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
    scanEvents: normalizeScanEvents(existing?.scanEvents),
  };

  scannerState.encodeHistory = scannerState.encodeHistory.filter((item) => item.url !== entry.url);
  scannerState.encodeHistory.unshift(entry);
  if (scannerState.encodeHistory.length > MAX_HISTORY_ITEMS) {
    scannerState.encodeHistory.length = MAX_HISTORY_ITEMS;
  }
  saveEncodeHistoryFn();
  renderEncodeHistoryFn();
  updateDashboardStatsFn();
  updateLastResultDisplays(text);
}

export function incrementEncodeHistoryScanCount({
  scannerState,
  rawValue,
  detectFirstUrl,
  normalizeUrl,
  saveEncodeHistoryFn,
  renderEncodeHistoryFn,
  updateDashboardStatsFn,
}) {
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
  entry.scanEvents = normalizeScanEvents(entry.scanEvents, now);
  saveEncodeHistoryFn();
  renderEncodeHistoryFn();
  updateDashboardStatsFn();
}
