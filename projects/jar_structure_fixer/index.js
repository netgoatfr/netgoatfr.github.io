
import { unzip } from 'https://cdn.skypack.dev/fflate@0.8.2?min';

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
/** 
 * @param {string} id
 * @param {string} text
 * @returns {string}
 */
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
function checkApi()
{ 
    //Check support for the File API support 
    if ( window.File && window.FileReader && window.FileList && window.Blob )
    {
        var fileSelected = document.getElementById( "inputFile" );
        fileSelected.addEventListener( "change", handleFile, false );
    } 
    else
    { 
        alert( "Files are not supported" ); 
    } 
}

async function handleFile(ev) {
  const file = /** @type {HTMLInputElement } */ (ev.target).files.item(0)
  if (!file) {
    alert("Invalid file")
    return
  }
  
  var buffer = await file.bytes()
  var fileReader = new FileReader(); 
  fileReader.onload = function ( e )
  { 

    unzip(e.target, (err, files) => {
      if (err) throw err;

      const content = new TextDecoder().decode(files['script.js']);
      console.log(content);
    });
  } 
  fileReader.readAsArrayBuffer( buffer );

}

function init() {

  setApp(`
    <h1>Jar Structure Fixer</h1>
    <div class="fixer">
      <div id="openFile"><input type="file" id="inputFile" /></div>

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