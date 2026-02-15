export function getPlanDisplay(plan) {
  const normalized = plan === "pro" ? "pro" : "free";
  return normalized === "pro" ? "Pro Plan" : "Free Plan";
}

export function formatNextPayment(isoString) {
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

export function updatePlanUI(scannerState, dom) {
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

export function resetBillingState(scannerState, dom) {
  scannerState.billing = {
    plan: "free",
    planUpdatedAt: null,
    subscriptionStatus: null,
    subscriptionPeriodEnd: null,
    lastConfirmedSession: null,
  };
  updatePlanUI(scannerState, dom);
}

export function updateBillingState(scannerState, dom, partial) {
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
  updatePlanUI(scannerState, dom);
}

export function hydratePlanFromUser(scannerState, dom, user) {
  if (!user) {
    resetBillingState(scannerState, dom);
    return;
  }
  updateBillingState(scannerState, dom, {
    plan: user.plan || "free",
    planUpdatedAt: user.planUpdatedAt || null,
    subscriptionStatus: user.stripeSubscriptionStatus || null,
    subscriptionPeriodEnd: user.stripeSubscriptionPeriodEnd || null,
  });
}

export async function refreshBillingStatus(scannerState, dom, apiRequest) {
  if (!scannerState.user) return;
  try {
    const status = await apiRequest("/api/billing/status");
    if (status) {
      updateBillingState(scannerState, dom, {
        plan: status.plan || "free",
        planUpdatedAt: status.planUpdatedAt || null,
        subscriptionStatus: status.stripeSubscriptionStatus || null,
        subscriptionPeriodEnd: status.stripeSubscriptionPeriodEnd || null,
      });
    }
  } catch (err) {
    if (err && err.status === 401) {
      resetBillingState(scannerState, dom);
    } else {
      console.warn("Failed to refresh billing status", err);
    }
  }
}

export async function confirmCheckoutSession({
  scannerState,
  dom,
  apiRequest,
  showToast,
  sessionId,
}) {
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
      updateBillingState(scannerState, dom, {
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
    await refreshBillingStatus(scannerState, dom, apiRequest);
  }
}

export async function startPlanCheckout({
  scannerState,
  apiRequest,
  showToast,
  setButtonLoadingState,
  plan,
  button,
}) {
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

export function handleCheckoutNotices({
  dom,
  confirmCheckoutSession,
  refreshBillingStatus,
}) {
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
