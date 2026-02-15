export const AUTH_MODES = {
  LOGIN: "login",
  REGISTER: "register",
};

export function clearAuthError(dom) {
  if (!dom.authError) return;
  dom.authError.textContent = "";
  dom.authError.classList.add("hidden");
}

export function setAuthError(dom, message) {
  if (!dom.authError) return;
  if (message) {
    dom.authError.textContent = message;
    dom.authError.classList.remove("hidden");
  } else {
    clearAuthError(dom);
  }
}

export function setAuthMode(dom, mode) {
  const normalized = mode === AUTH_MODES.REGISTER ? AUTH_MODES.REGISTER : AUTH_MODES.LOGIN;
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
  clearAuthError(dom);
  const overlayVisible = dom.loginOverlay && !dom.loginOverlay.classList.contains("hidden");
  if (!overlayVisible) {
    return normalized;
  }
  if (normalized === AUTH_MODES.LOGIN) {
    dom.loginEmail?.focus();
  } else {
    dom.registerEmail?.focus();
  }
  return normalized;
}

export async function apiRequest(path, { method = "GET", body, headers } = {}) {
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

export async function fetchActiveSession(apiClient = apiRequest) {
  try {
    const session = await apiClient("/api/session");
    if (session && session.authenticated && session.user) {
      return session.user;
    }
  } catch (err) {
    console.warn("Failed to fetch session", err);
  }
  return null;
}

export async function performLogin(email, password, apiClient = apiRequest) {
  const result = await apiClient("/api/login", {
    method: "POST",
    body: { email, password },
  });
  if (result && result.user) {
    return result.user;
  }
  return null;
}

export async function performRegister(email, password, apiClient = apiRequest) {
  const result = await apiClient("/api/register", {
    method: "POST",
    body: { email, password },
  });
  if (result && result.user) {
    return result.user;
  }
  return null;
}

export async function performLogout(apiClient = apiRequest) {
  try {
    await apiClient("/api/logout", { method: "POST" });
  } catch (err) {
    console.warn("Failed to log out", err);
  }
}
