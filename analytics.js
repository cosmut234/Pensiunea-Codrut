(function () {
  "use strict";
  const attributionPolicy = (function createAttributionPolicy(location, document) {
    const profiles = [
      { source: "instagram", medium: "social", campaign: "profil-2026-10" },
      { source: "facebook", medium: "social", campaign: "profil-2026-10" },
      { source: "tiktok", medium: "social", campaign: "profil-2026-10" },
    ];

    function approvedCampaign() {
      const params = new URLSearchParams(location.search || "");
      const keys = ["utm_source", "utm_medium", "utm_campaign"];
      if (keys.some(key => params.getAll(key).length !== 1)) return {};
      const match = profiles.find(profile =>
        profile.source === params.get("utm_source") &&
        profile.medium === params.get("utm_medium") &&
        profile.campaign === params.get("utm_campaign"));
      if (!match) return {};
      // The returned values are literals from the reviewed profile, never raw URL values.
      return {
        campaign_source: match.source,
        campaign_medium: match.medium,
        campaign_name: match.campaign,
      };
    }

    function safeReferrer() {
      if (!document.referrer) return "";
      try {
        const referrer = new URL(document.referrer);
        if (!["http:", "https:"].includes(referrer.protocol)) return "";
        return referrer.origin + "/";
      } catch {
        return "";
      }
    }

    return {
      configFields() {
        return {
          page_location: location.origin + location.pathname,
          page_referrer: safeReferrer(),
          ...approvedCampaign(),
        };
      },
    };
  })(location, document);

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
      ...attributionPolicy.configFields(),
    });
    const script = document.createElement("script");
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${measurementId}`;
    document.head.append(script);
  };

  const labels = isEnglish ? {
    title: "Optional cookies",
    text: "Google Analytics measures visits and contact clicks only if you accept. You can refuse.",
    accept: "Accept", reject: "Refuse", settings: "Cookie settings", policy: "Privacy policy (Romanian)",
  } : {
    title: "Cookie-uri opționale",
    text: "Google Analytics măsoară vizitele și clicurile de contact doar dacă accepți. Poți refuza.",
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
