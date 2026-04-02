async function loadProjects() {
  const res = await fetch("projects.json");
  const projects = await res.json();

  const container = document.getElementById("projects");

  projects.forEach(p => {
    const card = document.createElement("a");
    card.className = "card";
    card.href = p.path;

    card.innerHTML = `
      <h2>${p.name}</h2>
      <p>${p.description}</p>
      <div class="tags">
        ${p.tags.map(tag => `<span>${tag}</span>`).join("")}
      </div>
    `;

    container.appendChild(card);
  });
}

loadProjects();