const RANGE_TO_BUCKET = {
  "24h": "hour",
  "7d": "day",
  "30d": "day",
};

function toSafeNumber(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
}

function escapeCellText(value) {
  return String(value || "").trim();
}

function formatPercentDelta(current, previous) {
  const curr = toSafeNumber(current);
  const prev = toSafeNumber(previous);
  if (prev <= 0) {
    if (curr <= 0) return 0;
    return null;
  }
  return ((curr - prev) / prev) * 100;
}

function formatDeltaLabel(t, delta) {
  if (delta === null) {
    return {
      text: t("runtime.analytics_delta_new"),
      tone: "neutral",
    };
  }
  const rounded = Math.abs(delta).toFixed(1);
  if (delta > 0) {
    return {
      text: t("runtime.analytics_delta_up", { value: rounded }),
      tone: "positive",
    };
  }
  if (delta < 0) {
    return {
      text: t("runtime.analytics_delta_down", { value: rounded }),
      tone: "negative",
    };
  }
  return {
    text: t("runtime.analytics_delta_flat"),
    tone: "neutral",
  };
}

function applyDeltaTone(node, tone) {
  if (!node) return;
  node.classList.remove("text-emerald-600", "text-rose-600", "text-slate-500");
  if (tone === "positive") {
    node.classList.add("text-emerald-600");
    return;
  }
  if (tone === "negative") {
    node.classList.add("text-rose-600");
    return;
  }
  node.classList.add("text-slate-500");
}

function formatDateTimeShort(isoValue) {
  if (!isoValue) return "";
  const date = new Date(isoValue);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString(document.documentElement.lang === "uk" ? "uk-UA" : undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function renderUpdatedAt(dom, t, updatedAtMs) {
  if (!dom.analyticsUpdatedAt) return;
  if (!updatedAtMs) {
    dom.analyticsUpdatedAt.textContent = t("runtime.analytics_updated_just_now");
    return;
  }
  const diffMs = Date.now() - updatedAtMs;
  const minutes = Math.max(0, Math.floor(diffMs / 60000));
  if (minutes <= 0) {
    dom.analyticsUpdatedAt.textContent = t("runtime.analytics_updated_just_now");
    return;
  }
  dom.analyticsUpdatedAt.textContent = t("runtime.analytics_updated_minutes", { minutes });
}

function setSummaryCard(dom, cardIndex, { label, value, sub, deltaText, deltaTone }) {
  const labelNode = dom[`analyticsCard${cardIndex}Label`];
  const valueNode = dom[`analyticsCard${cardIndex}Value`];
  const subNode = dom[`analyticsCard${cardIndex}Sub`];
  const deltaNode = dom[`analyticsCard${cardIndex}Delta`];
  if (labelNode) labelNode.textContent = label;
  if (valueNode) valueNode.textContent = String(value);
  if (subNode) subNode.textContent = sub;
  if (deltaNode) {
    deltaNode.textContent = deltaText;
    applyDeltaTone(deltaNode, deltaTone);
  }
}

function renderTrendChart(dom, points, t) {
  if (!dom.analyticsTrendChart) return;
  dom.analyticsTrendChart.innerHTML = "";
  if (!Array.isArray(points) || !points.length) {
    return;
  }

  const totalPoints = points.length;
  const maxValue = points.reduce((acc, point) => Math.max(acc, toSafeNumber(point.scans)), 0);
  const denominator = maxValue > 0 ? maxValue : 1;

  const shouldShowLabel = (index) => {
    if (totalPoints <= 8) return true;
    if (index === 0 || index === totalPoints - 1) return true;
    if (totalPoints <= 24) return index % 4 === 0;
    if (totalPoints <= 31) return index % 5 === 0;
    return index % Math.ceil(totalPoints / 6) === 0;
  };

  points.forEach((point, index) => {
    const scans = toSafeNumber(point.scans);
    const bar = document.createElement("div");
    bar.className = "group flex min-w-0 flex-1 flex-col items-center justify-end gap-1";
    bar.title = `${formatDateTimeShort(point.bucketStart)} — ${scans}`;

    const stem = document.createElement("div");
    stem.className = "w-full rounded-sm bg-gradient-to-t from-[#55d7ff] to-[#a58bff] opacity-90 transition-opacity duration-200 group-hover:opacity-100";
    stem.style.height = `${Math.max(6, Math.round((scans / denominator) * 96))}%`;

    const label = document.createElement("span");
    label.className = "h-3 truncate text-[10px] leading-3 text-slate-400";
    const date = new Date(point.bucketStart);
    if (Number.isNaN(date.getTime())) {
      label.textContent = "";
    } else if (!shouldShowLabel(index)) {
      label.textContent = "";
    } else {
      label.textContent =
        totalPoints > 24
          ? `${date.getUTCMonth() + 1}/${date.getUTCDate()}`
          : `${date.getUTCHours().toString().padStart(2, "0")}:00`;
    }

    bar.appendChild(stem);
    bar.appendChild(label);
    dom.analyticsTrendChart.appendChild(bar);
  });

  if (dom.analyticsTrendHint) {
    dom.analyticsTrendHint.textContent = t("runtime.analytics_trend_hint");
  }
}

function renderTopLinks(dom, links, t) {
  if (!dom.analyticsTopTableBody || !dom.analyticsTopTableWrap) return;
  dom.analyticsTopTableBody.innerHTML = "";

  links.forEach((link) => {
    const row = document.createElement("tr");
    row.className = "border-b border-slate-100 last:border-b-0";

    const linkCell = document.createElement("td");
    linkCell.className = "max-w-[220px] py-2.5 pr-2 align-top break-all text-slate-700";
    linkCell.textContent = escapeCellText(link.targetUrl || link.payloadText || t("runtime.history_untitled_link"));

    const scansCell = document.createElement("td");
    scansCell.className = "py-2.5 pr-2 align-top font-semibold text-slate-700";
    scansCell.textContent = String(toSafeNumber(link.scansInRange));

    const lastScanCell = document.createElement("td");
    lastScanCell.className = "py-2.5 pr-2 align-top whitespace-nowrap";
    lastScanCell.textContent = formatDateTimeShort(link.lastScanAt) || t("runtime.history_no_scans");

    const openRateCell = document.createElement("td");
    openRateCell.className = "py-2.5 align-top whitespace-nowrap";
    openRateCell.textContent =
      link.openRate === null || link.openRate === undefined
        ? t("runtime.analytics_not_available")
        : `${toSafeNumber(link.openRate).toFixed(1)}%`;

    row.appendChild(linkCell);
    row.appendChild(scansCell);
    row.appendChild(lastScanCell);
    row.appendChild(openRateCell);
    dom.analyticsTopTableBody.appendChild(row);
  });

  dom.analyticsTopTableWrap.classList.toggle("hidden", !links.length);
}

function setLoadingState(dom, isLoading) {
  dom.analyticsTrendLoading?.classList.toggle("hidden", !isLoading);
  dom.analyticsTopLoading?.classList.toggle("hidden", !isLoading);
}

function setErrorState(dom, hasError) {
  dom.analyticsTrendError?.classList.toggle("hidden", !hasError);
  dom.analyticsTopError?.classList.toggle("hidden", !hasError);
}

function setEmptyState(dom, trendEmpty, topEmpty) {
  dom.analyticsTrendEmpty?.classList.toggle("hidden", !trendEmpty);
  dom.analyticsTopEmpty?.classList.toggle("hidden", !topEmpty);
}

function syncControls(dom, state, scannerState) {
  dom.analyticsRangeButtons?.forEach((button) => {
    const isActive = button.dataset.analyticsRange === state.range;
    button.classList.toggle("bg-white", isActive);
    button.classList.toggle("shadow", isActive);
    button.classList.toggle("text-slate-800", isActive);
    button.classList.toggle("text-slate-600", !isActive);
  });

  if (dom.analyticsLinkScope) {
    if (dom.analyticsLinkScope.value !== state.linkScope) {
      dom.analyticsLinkScope.value = state.linkScope;
    }
    if (!scannerState.currentHistoryEntryId && state.linkScope === "selected") {
      dom.analyticsLinkScope.value = "all";
      state.linkScope = "all";
    }
  }
}

function resolveAnalyticsLinkId(state, scannerState) {
  if (state.linkScope !== "selected") return "all";
  return scannerState.currentHistoryEntryId || "all";
}

export function createAnalyticsState() {
  return {
    range: "24h",
    linkScope: "all",
    loading: false,
    updatedAt: null,
    requestId: 0,
    lastData: null,
    lastError: null,
  };
}

export function bindAnalyticsControls({ dom, scannerState, onChange }) {
  if (!scannerState.analytics) return;
  dom.analyticsRangeButtons?.forEach((button) => {
    button.addEventListener("click", () => {
      const nextRange = button.dataset.analyticsRange;
      if (!nextRange || nextRange === scannerState.analytics.range) return;
      scannerState.analytics.range = nextRange;
      onChange({ forceLoading: true });
    });
  });

  dom.analyticsLinkScope?.addEventListener("change", () => {
    const nextScope = dom.analyticsLinkScope.value === "selected" ? "selected" : "all";
    scannerState.analytics.linkScope = nextScope;
    onChange({ forceLoading: true });
  });

  dom.analyticsRetryButton?.addEventListener("click", () => {
    onChange({ forceLoading: true });
  });
}

export async function refreshAdminAnalytics({ dom, scannerState, apiRequest, t, forceLoading = false }) {
  if (!scannerState.analytics) {
    scannerState.analytics = createAnalyticsState();
  }

  const state = scannerState.analytics;
  const range = state.range;
  const bucket = RANGE_TO_BUCKET[range] || "hour";
  const linkId = resolveAnalyticsLinkId(state, scannerState);
  const requestId = state.requestId + 1;
  state.requestId = requestId;
  state.loading = true;
  syncControls(dom, state, scannerState);
  if (forceLoading || !state.lastData) {
    setLoadingState(dom, true);
  }
  setErrorState(dom, false);

  try {
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
    const query = `range=${encodeURIComponent(range)}&linkId=${encodeURIComponent(linkId)}&bucket=${encodeURIComponent(bucket)}&tz=${encodeURIComponent(timezone)}`;
    const [summary, timeseries, topLinks] = await Promise.all([
      apiRequest(`/api/analytics/summary?${query}`),
      apiRequest(`/api/analytics/timeseries?${query}`),
      apiRequest(`/api/analytics/top-links?range=${encodeURIComponent(range)}&bucket=${encodeURIComponent(bucket)}&limit=10&tz=${encodeURIComponent(timezone)}`),
    ]);

    if (state.requestId !== requestId) {
      return;
    }

    const scansDelta = formatDeltaLabel(
      t,
      formatPercentDelta(summary?.scansInRange, summary?.previousScansInRange),
    );
    const activeLinksDelta = formatDeltaLabel(
      t,
      formatPercentDelta(summary?.activeLinksInRange, summary?.previousActiveLinksInRange),
    );
    const totalScansDelta = formatDeltaLabel(t, null);

    setSummaryCard(dom, 1, {
      label: t("runtime.analytics_total_scans_label"),
      value: toSafeNumber(summary?.scansInRange),
      sub: linkId === "all" ? t("runtime.analytics_total_scans_sub_overall") : t("runtime.analytics_total_scans_sub_selected"),
      deltaText: scansDelta.text,
      deltaTone: scansDelta.tone,
    });
    setSummaryCard(dom, 2, {
      label: t("runtime.analytics_active_links_label"),
      value: toSafeNumber(summary?.activeLinksInRange),
      sub: linkId === "all" ? t("runtime.analytics_active_links_sub_overall") : t("runtime.analytics_active_links_sub_selected"),
      deltaText: activeLinksDelta.text,
      deltaTone: activeLinksDelta.tone,
    });
    setSummaryCard(dom, 3, {
      label: t("runtime.analytics_all_time_scans_label"),
      value: toSafeNumber(summary?.totalScans),
      sub: t("runtime.analytics_all_time_scans_sub"),
      deltaText: totalScansDelta.text,
      deltaTone: totalScansDelta.tone,
    });
    setSummaryCard(dom, 4, {
      label: t("runtime.analytics_last_scan_label"),
      value: summary?.lastScanAt ? formatDateTimeShort(summary.lastScanAt) : t("runtime.history_no_scans"),
      sub: linkId === "all" ? t("runtime.analytics_last_scan_sub_overall") : t("runtime.analytics_last_scan_sub_selected"),
      deltaText: t("runtime.analytics_delta_not_applicable"),
      deltaTone: "neutral",
    });

    if (dom.analyticsContext) {
      dom.analyticsContext.textContent =
        linkId === "all" ? t("runtime.analytics_overall_context") : t("runtime.analytics_selected_context");
    }

    renderTrendChart(dom, Array.isArray(timeseries?.points) ? timeseries.points : [], t);
    const links = Array.isArray(topLinks?.links) ? topLinks.links : [];
    renderTopLinks(dom, links, t);

    setEmptyState(
      dom,
      !Array.isArray(timeseries?.points) || timeseries.points.every((point) => !toSafeNumber(point.scans)),
      links.length === 0,
    );

    state.lastData = { summary, timeseries, topLinks };
    state.lastError = null;
    state.updatedAt = Date.now();
    renderUpdatedAt(dom, t, state.updatedAt);
    setErrorState(dom, false);
  } catch (err) {
    if (state.requestId !== requestId) {
      return;
    }
    state.lastError = err;
    setErrorState(dom, true);
    setEmptyState(dom, false, false);
  } finally {
    if (state.requestId === requestId) {
      state.loading = false;
      setLoadingState(dom, false);
    }
  }
}
