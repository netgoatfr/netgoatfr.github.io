
// --------- META LOADING ----------
async function loadMeta() {
  try {
    const res = await fetch("meta.json");
    const meta = await res.json();
    document.title = meta.title + "- netgoatfr"
    document.getElementById("project-title").textContent = meta.title;
  } catch {
    document.title = "Project - netgoatfr"
    document.getElementById("project-title").textContent = "Project";
  }
}


// --------- HELPERS -------------
const state = {
};

function button(id, text) {
  return `<button id="${id}">${text}</button>`;
}

// --------- UI HELPERS ----------
function setApp(html) {
  document.getElementById("app").innerHTML = html;
}

function setControls(html) {
  document.getElementById("controls").innerHTML = html;
}

function setInfo(html) {
  document.getElementById("info").innerHTML = html;
}


// --------- PROJECT CODE ----------
function init() {

  setApp(`
    <h1>Jar Structure Fixer</h1>
    <div class="counter">
      <button id="dec">-</button>
      <span id="value">0</span>
      <button id="inc">+</button>
    </div>
  `);

  // Controls panel
  setControls(`
    <button id="reset">Reset</button>
  `);

  // Info panel
  setInfo(`
    <p>This project allow you to load a minecraft mod as a Jar and apply various fixes to the worldgen structures using the mod <a href="https://modrinth.com/mod/lithostitched">Lithostitched</a> </p>
  `);

  document.getElementById("reset").onclick = () => {};
}

// --------- BOOT ----------
loadMeta();
init();