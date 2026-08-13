document.documentElement.classList.add("js");

(function () {
  "use strict";

  const header = document.querySelector("[data-header]");
  const menuButton = document.querySelector("[data-menu-toggle]");
  const mobileMenu = document.querySelector("[data-mobile-menu]");
  const isEnglish = document.documentElement.lang.toLowerCase().startsWith("en");
  const menuLabels = isEnglish
    ? { open: "Open menu", close: "Close menu" }
    : { open: "Deschide meniul", close: "Închide meniul" };

  const updateHeader = () => {
    if (!header) return;
    header.classList.toggle("is-scrolled", window.scrollY > 24);
  };

  const closeMenu = (restoreFocus = false) => {
    if (!menuButton || !mobileMenu || !header) return;
    const wasOpen = menuButton.getAttribute("aria-expanded") === "true";
    menuButton.setAttribute("aria-expanded", "false");
    menuButton.setAttribute("aria-label", menuLabels.open);
    mobileMenu.hidden = true;
    header.classList.remove("is-open");
    document.body.classList.remove("menu-open");
    if (restoreFocus && wasOpen) menuButton.focus();
  };

  if (menuButton && mobileMenu && header) {
    menuButton.addEventListener("click", () => {
      const shouldOpen = menuButton.getAttribute("aria-expanded") !== "true";
      menuButton.setAttribute("aria-expanded", String(shouldOpen));
      menuButton.setAttribute("aria-label", shouldOpen ? menuLabels.close : menuLabels.open);
      mobileMenu.hidden = !shouldOpen;
      header.classList.toggle("is-open", shouldOpen);
      document.body.classList.toggle("menu-open", shouldOpen);
      if (shouldOpen) {
        window.requestAnimationFrame(() => mobileMenu.querySelector("a, button")?.focus());
      }
    });

    mobileMenu.querySelectorAll("a").forEach((link) => {
      link.addEventListener("click", () => closeMenu(true));
    });
  }

  window.addEventListener("scroll", updateHeader, { passive: true });
  window.addEventListener("resize", () => {
    if (window.innerWidth > 960) closeMenu();
  });
  document.addEventListener("keydown", (event) => {
    if (!menuButton || !mobileMenu || mobileMenu.hidden) return;
    if (event.key === "Escape") {
      event.preventDefault();
      closeMenu(true);
      return;
    }
    if (event.key !== "Tab") return;

    const focusable = [menuButton, ...mobileMenu.querySelectorAll("a[href], button:not([disabled])")];
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  });
  updateHeader();

  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const revealItems = document.querySelectorAll("[data-reveal]");

  if (reducedMotion || !("IntersectionObserver" in window)) {
    revealItems.forEach((item) => item.classList.add("is-visible"));
  } else {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            observer.unobserve(entry.target);
          }
        });
      },
      { rootMargin: "0px 0px -8%", threshold: 0.12 }
    );
    revealItems.forEach((item) => observer.observe(item));
  }

  const dialog = document.querySelector("[data-gallery-dialog]");
  const dialogImage = dialog?.querySelector("[data-dialog-image]");
  const dialogCaption = dialog?.querySelector("[data-dialog-caption]");
  const dialogClose = dialog?.querySelector("[data-dialog-close]");
  const galleryItems = document.querySelectorAll("[data-gallery-item]");

  if (dialog && dialogImage && dialogCaption && dialogClose) {
    galleryItems.forEach((item) => {
      item.addEventListener("click", () => {
        const image = item.querySelector("img");
        if (!image) return;
        dialogImage.src = image.currentSrc || image.src;
        dialogImage.alt = image.alt;
        dialogCaption.textContent = item.dataset.caption || image.alt;
        dialog.showModal();
      });
    });

    dialogClose.addEventListener("click", () => dialog.close());
    dialog.addEventListener("click", (event) => {
      if (event.target === dialog) dialog.close();
    });
  }

  document.querySelectorAll("[data-current-year]").forEach((node) => {
    node.textContent = String(new Date().getFullYear());
  });

  const availabilityForm = document.querySelector("[data-availability-form]");

  if (availabilityForm instanceof HTMLFormElement) {
    const arrival = availabilityForm.elements.namedItem("arrival");
    const departure = availabilityForm.elements.namedItem("departure");
    const stayType = availabilityForm.elements.namedItem("stayType");
    const formError = availabilityForm.querySelector("[data-form-error]");
    const today = new Date();
    const todayIso = [today.getFullYear(), String(today.getMonth() + 1).padStart(2, "0"), String(today.getDate()).padStart(2, "0")].join("-");

    if (arrival instanceof HTMLInputElement) arrival.min = todayIso;
    if (departure instanceof HTMLInputElement) departure.min = todayIso;

    const requestedType = new URLSearchParams(window.location.search).get("tip");
    const requestedInterest = new URLSearchParams(window.location.search).get("interes");
    if (requestedType && stayType instanceof HTMLSelectElement) {
      const matchingOption = Array.from(stayType.options).find((option) => option.value === requestedType);
      if (matchingOption) stayType.value = matchingOption.value;
    }

    document.querySelectorAll("[data-stay-choice]").forEach((link) => {
      link.addEventListener("click", () => {
        if (stayType instanceof HTMLSelectElement) stayType.value = link.dataset.stayChoice || "";
      });
    });

    arrival?.addEventListener("change", () => {
      if (!(arrival instanceof HTMLInputElement) || !(departure instanceof HTMLInputElement)) return;
      departure.min = arrival.value || todayIso;
      if (departure.value && departure.value <= arrival.value) departure.value = "";
    });

    availabilityForm.addEventListener("submit", (event) => {
      event.preventDefault();
      if (!availabilityForm.reportValidity()) return;

      const data = new FormData(availabilityForm);
      const arrivalValue = String(data.get("arrival") || "");
      const departureValue = String(data.get("departure") || "");

      if (departureValue <= arrivalValue) {
        if (formError) {
          formError.textContent = "Data plecării trebuie să fie după data sosirii.";
          formError.hidden = false;
        }
        departure?.focus();
        return;
      }

      if (formError) formError.hidden = true;
      const formatDate = (value) => new Intl.DateTimeFormat("ro-RO", { day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(`${value}T12:00:00`));
      const message = [
        "Bună ziua! Aș dori să verific disponibilitatea la Pensiunea Codruț.",
        "",
        `Sosire: ${formatDate(arrivalValue)}`,
        `Plecare: ${formatDate(departureValue)}`,
        `Adulți: ${data.get("adults")}`,
        `Copii: ${data.get("children")}`,
        `Tip cazare: ${data.get("stayType")}`,
        ...(requestedInterest ? [`Interes: ${requestedInterest}`] : []),
        "",
        "Îmi puteți confirma disponibilitatea și tariful final?",
      ].join("\n");

      sendAnalyticsEvent("submit_availability", {
        contact_method: "whatsapp",
        stay_type: String(data.get("stayType") || ""),
        has_interest: Boolean(requestedInterest),
        page_path: window.location.pathname,
        page_language: document.documentElement.lang || "ro",
      });
      window.open(`https://wa.me/40742599860?text=${encodeURIComponent(message)}`, "_blank", "noopener,noreferrer");
    });
  }

  // Conversion events become active only when an analytics tag or Tag Manager
  // data layer is installed. This file alone does not send data or set cookies.
  const sendAnalyticsEvent = (eventName, parameters) => {
    if (typeof window.gtag === "function") {
      window.gtag("event", eventName, {
        ...parameters,
        transport_type: "beacon",
      });
      return;
    }

    if (Array.isArray(window.dataLayer)) {
      window.dataLayer.push({ event: eventName, ...parameters });
    }
  };

  document.addEventListener("click", (event) => {
    if (!(event.target instanceof Element)) return;
    const link = event.target.closest("a[href]");
    if (!link) return;

    const href = link.href;
    let eventName = "";
    let contactMethod = "";

    if (/^https:\/\/wa\.me\//i.test(href)) {
      eventName = "click_whatsapp";
      contactMethod = "whatsapp";
    } else if (/^tel:/i.test(href)) {
      eventName = "click_phone";
      contactMethod = "phone";
    } else if (/^mailto:/i.test(href)) {
      eventName = "click_email";
      contactMethod = "email";
    } else if (/^https:\/\/(?:www\.)?google\.[^/]+\/maps/i.test(href)) {
      eventName = "click_maps";
      contactMethod = "maps";
    }

    if (!eventName) return;
    sendAnalyticsEvent(eventName, {
      contact_method: contactMethod,
      link_text: (link.textContent || "").trim().replace(/\s+/g, " ").slice(0, 100),
      link_url: href,
      page_path: window.location.pathname,
      page_language: document.documentElement.lang || "ro",
    });
  });
})();
