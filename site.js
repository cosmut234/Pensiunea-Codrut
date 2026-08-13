(function () {
  "use strict";

  const header = document.querySelector("[data-header]");
  const menuButton = document.querySelector("[data-menu-toggle]");
  const mobileMenu = document.querySelector("[data-mobile-menu]");

  const updateHeader = () => {
    if (!header) return;
    header.classList.toggle("is-scrolled", window.scrollY > 24);
  };

  const closeMenu = () => {
    if (!menuButton || !mobileMenu || !header) return;
    menuButton.setAttribute("aria-expanded", "false");
    menuButton.setAttribute("aria-label", "Deschide meniul");
    mobileMenu.hidden = true;
    header.classList.remove("is-open");
    document.body.classList.remove("menu-open");
  };

  if (menuButton && mobileMenu && header) {
    menuButton.addEventListener("click", () => {
      const shouldOpen = menuButton.getAttribute("aria-expanded") !== "true";
      menuButton.setAttribute("aria-expanded", String(shouldOpen));
      menuButton.setAttribute("aria-label", shouldOpen ? "Închide meniul" : "Deschide meniul");
      mobileMenu.hidden = !shouldOpen;
      header.classList.toggle("is-open", shouldOpen);
      document.body.classList.toggle("menu-open", shouldOpen);
    });

    mobileMenu.querySelectorAll("a").forEach((link) => {
      link.addEventListener("click", closeMenu);
    });
  }

  window.addEventListener("scroll", updateHeader, { passive: true });
  window.addEventListener("resize", () => {
    if (window.innerWidth > 960) closeMenu();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeMenu();
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
})();
