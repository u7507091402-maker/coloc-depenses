const usersDiv = document.getElementById("users");
const addUserBtn = document.getElementById("add-user-btn");

function addUserInput() {
  const input = document.createElement("input");
  input.type = "text";
  input.placeholder = "Nom du colocataire";
  usersDiv.appendChild(input);
  usersDiv.appendChild(document.createElement("br"));
}

// 2 colocataires par défaut
addUserInput();
addUserInput();

addUserBtn.onclick = addUserInput;

document.getElementById("coloc-form").onsubmit = function (e) {
  e.preventDefault();

  const colocName = document.getElementById("coloc-name").value;
  const users = [];

  usersDiv.querySelectorAll("input").forEach(input => {
    if (input.value.trim() !== "") {
      users.push({
        id: Date.now() + Math.random(),
        name: input.value.trim()
      });
    }
  });

  // Charger les colocations existantes
  const colocs = JSON.parse(localStorage.getItem("colocs")) || [];

  // Nouvelle colocation
  const newColoc = {
    id: Date.now(),
    name: colocName,
    users: users,
    expenses: []
  };

  colocs.push(newColoc);

  // Sauvegarde
  localStorage.setItem("colocs", JSON.stringify(colocs));

  // Retour à l’accueil
  window.location.href = "index.html";
};