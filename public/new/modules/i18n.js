const LANGUAGE_STORAGE_KEY = "audiolink-language";
const SUPPORTED_LANGUAGES = new Set(["en", "uk"]);

let currentLanguage = "en";

const TRANSLATIONS = {
  en: {
    common: {
      plan_free: "Free Plan",
      plan_pro: "Pro Plan",
      settings: "Settings",
      logout: "Log out",
      signin: "Sign in",
      get_started: "Get started",
      close: "Close",
      dismiss: "Dismiss",
      cancel: "Cancel",
      try_again: "Try again",
      open_link: "Open Link",
    },
    runtime: {
      auth_enter_credentials: "Enter email and password to continue.",
      auth_signing_in: "Signing in…",
      auth_invalid_credentials: "Invalid email or password.",
      auth_login_failed: "Unable to sign in. Try again.",
      auth_fill_all_fields: "Please complete all fields to continue.",
      auth_password_mismatch: "Passwords do not match. Try again.",
      auth_password_short: "Password must be at least 6 characters.",
      auth_creating_account: "Creating account…",
      auth_registration_failed: "Unable to create account. Try again.",
      toast_signed_in_as: "Signed in as {email}",
      toast_welcome_user: "Welcome, {email}!",
      toast_logged_out: "Logged out.",
      toast_logged_out_inactive: "Logged out after 1 hour of inactivity.",
      toast_decoded_success: "Decoded a message successfully.",
      toast_loaded_selected_sound: "Loaded selected sound.",
      toast_generate_first: "Generate a sound link first.",
      toast_looping_stopped: "Looping stopped.",
      toast_looping_started: "Looping playback started.",
      toast_playback_blocked: "Playback blocked — press play on the audio controls.",
      toast_sound_deleted: "Sound deleted.",
      toast_signin_generate: "Sign in to generate sound links.",
      toast_audio_init_failed: "Unable to initialise audio. Check microphone permissions.",
      toast_audio_engine_failed: "Audio engine failed to load. Refresh and try again.",
      toast_audio_engine_loading: "Audio engine still loading. Try again in a moment.",
      toast_enter_text_before_generate: "Enter text or a link before generating.",
      toast_sound_ready: "Sound link ready — press play to preview.",
      toast_sound_generation_failed: "Something went wrong while generating the sound.",
      toast_signin_history_controls: "Sign in to use your history playback controls.",
      toast_entry_no_text: "This entry has no text to replay.",
      toast_playback_stopped: "Playback stopped.",
      toast_unknown_playback_mode: "Unable to determine playback mode.",
      toast_invalid_url: "No valid URL to open.",
      toast_unable_prepare_sound: "Unable to prepare this sound. Try regenerating it manually.",
      toast_press_play_audio: "Press play on the audio player to listen.",
      toast_generate_before_download: "Generate a sound before downloading.",
      toast_generate_url_first: "Generate a sound link from a URL first.",
      toast_scan_already_active: "Already listening — stop the current scan first.",
      toast_audio_context_unavailable: "Unable to access audio context. Try again.",
      toast_reload_audio_engine: "Audio engine failed to load. Reload the page and retry.",
      toast_audio_engine_wait: "Audio engine still loading. Please wait a moment.",
      toast_mic_required: "Microphone access is required to scan sound links.",
      toast_worklet_failed: "Audio worklet registration failed. Try again.",
      toast_no_audio_captured: "No audio captured — try again.",
      toast_no_readable_message: "No readable message found. Try again.",
      toast_decoding_failed: "Decoding failed. Try again.",
      toast_audio_ready: "Audio engine ready — start scanning anytime.",
      toast_audio_load_failed: "Failed to load audio engine. Refresh the page to retry.",
      status_listening_links: "Listening for sound links…",
      status_position_source: "Position your device near the source.",
      status_no_clear_transmission: "No clear transmission detected.",
      status_decoding_failed: "Decoding failed.",
      status_listening_with_time: "Listening for sound links… {seconds}s remaining",
      mode_ultrasound_toast: "Ultrasound mode active for encoding.",
      scan_timeout_title: "No sound link detected",
      scan_timeout_hint: "Make sure the transmitter is playing the AudioLink tone and try again.",
      scan_detected_title: "Sound link detected!",
      scan_stop_listening: "Stop Listening",
      scan_listening_for_links: "Listening for sound links",
      scan_countdown: "{seconds}s remaining",
      scan_keep_speaker_close: "Keep your speaker within 1 meter for best results. Ultrasound mode is used for decoding.",
      history_items_count: "{items} item{itemsSuffix} • {scans} scan{scansSuffix}",
      history_current: "Current",
      history_no_scans: "No scans yet",
      history_last_scan: "Last scan: {value}",
      history_copy_text: "Copy text",
      history_copy_success: "Copied to clipboard.",
      history_copy_failed: "Copy failed. Try again.",
      history_loop_background: "Loop in background",
      history_untitled_link: "Untitled link",
      history_count_short: "{count} item{suffix}",
      relative_just_now: "Just now",
      relative_suffix_ago: "{value} ago",
      billing_pro_active: "Pro plan active",
      billing_included_period: "Included in current period",
      billing_upgrade_unlock: "Upgrade to unlock",
      billing_subscription_activated: "Pro subscription activated.",
      billing_confirm_failed: "Unable to confirm subscription.",
      billing_already_pro: "You're already on the Pro plan.",
      billing_redirecting: "Redirecting…",
      billing_checkout_link_unavailable: "Checkout link unavailable.",
      billing_start_checkout_failed: "Unable to start checkout.",
      analytics_selected_context: "Selected sound analytics",
      analytics_overall_context: "Overall analytics",
      analytics_total_scans_label: "Total scans",
      analytics_total_scans_sub_selected: "For selected sound",
      analytics_total_scans_sub_overall: "Across all generated sounds",
      analytics_active_links_label: "Active links",
      analytics_active_links_sub_selected: "Current selected sound",
      analytics_active_links_sub_overall: "Generated sounds in history",
      analytics_scans_24h_label: "Scans (24h)",
      analytics_scans_24h_sub_selected: "Selected sound only",
      analytics_scans_24h_sub_overall: "Rolling 24-hour activity",
      analytics_all_time_scans_label: "All-time scans",
      analytics_all_time_scans_sub: "Across your entire history",
      analytics_last_scan_label: "Last scan",
      analytics_last_scan_sub_selected: "Most recent selected scan",
      analytics_last_scan_sub_overall: "Most recent scanning event",
      analytics_delta_up: "+{value}% vs previous period",
      analytics_delta_down: "-{value}% vs previous period",
      analytics_delta_flat: "No change vs previous period",
      analytics_delta_new: "New activity in this period",
      analytics_delta_not_applicable: "Not applicable",
      analytics_updated_just_now: "Updated just now",
      analytics_updated_minutes: "Updated {minutes}m ago",
      analytics_trend_hint: "Scans by time bucket",
      analytics_not_available: "N/A",
      confirm_delete_sound: "Delete this sound?",
      playback_play: "Play",
      playback_pause: "Pause",
      history_download_audio: "Download audio",
      history_delete_sound: "Delete sound",
      value_none: "None",
    },
  },
  uk: {
    common: {
      plan_free: "Безкоштовний план",
      plan_pro: "Pro план",
      settings: "Налаштування",
      logout: "Вийти",
      signin: "Увійти",
      get_started: "Почати",
      close: "Закрити",
      dismiss: "Закрити",
      cancel: "Скасувати",
      try_again: "Спробувати ще раз",
      open_link: "Відкрити посилання",
    },
    runtime: {
      auth_enter_credentials: "Введіть email і пароль, щоб продовжити.",
      auth_signing_in: "Вхід…",
      auth_invalid_credentials: "Невірний email або пароль.",
      auth_login_failed: "Не вдалося увійти. Спробуйте ще раз.",
      auth_fill_all_fields: "Заповніть усі поля, щоб продовжити.",
      auth_password_mismatch: "Паролі не збігаються. Спробуйте ще раз.",
      auth_password_short: "Пароль має містити щонайменше 6 символів.",
      auth_creating_account: "Створення акаунта…",
      auth_registration_failed: "Не вдалося створити акаунт. Спробуйте ще раз.",
      toast_signed_in_as: "Ви увійшли як {email}",
      toast_welcome_user: "Вітаємо, {email}!",
      toast_logged_out: "Ви вийшли з акаунта.",
      toast_logged_out_inactive: "Вас вийшло з акаунта після 1 години бездіяльності.",
      toast_decoded_success: "Повідомлення успішно декодовано.",
      toast_loaded_selected_sound: "Обраний звук завантажено.",
      toast_generate_first: "Спочатку створіть аудіопосилання.",
      toast_looping_stopped: "Циклічне відтворення зупинено.",
      toast_looping_started: "Циклічне відтворення запущено.",
      toast_playback_blocked: "Відтворення заблоковано — натисніть відтворення в аудіоплеєрі.",
      toast_sound_deleted: "Звук видалено.",
      toast_signin_generate: "Увійдіть, щоб створювати аудіопосилання.",
      toast_audio_init_failed: "Не вдалося ініціалізувати аудіо. Перевірте доступ до мікрофона.",
      toast_audio_engine_failed: "Не вдалося завантажити аудіомодуль. Оновіть сторінку й спробуйте ще раз.",
      toast_audio_engine_loading: "Аудіомодуль ще завантажується. Спробуйте за мить.",
      toast_enter_text_before_generate: "Введіть текст або посилання перед генерацією.",
      toast_sound_ready: "Аудіопосилання готове — натисніть відтворення для прев’ю.",
      toast_sound_generation_failed: "Під час генерації звуку сталася помилка.",
      toast_signin_history_controls: "Увійдіть, щоб користуватися керуванням історією відтворення.",
      toast_entry_no_text: "У цьому записі немає тексту для відтворення.",
      toast_playback_stopped: "Відтворення зупинено.",
      toast_unknown_playback_mode: "Не вдалося визначити режим відтворення.",
      toast_invalid_url: "Немає валідного URL для відкриття.",
      toast_unable_prepare_sound: "Не вдалося підготувати цей звук. Спробуйте згенерувати його вручну.",
      toast_press_play_audio: "Натисніть відтворення в аудіоплеєрі, щоб прослухати.",
      toast_generate_before_download: "Згенеруйте звук перед завантаженням.",
      toast_generate_url_first: "Спочатку створіть аудіопосилання з URL.",
      toast_scan_already_active: "Сканування вже триває — спершу зупиніть поточне.",
      toast_audio_context_unavailable: "Не вдалося отримати доступ до аудіоконтексту. Спробуйте ще раз.",
      toast_reload_audio_engine: "Не вдалося завантажити аудіомодуль. Перезавантажте сторінку й повторіть.",
      toast_audio_engine_wait: "Аудіомодуль ще завантажується. Будь ласка, зачекайте.",
      toast_mic_required: "Для сканування аудіопосилань потрібен доступ до мікрофона.",
      toast_worklet_failed: "Не вдалося запустити аудіомодуль. Спробуйте ще раз.",
      toast_no_audio_captured: "Аудіо не захоплено — спробуйте ще раз.",
      toast_no_readable_message: "Читабельне повідомлення не знайдено. Спробуйте ще раз.",
      toast_decoding_failed: "Декодування не вдалося. Спробуйте ще раз.",
      toast_audio_ready: "Аудіомодуль готовий — можна починати сканування.",
      toast_audio_load_failed: "Не вдалося завантажити аудіомодуль. Оновіть сторінку, щоб повторити.",
      status_listening_links: "Слухаємо аудіопосилання…",
      status_position_source: "Розташуйте пристрій ближче до джерела звуку.",
      status_no_clear_transmission: "Чіткий сигнал не виявлено.",
      status_decoding_failed: "Декодування не вдалося.",
      status_listening_with_time: "Слухаємо аудіопосилання… залишилось {seconds}с",
      mode_ultrasound_toast: "Ультразвуковий режим активний для кодування.",
      scan_timeout_title: "Аудіопосилання не виявлено",
      scan_timeout_hint: "Переконайтеся, що передавач відтворює тон AudioLink, і спробуйте ще раз.",
      scan_detected_title: "Аудіопосилання виявлено!",
      scan_stop_listening: "Зупинити прослуховування",
      scan_listening_for_links: "Прослуховування аудіопосилань",
      scan_countdown: "Залишилось {seconds}с",
      scan_keep_speaker_close: "Для кращого результату тримайте телефон поруч із джерелом звуку. Сканування працює в ультразвуковому режимі.",
      history_items_count: "{items} елемент{itemsSuffix} • {scans} скан{scansSuffix}",
      history_current: "Поточний",
      history_no_scans: "Сканувань ще немає",
      history_last_scan: "Останнє сканування: {value}",
      history_copy_text: "Копіювати текст",
      history_copy_success: "Скопійовано в буфер обміну.",
      history_copy_failed: "Не вдалося скопіювати. Спробуйте ще раз.",
      history_loop_background: "Повторювати у фоні",
      history_untitled_link: "Без назви",
      history_count_short: "{count} елемент{suffix}",
      relative_just_now: "Щойно",
      relative_suffix_ago: "{value} тому",
      billing_pro_active: "Pro план активний",
      billing_included_period: "Включено в поточний період",
      billing_upgrade_unlock: "Оновіть план, щоб розблокувати",
      billing_subscription_activated: "Pro підписку активовано.",
      billing_confirm_failed: "Не вдалося підтвердити підписку.",
      billing_already_pro: "У вас уже активний Pro план.",
      billing_redirecting: "Переадресація…",
      billing_checkout_link_unavailable: "Посилання на оплату недоступне.",
      billing_start_checkout_failed: "Не вдалося запустити оплату.",
      analytics_selected_context: "Аналітика вибраного звуку",
      analytics_overall_context: "Загальна аналітика",
      analytics_total_scans_label: "Усього сканувань",
      analytics_total_scans_sub_selected: "Для вибраного звуку",
      analytics_total_scans_sub_overall: "Для всіх згенерованих звуків",
      analytics_active_links_label: "Активні посилання",
      analytics_active_links_sub_selected: "Поточний вибраний звук",
      analytics_active_links_sub_overall: "Згенеровані звуки в історії",
      analytics_scans_24h_label: "Сканування (24г)",
      analytics_scans_24h_sub_selected: "Лише для вибраного звуку",
      analytics_scans_24h_sub_overall: "Активність за останні 24 години",
      analytics_all_time_scans_label: "Сканувань за весь час",
      analytics_all_time_scans_sub: "За всю вашу історію",
      analytics_last_scan_label: "Останнє сканування",
      analytics_last_scan_sub_selected: "Найновіше сканування вибраного звуку",
      analytics_last_scan_sub_overall: "Найновіша подія сканування",
      analytics_delta_up: "+{value}% до попереднього періоду",
      analytics_delta_down: "-{value}% до попереднього періоду",
      analytics_delta_flat: "Без змін до попереднього періоду",
      analytics_delta_new: "Нова активність у цьому періоді",
      analytics_delta_not_applicable: "Не застосовується",
      analytics_updated_just_now: "Оновлено щойно",
      analytics_updated_minutes: "Оновлено {minutes}хв тому",
      analytics_trend_hint: "Динаміка сканувань за періодами",
      analytics_not_available: "Немає даних",
      confirm_delete_sound: "Видалити цей звук?",
      playback_play: "Відтворити",
      playback_pause: "Пауза",
      history_download_audio: "Завантажити аудіо",
      history_delete_sound: "Видалити звук",
      value_none: "Немає",
    },
  },
};

const STATIC_INDEX_TRANSLATIONS = [
  { selector: "title", en: "AudioLink · New Experience", uk: "AudioLink · Новий досвід" },
  { selector: "#header-login", key: "common.signin" },
  { selector: "#header-get-started", key: "common.get_started" },
  { selector: "#header-logout", key: "common.logout" },
  { selector: "#hero-open-dashboard", attr: "aria-label", en: "Open AudioLink Studio dashboard", uk: "Відкрити дашборд AudioLink Studio" },
  { selector: 'nav a[href="#how-it-works"]', en: "How it works", uk: "Як це працює" },
  { selector: 'nav a[href="#preview"]', en: "Dashboard", uk: "Дашборд" },
  { selector: 'nav a[href="#pricing"]', en: "Pricing", uk: "Ціни" },
  { selector: 'nav a[href="#about"]', en: "About", uk: "Про нас" },
  { selector: "#scan-button-label", en: "Scan Now", uk: "Сканувати звук" },
  { selector: "#hero-login", en: "Login to Create", uk: "Створити аудіопосилання" },
  { selector: "main > section:first-of-type p.inline-flex", en: "New Air-Link Experience", uk: "Новий досвід через звук" },
  { selector: "main > section:first-of-type h1", attr: "html", en: 'Scan the air for <span class="gradient-text">sound links</span>', uk: 'Посилання, які можна <span class="gradient-text">передати звуком</span>' },
  { selector: "main > section:first-of-type p.text-lg", en: "Convert any digital link into immersive audio signals and decode them back with your microphone. The futuristic alternative to QR codes — no cameras required.", uk: "AudioLink перетворює URL на короткий аудіосигнал. Людина сканує звук телефоном і миттєво відкриває посилання, а ви бачите скани в дашборді." },
  { selector: "main > section:first-of-type .flex.flex-wrap.gap-4 > div:nth-child(1)", en: "Works offline", uk: "Працює офлайн" },
  { selector: "main > section:first-of-type .flex.flex-wrap.gap-4 > div:nth-child(2)", en: "Ultrasound capable", uk: "Підтримка ультразвуку" },
  { selector: "main > section:first-of-type .flex.flex-wrap.gap-4 > div:nth-child(3)", en: "Secure by design", uk: "Безпека за дизайном" },
  { selector: "#last-decode-card p.text-xs", en: "Latest scan", uk: "Останнє сканування" },
  { selector: "main > section:first-of-type .rounded-2xl.border.border-white\\/50 p.text-sm.font-semibold.text-slate-500", en: "Live Scan", uk: "Живе сканування" },
  { selector: "main > section:first-of-type .rounded-2xl.border.border-white\\/50 span.text-xs.font-medium.text-sound-blue", en: "Listening", uk: "Слухаємо" },
  { selector: "main > section:first-of-type .rounded-2xl.border.border-white\\/50 p.mt-4", en: "Ambient audio visualization", uk: "Візуалізація фонового аудіо" },
  { selector: "main > section:first-of-type .rounded-2xl.border.border-white\\/60 p.text-sm.font-semibold.text-slate-600", en: "Recent Detection", uk: "Останнє сканування" },
  { selector: "main > section:first-of-type .rounded-2xl.border.border-white\\/60 p.font-medium.text-slate-900", en: "openai.com/chatgpt", uk: "openai.com/chatgpt" },
  { selector: "main > section:first-of-type .rounded-2xl.border.border-white\\/60 p.text-sm.text-slate-500", en: "“ChatGPT by OpenAI — A conversational AI experience available now.”", uk: "«ChatGPT від OpenAI — сучасний розмовний AI-досвід.»" },
  { selector: "main > section:first-of-type .rounded-2xl.border.border-white\\/60 .mt-4 span:nth-child(1)", en: "Detected 12s ago", uk: "Виявлено 12с тому" },
  { selector: "main > section:first-of-type .rounded-2xl.border.border-white\\/60 .mt-4 span:nth-child(2)", en: "Ultrasound mode", uk: "Ультразвуковий режим" },
  { selector: "#checkout-success-card p:first-child", en: "Payment confirmed", uk: "Оплату підтверджено" },
  { selector: "#checkout-success-card h2", en: "Welcome to AudioLink Pro", uk: "Ласкаво просимо до AudioLink Pro" },
  { selector: "#checkout-success-card a", en: "Open Studio", uk: "Відкрити Studio" },
  { selector: "#checkout-success-dismiss", key: "common.dismiss" },
  { selector: "#checkout-cancel-card p:first-child", en: "Checkout cancelled", uk: "Оплату скасовано" },
  { selector: "#checkout-cancel-card h2", en: "You exited the payment flow", uk: "Ви вийшли з процесу оплати" },
  { selector: "#checkout-cancel-card p.mt-2", en: "You can retry at any time—your spot is saved.", uk: "Ви можете повторити будь-коли — ваше місце збережено." },
  { selector: "#checkout-cancel-card [data-upgrade-plan='pro']", en: "Retry Checkout", uk: "Повторити оплату" },
  { selector: "#checkout-cancel-dismiss", key: "common.dismiss" },
  { selector: "#how-it-works .section-heading", en: "How it works", uk: "Як це працює" },
  { selector: "#how-it-works .grid > div:nth-child(1) h3", en: "Encode any link", uk: "Створіть аудіопосилання" },
  { selector: "#how-it-works .grid > div:nth-child(1) p", en: "Paste your URL into AudioLink Studio and instantly transform it into a sonic signature ready for sharing.", uk: "Вставте URL в AudioLink Studio і перетворіть його на аудіосигнал, готовий до поширення." },
  { selector: "#how-it-works .grid > div:nth-child(2) h3", en: "Broadcast or play", uk: "Увімкніть або поширте звук" },
  { selector: "#how-it-works .grid > div:nth-child(2) p", en: "Play the audio over speakers or devices. It works in audible and ultrasonic ranges for flexible experiences.", uk: "Відтворіть аудіосигнал через колонку, телефон або інший пристрій у потрібній локації." },
  { selector: "#how-it-works .grid > div:nth-child(3) h3", en: "Scan & decode", uk: "Користувач сканує телефоном" },
  { selector: "#how-it-works .grid > div:nth-child(3) p", en: "Tap “Scan now” and AudioLink will listen for the sound signature—decoded links appear instantly below.", uk: "Людина натискає «Сканувати звук», AudioLink розпізнає сигнал і одразу відкриває посилання." },
  { selector: "#preview h2", en: "Reimagined dashboard for your audio links", uk: "Оновлений дашборд для ваших аудіопосилань" },
  { selector: "#preview .space-y-6 > p", en: "Track scans, manage campaigns, and switch between audible and ultrasonic modes. The new dashboard brings clarity to every sonic interaction.", uk: "Відстежуйте сканування, керуйте кампаніями та бачте, які аудіопосилання працюють найкраще. Дашборд показує результат кожної взаємодії через звук." },
  { selector: "#preview ul li:nth-child(1)", en: "Real-time analytics for every shared sound", uk: "Аналітика в реальному часі для кожного поширеного звуку" },
  { selector: "#preview ul li:nth-child(2)", en: "Link management with customizable metadata", uk: "Керування посиланнями з гнучкими метаданими" },
  { selector: "#preview ul li:nth-child(3)", en: "Team collaboration and role-based controls", uk: "Командна робота й керування ролями" },
  { selector: "#preview .rounded-3xl .mb-3", en: "Dashboard Preview", uk: "Прев’ю дашборду" },
  { selector: "#preview .rounded-3xl h3", en: "Analytics arriving soon", uk: "Аналітика сканувань" },
  { selector: "#preview .rounded-3xl p.mt-2", en: "Visualise scan performance, top campaigns, and live transmitter health directly in AudioLink Studio.", uk: "Відстежуйте ефективність сканувань, найактивніші кампанії та стан аудіосигналів прямо в AudioLink Studio." },
  { selector: "#pricing .section-heading", en: "Pricing", uk: "Ціни" },
  { selector: "#pricing .grid > div:nth-child(1) h3", en: "Starter", uk: "Starter" },
  { selector: "#pricing .grid > div:nth-child(1) p.mt-1", en: "For creators and early adopters", uk: "Для тестів, демо й перших кампаній" },
  { selector: "#pricing .grid > div:nth-child(1) li:nth-child(1)", en: "• 25 scans / month", uk: "• 25 сканувань / місяць" },
  { selector: "#pricing .grid > div:nth-child(1) li:nth-child(2)", en: "• Ultrasound scanning (silent mode)", uk: "• Ультразвукове сканування (тихий режим)" },
  { selector: "#pricing .grid > div:nth-child(1) li:nth-child(3)", en: "• Create and share audio links", uk: "• Створення та поширення аудіопосилань" },
  { selector: "#pricing .grid > div:nth-child(1) li:nth-child(4)", en: "• Basic analytics", uk: "• Базова аналітика" },
  { selector: "#pricing .grid > div:nth-child(1) li:nth-child(5)", en: "• Community support", uk: "• Підтримка спільноти" },
  { selector: "#pricing .grid > div:nth-child(1) button", en: "Start for free", uk: "Почати безкоштовно" },
  { selector: "#pricing .grid > div:nth-child(2) h3", en: "Pro", uk: "Pro" },
  { selector: "#pricing .grid > div:nth-child(2) p.mt-1", en: "For teams and businesses scaling experiences", uk: "Для команд, які регулярно запускають аудіоактивації" },
  { selector: "#pricing .grid > div:nth-child(2) li:nth-child(1)", en: "• Unlimited scans", uk: "• Необмежені сканування" },
  { selector: "#pricing .grid > div:nth-child(2) li:nth-child(2)", en: "• Real-time dashboard and advanced analytics", uk: "• Дашборд у реальному часі та розширена аналітика" },
  { selector: "#pricing .grid > div:nth-child(2) li:nth-child(3)", en: "• Campaign insights", uk: "• Інсайти кампаній" },
  { selector: "#pricing .grid > div:nth-child(2) li:nth-child(4)", en: "• Priority support", uk: "• Пріоритетна підтримка" },
  { selector: "#pricing .grid > div:nth-child(2) button", en: "Upgrade to Pro", uk: "Перейти на Pro" },
  { selector: "#pricing .grid > div:nth-child(3) h3", en: "Enterprise", uk: "Enterprise" },
  { selector: "#pricing .grid > div:nth-child(3) p.mt-1", en: "For embedded sonic systems", uk: "Для інтеграцій, подій і кастомних сценаріїв" },
  { selector: "#pricing .grid > div:nth-child(3) li:nth-child(1)", en: "• On-prem deployment", uk: "• Розгортання у вашій інфраструктурі" },
  { selector: "#pricing .grid > div:nth-child(3) li:nth-child(2)", en: "• Dedicated ultrasound tuning", uk: "• Індивідуальне налаштування ультразвуку" },
  { selector: "#pricing .grid > div:nth-child(3) li:nth-child(3)", en: "• SLA & compliance options", uk: "• Варіанти SLA і відповідності" },
  { selector: "#pricing .grid > div:nth-child(3) li:nth-child(4)", en: "• White-label experiences", uk: "• Сценарії під вашим брендом" },
  { selector: "#pricing .grid > div:nth-child(3) .text-3xl.font-bold.text-slate-900", en: "Custom", uk: "Індивідуально" },
  { selector: "#pricing .grid > div:nth-child(3) a", en: "Contact sales", uk: "Обговорити впровадження" },
  { selector: "#pricing .grid > div:nth-child(1) .text-base.font-normal.text-slate-400", en: "/month", uk: "/місяць" },
  { selector: "#pricing .grid > div:nth-child(2) .text-base.font-normal.text-slate-400", en: "/month", uk: "/місяць" },
  { selector: "#about h2", en: "Designed for ambient experiences", uk: "Створено для взаємодії через звук" },
  { selector: "#about .text-base", en: "AudioLink lets brands build proximity-based experiences without relying on cameras or codes. Whether you're launching pop-up experiences, powering smart retail, or building playful connections, AudioLink adapts to your environment.", uk: "AudioLink допомагає брендам запускати аудіоактивації без камер і QR-кодів. Використовуйте його на подіях, у ритейлі, презентаціях або закритих кампаніях для спільнот." },
  { selector: "#about .grid.sm\\:grid-cols-2 > div:nth-child(1) p.text-sm.font-semibold", en: "Offline ready", uk: "Готово до офлайну" },
  { selector: "#about .grid.sm\\:grid-cols-2 > div:nth-child(1) p.mt-2", en: "No connectivity? Your sonic links still work.", uk: "Немає інтернету? Ваші аудіопосилання все одно працюють." },
  { selector: "#about .grid.sm\\:grid-cols-2 > div:nth-child(2) p.text-sm.font-semibold", en: "Privacy first", uk: "Конфіденційність насамперед" },
  { selector: "#about .grid.sm\\:grid-cols-2 > div:nth-child(2) p.mt-2", en: "All detection happens locally on the device.", uk: "Усе виявлення виконується локально на пристрої." },
  { selector: "#about .rounded-2xl.border.border-white\\/60.bg-sound-surface p.text-sm.uppercase", en: "Trusted use cases", uk: "Перевірені сценарії використання" },
  { selector: "#about .rounded-2xl.border.border-white\\/60.bg-sound-surface li:nth-child(1)", en: "• Live events & conferences", uk: "• Події та конференції" },
  { selector: "#about .rounded-2xl.border.border-white\\/60.bg-sound-surface li:nth-child(2)", en: "• Interactive museums", uk: "• Інтерактивні музеї" },
  { selector: "#about .rounded-2xl.border.border-white\\/60.bg-sound-surface li:nth-child(3)", en: "• Smart retail & venues", uk: "• Інтерактивний ритейл і локації" },
  { selector: "#about .rounded-2xl.border.border-white\\/60.bg-sound-surface li:nth-child(4)", en: "• Private community drops", uk: "• Закриті активації для спільнот" },
  { selector: "#about .rounded-2xl.border.border-white\\/60.bg-gradient-to-br p.text-base", en: "“AudioLink transforms the way we think about proximity experiences. It’s seamless, playful, and privacy-conscious.”", uk: "«AudioLink робить взаємодію поруч із локацією простою: звук передає посилання, а користувач відкриває його телефоном.»" },
  { selector: "#about .rounded-2xl.border.border-white\\/60.bg-gradient-to-br p.mt-4", en: "— Future Interfaces Lab", uk: "— Future Interfaces Lab" },
  { selector: "footer p", attr: "html", en: '&copy; <span id="footer-year"></span> AudioLink. All rights reserved.', uk: '&copy; <span id="footer-year"></span> AudioLink. Усі права захищені.' },
  { selector: "[data-login-action='close']", attr: "aria-label", en: "Close authentication", uk: "Закрити авторизацію" },
  { selector: "#login-overlay h3", en: "Access AudioLink Studio", uk: "Доступ до AudioLink Studio" },
  { selector: "#login-overlay .text-center p.text-sm", en: "Create an account or sign in to manage your sound links.", uk: "Створіть акаунт або увійдіть, щоб керувати аудіопосиланнями." },
  { selector: "footer a[href='/index.html']", en: "Classic experience", uk: "Класичний інтерфейс" },
  { selector: "footer a[href='/privacy']", en: "Privacy", uk: "Конфіденційність" },
  { selector: "footer a[href='/support']", en: "Support", uk: "Підтримка" },
  { selector: '[data-auth-mode-tab="login"]', key: "common.signin" },
  { selector: '[data-auth-mode-tab="register"]', en: "Create account", uk: "Створити акаунт" },
  { selector: "#login-form label[for='login-email']", en: "Email", uk: "Email" },
  { selector: "#login-form label[for='login-password']", en: "Password", uk: "Пароль" },
  { selector: "#login-form button[type='submit']", en: "Continue", uk: "Продовжити" },
  { selector: "#register-form label[for='register-email']", en: "Email", uk: "Email" },
  { selector: "#register-form label[for='register-password']", en: "Password", uk: "Пароль" },
  { selector: "#register-form label[for='register-confirm-password']", en: "Confirm password", uk: "Підтвердіть пароль" },
  { selector: "#register-form button[type='submit']", en: "Create account", uk: "Створити акаунт" },
  { selector: "#login-email", attr: "placeholder", en: "you@example.com", uk: "you@example.com" },
  { selector: "#register-email", attr: "placeholder", en: "you@example.com", uk: "you@example.com" },
  { selector: "#register-password", attr: "placeholder", en: "Minimum 6 characters", uk: "Мінімум 6 символів" },
  { selector: "#register-confirm-password", attr: "placeholder", en: "Re-enter password", uk: "Введіть пароль ще раз" },
];

const STATIC_ADMIN_TRANSLATIONS = [
  { selector: "title", en: "AudioLink · Studio Dashboard", uk: "AudioLink · Дашборд студії" },
  { selector: "#header-settings", key: "common.settings" },
  { selector: "#header-logout", key: "common.logout" },
  { selector: "header .text-sm.font-semibold.text-slate-800", en: "AudioLink Studio", uk: "AudioLink Studio" },
  { selector: "header .text-xs.text-slate-400", en: "Sonic link generation", uk: "Створення аудіопосилань" },
  { selector: "#dashboard-plan-pill", key: "common.plan_free" },
  { selector: "#checkout-success-card p:first-child", en: "Payment confirmed", uk: "Оплату підтверджено" },
  { selector: "#checkout-success-card p.text-lg", en: "Welcome to AudioLink Pro", uk: "Ласкаво просимо до AudioLink Pro" },
  { selector: "#checkout-success-card p.text-sm.text-emerald-600", attr: "html", en: 'Your subscription is active. Session ID: <span id="checkout-success-session"></span>', uk: 'Вашу підписку активовано. ID сесії: <span id="checkout-success-session"></span>' },
  { selector: "#checkout-success-dismiss", key: "common.dismiss" },
  { selector: "#checkout-cancel-card p:first-child", en: "Checkout cancelled", uk: "Оплату скасовано" },
  { selector: "#checkout-cancel-card p.text-lg", en: "You exited the payment flow", uk: "Ви вийшли з процесу оплати" },
  { selector: "#checkout-cancel-card p.text-sm", en: "Retry any time to unlock Pro features.", uk: "Повторіть у будь-який момент, щоб розблокувати Pro-функції." },
  { selector: "#checkout-cancel-card [data-upgrade-plan='pro']", en: "Retry checkout", uk: "Повторити оплату" },
  { selector: "#checkout-cancel-dismiss", key: "common.dismiss" },
  { selector: "#creation p.text-xs", en: "Create Sound Link", uk: "Створити аудіопосилання" },
  { selector: "#creation h1", en: "Encode any URL into an ultrasound signature", uk: "Перетворіть URL на аудіосигнал" },
  { selector: "#silent-mode-badge", en: "Ultrasound · Silent optimized", uk: "Ультразвук · оптимізовано для тихого режиму" },
  { selector: "label[for='new-encode-input']", en: "URL", uk: "URL" },
  { selector: "#new-encode-input", attr: "placeholder", en: "Paste a URL...", uk: "Вставте URL..." },
  { selector: "#new-generate-sound-label", en: "Generate Sound Link", uk: "Створити аудіопосилання" },
  { selector: "#new-play-sound-label", en: "Play", uk: "Відтворити" },
  { selector: "#new-download-sound-label", en: "Download", uk: "Завантажити" },
  { selector: "#new-open-link", attr: "title", en: "Open link", uk: "Відкрити посилання" },
  { selector: "#new-open-link", attr: "aria-label", en: "Open link", uk: "Відкрити посилання" },
  { selector: "#new-delete-sound", attr: "title", en: "Delete sound", uk: "Видалити звук" },
  { selector: "#new-delete-sound", attr: "aria-label", en: "Delete sound", uk: "Видалити звук" },
  { selector: "#creation .rounded-3xl .text-sm.font-semibold.text-slate-600", en: "Generated Sound Controls", uk: "Керування згенерованим звуком" },
  { selector: "#creation .rounded-3xl .text-xs.font-semibold.text-slate-500", en: "Current", uk: "Поточний" },
  { selector: "[data-loop-label]", en: "Loop in background", uk: "Повторювати у фоні" },
  { selector: "#analytics-tab-overview", en: "Overview", uk: "Огляд" },
  { selector: "#analytics-tab-trends", en: "Trends", uk: "Тренди" },
  { selector: "#analytics-link-scope-label", en: "Link scope", uk: "Дані по посиланнях" },
  { selector: "#analytics-link-scope option[value='all']", en: "All links", uk: "Усі посилання" },
  { selector: "#analytics-link-scope option[value='selected']", en: "Selected link", uk: "Вибране посилання" },
  { selector: "#analytics-retry-button", en: "Retry", uk: "Повторити" },
  { selector: "#analytics-updated-at", key: "runtime.analytics_updated_just_now" },
  { selector: "#analytics-trend-title", en: "Trend", uk: "Тренд" },
  { selector: "#analytics-trend-hint", key: "runtime.analytics_trend_hint" },
  { selector: "#analytics-trend-empty", en: "No data for selected period.", uk: "Немає даних за вибраний період." },
  { selector: "#analytics-trend-error", en: "Failed to load analytics.", uk: "Не вдалося завантажити аналітику." },
  { selector: "#analytics-top-title", en: "Top links", uk: "Найактивніші посилання" },
  { selector: "#analytics-top-hint", en: "By scans", uk: "За скануваннями" },
  { selector: "#analytics-top-empty", en: "No links with scans yet.", uk: "Ще немає посилань зі скануваннями." },
  { selector: "#analytics-top-error", en: "Failed to load top links.", uk: "Не вдалося завантажити найактивніші посилання." },
  { selector: "#analytics-top-col-link", en: "Link", uk: "Посилання" },
  { selector: "#analytics-top-col-scans", en: "Scans", uk: "Сканування" },
  { selector: "#analytics-top-col-last", en: "Last scan", uk: "Останнє сканування" },
  { selector: "#analytics-top-col-open-rate", en: "Open rate", uk: "Коеф. відкриття" },
  { selector: ".card-surface.p-6 .text-xs.font-semibold.uppercase.tracking-wide.text-slate-400", en: "Recent Sound Links", uk: "Останні аудіопосилання" },
  { selector: ".card-surface.p-6 .text-lg.font-semibold.text-slate-900", en: "Your generation history", uk: "Ваша історія генерацій" },
  { selector: ".card-surface.p-8:nth-of-type(2) p.text-xs", en: "Performance Analytics", uk: "Аналітика ефективності" },
  { selector: ".card-surface.p-8:nth-of-type(2) h2", en: "Monitor your sonic traffic", uk: "Відстежуйте сканування аудіопосилань" },
  { selector: "#analytics-context", en: "Overall analytics", uk: "Загальна аналітика" },
  { selector: "#analytics-card-1-label", en: "Total scans", uk: "Усього сканувань" },
  { selector: "#analytics-card-2-label", en: "Active links", uk: "Активні посилання" },
  { selector: "#analytics-card-3-label", en: "Scans (24h)", uk: "Сканування (24г)" },
  { selector: "#analytics-card-4-label", en: "Last scan", uk: "Останнє сканування" },
  { selector: "#encode-history-empty", en: "Generated sound links will appear here with quick controls.", uk: "Тут з’являтимуться створені аудіопосилання зі швидким керуванням." },
  { selector: "#last-decode-card p.text-xs", en: "Last detected link", uk: "Останнє знайдене посилання" },
  { selector: "#dashboard-last-result", key: "runtime.value_none" },
  { selector: "#scan-overlay > div > button[data-scan-action='close']", attr: "aria-label", en: "Close scanner", uk: "Закрити сканер" },
  { selector: "#scan-overlay .text-center p.text-xs", en: "Audio scanner", uk: "Аудіо-сканер" },
  { selector: "#scan-overlay .text-center h3", en: "Listening for sound links", uk: "Прослуховування аудіопосилань" },
  { selector: "#scan-status", en: "Position your device near the source.", uk: "Розташуйте пристрій ближче до джерела звуку." },
  { selector: "#scan-countdown", en: "30s remaining", uk: "Залишилось 30с" },
  { selector: "#scan-state-scanning p.rounded-2xl", en: "Keep your speaker within 1 meter for best results. Ultrasound mode is used for decoding.", uk: "Для кращого результату тримайте телефон поруч із джерелом звуку. Сканування працює в ультразвуковому режимі." },
  { selector: "#scan-state-success .font-semibold", en: "Sound link detected!", uk: "Аудіопосилання виявлено!" },
  { selector: "#scan-state-timeout .font-semibold", en: "No sound link detected", uk: "Аудіопосилання не виявлено" },
  { selector: "#scan-state-timeout .text-amber-600", en: "Make sure the transmitter is playing the AudioLink tone and try again.", uk: "Переконайтеся, що передавач відтворює тон AudioLink, і спробуйте ще раз." },
  { selector: "#settings p.text-xs", en: "Account settings", uk: "Налаштування акаунта" },
  { selector: "#settings h3", en: "Profile and billing", uk: "Профіль і білінг" },
  { selector: "#settings [data-upgrade-plan='pro']", en: "Manage plan", uk: "Керувати планом" },
  { selector: "#settings-logout", key: "common.logout" },
  { selector: "#scan-state-scanning #scan-stop-button", en: "Stop Listening", uk: "Зупинити прослуховування" },
  { selector: "#scan-state-scanning [data-scan-action='close']", key: "common.cancel" },
  { selector: "#scan-state-success #scan-open-link", key: "common.open_link" },
  { selector: "#scan-state-success [data-scan-action='close']", key: "common.close" },
  { selector: "#scan-state-timeout #scan-try-again", key: "common.try_again" },
  { selector: "#scan-state-timeout [data-scan-action='close']", key: "common.close" },
];

function resolveLanguage(input) {
  if (!input) return "en";
  const normalized = String(input).toLowerCase().slice(0, 2);
  return SUPPORTED_LANGUAGES.has(normalized) ? normalized : "en";
}

function interpolate(template, values = {}) {
  return String(template || "").replace(/\{(\w+)\}/g, (_, key) => {
    if (Object.prototype.hasOwnProperty.call(values, key)) {
      return String(values[key]);
    }
    return `{${key}}`;
  });
}

function translationFor(path, language = currentLanguage) {
  const [scope, key] = path.split(".");
  const dict = TRANSLATIONS[language];
  return dict?.[scope]?.[key] || TRANSLATIONS.en?.[scope]?.[key] || path;
}

function setNodeValue(node, value, attr) {
  if (!node) return;
  if (attr === "html") {
    node.innerHTML = value;
    return;
  }
  if (attr) {
    node.setAttribute(attr, value);
    return;
  }
  node.textContent = value;
}

function applyStaticTranslations(entries) {
  entries.forEach((entry) => {
    const nodes = Array.from(document.querySelectorAll(entry.selector));
    if (!nodes.length) return;
    const value = entry.key
      ? translationFor(entry.key)
      : currentLanguage === "uk"
      ? entry.uk
      : entry.en;
    if (value === undefined || value === null) return;
    nodes.forEach((node) => setNodeValue(node, value, entry.attr));
  });
}

function updateLanguageButtons() {
  const buttons = Array.from(document.querySelectorAll("[data-lang-switch]"));
  buttons.forEach((button) => {
    const lang = resolveLanguage(button.dataset.langSwitch);
    const isActive = lang === currentLanguage;
    button.classList.toggle("bg-white", isActive);
    button.classList.toggle("text-slate-900", isActive);
    button.classList.toggle("shadow-sm", isActive);
    button.classList.toggle("text-slate-500", !isActive);
    button.setAttribute("aria-pressed", isActive ? "true" : "false");
  });
}

export function initLanguage() {
  const storedLanguage = localStorage.getItem(LANGUAGE_STORAGE_KEY);
  if (storedLanguage) {
    currentLanguage = resolveLanguage(storedLanguage);
  } else {
    const browserLanguage =
      (Array.isArray(navigator.languages) && navigator.languages.length
        ? navigator.languages[0]
        : navigator.language) || "en";
    currentLanguage = resolveLanguage(browserLanguage);
  }
  document.documentElement.lang = currentLanguage;
  updateLanguageButtons();
  return currentLanguage;
}

export function setLanguage(language) {
  currentLanguage = resolveLanguage(language);
  localStorage.setItem(LANGUAGE_STORAGE_KEY, currentLanguage);
  document.documentElement.lang = currentLanguage;
  updateLanguageButtons();
  return currentLanguage;
}

export function getCurrentLanguage() {
  return currentLanguage;
}

export function t(path, values) {
  return interpolate(translationFor(path), values);
}

export function applyPageTranslations(pageType) {
  if (pageType === "admin") {
    applyStaticTranslations(STATIC_ADMIN_TRANSLATIONS);
  } else {
    applyStaticTranslations(STATIC_INDEX_TRANSLATIONS);
  }
  updateLanguageButtons();
}
