"use strict";

const movePanel = document.querySelector(".move-panel");
const movePanelToggle = document.getElementById("movePanelToggle");
const MOVE_PANEL_KEY = "chess-stage.move-panel-open.v1";

function setMovePanelOpen(open) {
  if (!movePanel || !movePanelToggle) return;
  movePanel.classList.toggle("collapsed", !open);
  movePanelToggle.textContent = open ? "HIDE" : "SHOW";
  movePanelToggle.setAttribute("aria-expanded", open ? "true" : "false");
  try {
    localStorage.setItem(MOVE_PANEL_KEY, open ? "1" : "0");
  } catch (error) {
    console.warn("Move panel preference could not be saved", error);
  }
}

if (movePanel && movePanelToggle) {
  let open = false;
  try {
    open = localStorage.getItem(MOVE_PANEL_KEY) === "1";
  } catch (error) {
    console.warn("Move panel preference could not be read", error);
  }
  setMovePanelOpen(open);
  movePanelToggle.addEventListener("click", () => {
    setMovePanelOpen(movePanel.classList.contains("collapsed"));
  });
}
