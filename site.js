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
    header.classList.toggle("is-scrolled", document.body.matches(".article-page, .guide-page, .commercial-page") || window.scrollY > 24);
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

  // All contact events go through the visitor's current analytics choice.
  const sendAnalyticsEvent = (eventName, parameters) => {
    try {
      window.codrutAnalytics?.track(eventName, parameters);
    } catch (error) {
      console.warn("Analytics event could not be recorded.", error);
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
      page_path: window.location.pathname,
      page_language: document.documentElement.lang || "ro",
    });
  });
})();
