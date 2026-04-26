// status.js
export function showStatus(html, type = "info") {
    const area = document.getElementById("status-area");
    if (!area) return;
    area.innerHTML = `<div class="status status-${type}">${html}</div>`;
}