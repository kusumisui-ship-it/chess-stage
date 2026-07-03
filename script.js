const matchPanel = document.getElementById("matchPanel");
const boxPanel = document.getElementById("boxPanel");

const matchButton = document.getElementById("matchButton");
const boxButton = document.getElementById("boxButton");

const brandButton = document.getElementById("brandButton");

const navButtons = document.querySelectorAll(".nav-button");
const subActions = document.querySelectorAll(".sub-action");

const toast = document.getElementById("toast");
const toastText = document.getElementById("toastText");

let toastTimer = null;

function closePanel(panel, button) {
  panel.classList.remove("open");
  button.setAttribute("aria-expanded", "false");
}

function openPanel(panel, button) {
  panel.classList.add("open");
  button.setAttribute("aria-expanded", "true");
}

function closeAllPanels() {
  closePanel(matchPanel, matchButton);
  closePanel(boxPanel, boxButton);
}

function togglePanel(targetPanel, targetButton) {
  const isOpen = targetPanel.classList.contains("open");

  closeAllPanels();

  if (!isOpen) {
    openPanel(targetPanel, targetButton);
  }
}

function showToast(message) {
  window.clearTimeout(toastTimer);

  toastText.textContent = message;
  toast.classList.add("visible");

  toastTimer = window.setTimeout(() => {
    toast.classList.remove("visible");
  }, 1500);
}

function setActiveNav(targetButton) {
  navButtons.forEach((button) => {
    button.classList.remove("active");
  });

  targetButton.classList.add("active");
}

matchButton.addEventListener("click", () => {
  togglePanel(matchPanel, matchButton);
});

boxButton.addEventListener("click", () => {
  togglePanel(boxPanel, boxButton);
});

brandButton.addEventListener("click", () => {
  closeAllPanels();

  const homeButton = document.querySelector(
    '[data-nav="home"]'
  );

  setActiveNav(homeButton);
});

navButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const target = button.dataset.nav;

    setActiveNav(button);

    if (target === "home") {
      closeAllPanels();
      return;
    }

    if (target === "box") {
      closeAllPanels();
      openPanel(boxPanel, boxButton);
      showToast("BOX");
      return;
    }

    if (target === "shop") {
      closeAllPanels();
      showToast("SHOP — Task 7");
      return;
    }

    if (target === "menu") {
      closeAllPanels();
      showToast("MENU");
    }
  });
});

subActions.forEach((button) => {
  button.addEventListener("click", () => {
    const mode = button.dataset.mode;
    const box = button.dataset.box;

    if (mode === "free") {
      showToast("FREE MATCH — Task 4");
      return;
    }

    if (mode === "rank") {
      showToast("RANKED — Task 5");
      return;
    }

    if (mode === "cpu") {
      showToast("CPU MATCH — Task 3");
      return;
    }

    if (mode === "spectate") {
      showToast("WATCH — Task 8");
      return;
    }

    if (box === "character") {
      showToast("CHARACTER — Task 6");
      return;
    }

    if (box === "piece") {
      showToast("PIECES — Task 6");
      return;
    }

    if (box === "theme") {
      showToast("THEME — Task 6");
    }
  });
});