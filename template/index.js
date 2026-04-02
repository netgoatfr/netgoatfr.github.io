
// --------- META LOADING ----------
async function loadMeta() {
  try {
    const res = await fetch("meta.json");
    const meta = await res.json();
    document.getElementById("project-title").textContent = meta.title;
  } catch {
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


// --------- PROJECT CODE STARTS HERE ----------
function init() {

}

// --------- BOOT ----------
loadMeta();
init();