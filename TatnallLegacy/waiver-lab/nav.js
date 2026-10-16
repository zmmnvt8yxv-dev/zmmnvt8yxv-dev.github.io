// Temporary public-site navigation bridge until the next reviewed source-app release.
(() => {
  const destination = "/TatnallLegacy/waiver-lab/";
  function addLink(container) {
    if (!container || container.querySelector('[data-tl-waiver-lab]')) return;
    const anchor = document.createElement("a");
    anchor.dataset.tlWaiverLab = "true";
    anchor.href = destination;
    anchor.textContent = "Waiver Lab";
    container.appendChild(anchor);
  }
  function update() {
    addLink(document.querySelector(".tl-group-nav .tl-nav-group:first-child > div"));
    for (const nav of document.querySelectorAll(".tl-menu-dialog nav")) {
      if (nav.querySelector("h2")?.textContent?.trim() === "League") addLink(nav);
    }
  }
  const observer = new MutationObserver(update);
  const begin = () => {
    update();
    observer.observe(document.body, { childList: true, subtree: true });
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", begin, { once: true });
  else begin();
})();
