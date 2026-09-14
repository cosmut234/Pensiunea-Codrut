(function () {
  "use strict";

  const measurementId = "G-WFJ6KDGGWN";
  const storageKey = "codrut.analytics-consent.v1";
  const preferenceCookie = "codrut_analytics_consent";
  const lifetime = 180 * 24 * 60 * 60 * 1000;
  const isEnglish = document.documentElement.lang.toLowerCase().startsWith("en");
  let enabled = false;
  let memoryChoice = null;

  const readPreferenceCookie = () => {
    const value = document.cookie.split(";").map(cookie => cookie.trim()).find(cookie => cookie.startsWith(`${preferenceCookie}=`))?.split("=")[1];
    return ["granted", "denied"].includes(value) ? value : null;
  };

  const savePreferenceCookie = (value) => {
    document.cookie = `${preferenceCookie}=${value}; Max-Age=${lifetime / 1000}; Path=/; SameSite=Lax${location.protocol === "https:" ? "; Secure" : ""}`;
    return readPreferenceCookie() === value;
  };

  const readChoice = () => {
    const cookieChoice = readPreferenceCookie();
    if (cookieChoice !== null) return cookieChoice;
    if (memoryChoice !== null) return memoryChoice;
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey));
      return saved && ["granted", "denied"].includes(saved.value) && saved.expires > Date.now() ? saved.value : null;
    } catch {
      return memoryChoice;
    }
  };

  const saveChoice = (value) => {
    let saved = savePreferenceCookie(value);
    try {
      localStorage.setItem(storageKey, JSON.stringify({ value, expires: Date.now() + lifetime }));
      memoryChoice = null;
      return true;
    } catch {
      // Removing an earlier value makes the next page fail closed if writing
      // a new choice has become unavailable (for example, quota exhaustion).
      try {
        localStorage.removeItem(storageKey);
        memoryChoice = value;
        return saved;
      } catch {
        // With storage blocked, the choice applies only to this page.
      }
      memoryChoice = value;
      return saved;
    }
  };

  const clearAnalyticsCookies = () => {
    const domains = location.hostname.split(".");
    document.cookie.split(";").forEach(cookie => {
      const name = cookie.split("=")[0].trim();
      if (name !== "_ga" && !name.startsWith("_ga_")) return;
      const expired = `${name}=; Max-Age=0; path=/; SameSite=Lax`;
      document.cookie = expired;
      for (let index = 0; index < domains.length - 1; index += 1) {
        document.cookie = `${expired}; domain=${domains.slice(index).join(".")}`;
      }
    });
  };

  const startAnalytics = () => {
    if (enabled) return;
    enabled = true;
    window[`ga-disable-${measurementId}`] = false;
    window.dataLayer = window.dataLayer || [];
    window.gtag = function () { window.dataLayer.push(arguments); };
    window.gtag("consent", "default", {
      analytics_storage: "denied",
      ad_storage: "denied",
      ad_user_data: "denied",
      ad_personalization: "denied",
    });
    window.gtag("consent", "update", { analytics_storage: "granted" });
    window.gtag("js", new Date());
    window.gtag("config", measurementId, {
      allow_google_signals: false,
      allow_ad_personalization_signals: false,
      cookie_expires: lifetime / 1000,
      cookie_update: false,
      page_location: location.origin + location.pathname,
      page_referrer: document.referrer ? document.referrer.split(/[?#]/)[0] : "",
    });
    const script = document.createElement("script");
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${measurementId}`;
    document.head.append(script);
  };

  const labels = isEnglish ? {
    title: "Your privacy matters",
    text: "With your permission, we use Google Analytics cookies to understand visits and clicks on our contact buttons. You can refuse and use the entire website.",
    accept: "Accept", reject: "Refuse", settings: "Cookie settings", policy: "Privacy policy (Romanian)",
  } : {
    title: "Tu alegi ce măsurăm",
    text: "Cu acordul tău, folosim cookie-uri Google Analytics pentru a înțelege vizitele și clicurile pe butoanele de contact. Poți refuza și folosi întregul site.",
    accept: "Acceptă", reject: "Refuză", settings: "Setări cookie-uri", policy: "Politica de confidențialitate",
  };

  const banner = document.createElement("section");
  banner.className = "cookie-banner";
  banner.dataset.cookieBanner = "";
  banner.setAttribute("role", "region");
  banner.setAttribute("aria-labelledby", "cookie-title");
  banner.innerHTML = `<div class="cookie-copy"><h2 id="cookie-title">${labels.title}</h2><p>${labels.text} <a href="/gdpr">${labels.policy}</a>.</p></div><div class="cookie-actions"><button type="button" data-cookie-reject>${labels.reject}</button><button type="button" data-cookie-accept>${labels.accept}</button></div>`;
  const settings = document.createElement("button");
  settings.type = "button";
  settings.className = "cookie-settings";
  settings.dataset.cookieSettings = "";
  settings.textContent = labels.settings;
  settings.setAttribute("aria-controls", "cookie-preferences");
  banner.id = "cookie-preferences";
  const setBannerVisible = (visible) => {
    banner.hidden = !visible;
    settings.setAttribute("aria-expanded", String(visible));
  };
  settings.addEventListener("click", () => {
    setBannerVisible(true);
    banner.querySelector("button").focus();
  });
  banner.querySelector("[data-cookie-accept]").addEventListener("click", () => {
    saveChoice("granted");
    startAnalytics();
    setBannerVisible(false);
    settings.focus({ preventScroll: true });
  });
  banner.querySelector("[data-cookie-reject]").addEventListener("click", () => {
    const withdrawalCanSurviveReload = saveChoice("denied");
    if (typeof window.gtag === "function") {
      window.gtag("consent", "update", {
        analytics_storage: "denied",
        ad_storage: "denied",
        ad_user_data: "denied",
        ad_personalization: "denied",
      });
    }
    window[`ga-disable-${measurementId}`] = true;
    clearAnalyticsCookies();
    setBannerVisible(false);
    // Reload after withdrawal to unload Google's listeners and queued requests.
    if (enabled && withdrawalCanSurviveReload) { location.reload(); return; }
    settings.focus({ preventScroll: true });
  });
  (document.querySelector("footer") || document.body).append(settings);
  document.body.append(banner);

  const syncChoice = () => {
    const choice = readChoice();
    if (choice !== "granted") {
      window[`ga-disable-${measurementId}`] = true;
      clearAnalyticsCookies();
      if (enabled) { location.reload(); return; }
    } else {
      startAnalytics();
    }
    setBannerVisible(choice === null);
  };
  window.addEventListener("storage", event => {
    if (event.key === storageKey || event.key === null) syncChoice();
  });
  window.addEventListener("pageshow", syncChoice);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") syncChoice();
  });
  window.codrutAnalytics = {
    track(eventName, parameters) {
      if (!enabled || readChoice() !== "granted") return;
      window.gtag("event", eventName, parameters);
    },
  };
  syncChoice();
})();
