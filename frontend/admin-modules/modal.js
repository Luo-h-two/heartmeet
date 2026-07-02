import { show, hide, $ } from "./utils.js";

export function closeModal() {
  hide("modalOverlay");
  $("modalBox").innerHTML = "";
}

export function openModal(content) {
  $("modalBox").innerHTML = content;
  show("modalOverlay");
}

export function initModal() {
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") closeModal();
  });
  $("modalOverlay").addEventListener("click", function (e) {
    if (e.target === this) closeModal();
  });
}