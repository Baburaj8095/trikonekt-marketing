(function () {
  // Example Chart.js init (uses placeholder data). Replace with real data or API calls.
  const ctx = document.getElementById("overviewChart");
  if (ctx && window.Chart) {
    let labels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
    let series = [12, 19, 7, 15, 22, 30, 18];
    try {
      const dataNode = document.getElementById("overviewChartData");
      if (dataNode && dataNode.textContent) {
        const payload = JSON.parse(dataNode.textContent);
        if (Array.isArray(payload.labels) && Array.isArray(payload.data)) {
          labels = payload.labels;
          series = payload.data.map(Number);
        }
      }
    } catch (_) {}

    const data = {
      labels,
      datasets: [{
        label: "New Users",
        data: series,
        borderColor: "#0ea5e9",
        backgroundColor: "rgba(14,165,233,0.25)",
        tension: 0.35,
        fill: true
      }]
    };
    new Chart(ctx, {
      type: "line",
      data,
      options: {
        plugins: { legend: { labels: { color: "#334155" } } },
        scales: {
          x: { ticks: { color: "#64748b" }, grid: { color: "rgba(100,116,139,0.15)" } },
          y: { ticks: { color: "#64748b" }, grid: { color: "rgba(100,116,139,0.15)" } }
        }
      }
    });
  }

  // Optional React widget hook:
  // Build a small React bundle that exposes: window.mountAdminWidget = (el) => { /* ReactDOM.createRoot(el).render(...) */ }
  // Place it at /static/admin/js/widgets.react.js and include it in base_site.html, or dynamically load it here.
  const hook = document.querySelector('[data-widget="react-hook"]');
  if (hook && window.mountAdminWidget) {
    try {
      window.mountAdminWidget(hook);
    } catch (e) {
      console.error("Failed to mount React widget:", e);
    }
  }
  // Sidebar behavior
  const body = document.body;
  const sidebarToggle = document.getElementById("sidebarToggle");
  const COLLAPSE_KEY = "admin.sidebar.collapsed";

  function isDesktop() { return window.innerWidth >= 1024; }

  function applyCollapsedState() {
    const collapsed = localStorage.getItem(COLLAPSE_KEY) === "1";
    if (collapsed) body.classList.add("sidebar-collapsed");
    else body.classList.remove("sidebar-collapsed");
  }

  function closeDrawer() {
    body.classList.remove("sidebar-open");
  }

  function initSidebar() {
    const sidebarEl = document.querySelector(".admin-sidebar");
    if (!sidebarEl) return;

    if (isDesktop()) {
      applyCollapsedState();
      closeDrawer();
    } else {
      body.classList.remove("sidebar-collapsed");
    }

    // Avoid attaching duplicate listeners on window resize
    if (body.dataset.sidebarInited === "1") {
      return;
    }
    body.dataset.sidebarInited = "1";

    if (sidebarToggle) {
      sidebarToggle.addEventListener("click", function () {
        if (isDesktop()) {
          body.classList.toggle("sidebar-collapsed");
          const collapsed = body.classList.contains("sidebar-collapsed");
          localStorage.setItem(COLLAPSE_KEY, collapsed ? "1" : "0");
        } else {
          body.classList.toggle("sidebar-open");
        }
      });
    }
    // Mobile drawer 'X' close button
    const sidebarClose = document.getElementById("sidebarClose");
    if (sidebarClose) {
      sidebarClose.addEventListener("click", function () {
        closeDrawer();
      });
    }

    // Submenu expand/collapse (match SPA behavior)
    const subParents = document.querySelectorAll(".admin-sidebar .sidebar-item > a.sidebar-link");
    subParents.forEach(function (a) {
      const li = a.parentElement;
      const submenu = li.querySelector(":scope > ul.sidebar-subnav");
      if (!submenu) return;

      // restore expand state from sessionStorage
      try {
        const key = "admin.sidebar.expanded:" + (a.getAttribute("href") || a.textContent || "");
        if (sessionStorage.getItem(key) === "1") {
          li.classList.add("expanded");
          a.setAttribute("aria-expanded", "true");
        }
        a.addEventListener("click", function (e) {
          // prevent navigation when toggling groups
          e.preventDefault();
          const expanded = li.classList.toggle("expanded");
          a.setAttribute("aria-expanded", expanded ? "true" : "false");
          try {
            if (expanded) sessionStorage.setItem(key, "1");
            else sessionStorage.removeItem(key);
          } catch (_) {}
        }, { passive: false });
      } catch (_) {}
    });

    // Close mobile drawer on outside click
    document.addEventListener("click", function (e) {
      if (!body.classList.contains("sidebar-open")) return;
      // Do not close if click was inside the sidebar or on the toggle button (or its child icon)
      if (sidebarEl && !sidebarEl.contains(e.target) && !(sidebarToggle && sidebarToggle.contains(e.target))) {
        closeDrawer();
      }
    });

    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") closeDrawer();
    });

    // Close drawer on mobile only for leaf links (no submenu). Keep parents tappable to expand.
    const parentLinks = document.querySelectorAll(".admin-sidebar a.sidebar-link");
    parentLinks.forEach(function (a) {
      a.addEventListener("click", function () {
        if (!isDesktop()) {
          const li = a.parentElement;
          const submenu = li && li.querySelector(":scope > ul.sidebar-subnav");
          if (!submenu) {
            closeDrawer();
          }
        }
      });
    });
    // Always close on sublinks
    const childLinks = document.querySelectorAll(".admin-sidebar a.sidebar-sublink");
    childLinks.forEach(function (a) {
      a.addEventListener("click", function () {
        if (!isDesktop()) {
          closeDrawer();
        }
      });
    });
  }

  window.addEventListener("resize", initSidebar);
  initSidebar();
})();
