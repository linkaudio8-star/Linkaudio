export const selectors = {
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
  openLinkButtonGenerated: "#new-open-link",
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

export function cacheDom(dom) {
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
  dom.openLinkButtonGenerated = document.querySelector(selectors.openLinkButtonGenerated);
  dom.playLoopButton = document.querySelector(selectors.playLoopButton);
  dom.playLoopLabel = dom.playLoopButton
    ? dom.playLoopButton.querySelector("[data-loop-label]")
    : null;
  dom.playLoopTrack = dom.playLoopButton
    ? dom.playLoopButton.querySelector("[data-loop-track]")
    : null;
  dom.playLoopKnob = dom.playLoopButton
    ? dom.playLoopButton.querySelector("[data-loop-knob]")
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

export function showToast(dom, message) {
  if (!dom.toast || !dom.toastMessage) return;
  dom.toastMessage.textContent = message;
  dom.toast.classList.add("opacity-100");
  dom.toast.classList.remove("pointer-events-none");
  window.setTimeout(() => {
    dom.toast.classList.remove("opacity-100");
    dom.toast.classList.add("pointer-events-none");
  }, 2600);
}

export function setButtonLoadingState(button, isLoading, loadingLabel) {
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
