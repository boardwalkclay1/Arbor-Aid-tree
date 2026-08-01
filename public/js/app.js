// Toggle mobile menu
function toggleMenu() {
  document.getElementById("mainNav").classList.toggle("open");
}

// Falling leaves animation
const leafContainer = document.getElementById("leaf-container");

function createLeaf() {
  const leaf = document.createElement("div");
  leaf.classList.add("leaf");
  leaf.style.left = Math.random() * 100 + "vw";
  leaf.style.animationDuration = (Math.random() * 3 + 3) + "s";
  leafContainer.appendChild(leaf);

  setTimeout(() => leaf.remove(), 6000);
}

setInterval(createLeaf, 1500);

// Fade-in on load
window.addEventListener("load", () => {
  document.body.classList.add("page-loaded");
});
