document.addEventListener("DOMContentLoaded", () => {

  // ===== RÉFÉRENCES DOM =====
  const colocsList     = document.getElementById("colocs-list");
  const editor         = document.getElementById("coloc-editor");
  const editorTitle    = document.getElementById("editor-title");
  const colocNameInput = document.getElementById("coloc-name-input");
  const usersList      = document.getElementById("users-list");
  const newUserInput   = document.getElementById("new-user-name");
  const newUserWeight  = document.getElementById("new-user-weight");
  const createBtn      = document.getElementById("create-coloc-btn");
  const closeEditorBtn = document.getElementById("close-editor-btn");
  const addUserBtn     = document.getElementById("add-user-btn");
  const saveColocBtn   = document.getElementById("save-coloc-btn");
    
    // INIT SUPABASE
    const SUPABASE_URL = "https://vzsqxtkxzzzqxiyglnlb.supabase.co";
    const SUPABASE_KEY = "sb_publishable_dKJ32JikaTFXd5OBwRpBrw__J7HeB2M";
    const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

    // Initialiser ton API (fonction globale dans api.js)
    initApi(supabaseClient);

  // ===== VARIABLES =====
  let colocs = [];
  let users  = [];
  let selectedColoc = null;
  let isCreating = false;
  let tempUsers = [];

  // ===== CHARGEMENT DES DONNÉES =====
  async function loadData() {
    try {
      colocs = await apiGet("colocs");
      users  = await apiGet("users");
      renderColocs();
    } catch(err){
      console.error(err);
      alert("Erreur chargement : "+err.message);
    }
  }

  // ===== RENDER LISTE COLOCATIONS =====
  function renderColocs(){
    colocsList.innerHTML = "";
    if(!colocs.length){
      colocsList.innerHTML = "<li class='muted'>Aucune colocation</li>";
      return;
    }

    colocs.forEach(c=>{
      const li = document.createElement("li");
      li.className="coloc-item";

      const nameSpan = document.createElement("span");
      nameSpan.className="coloc-name";
      nameSpan.textContent = c.name;
      nameSpan.onclick = ()=>location.href=`coloc.html?id=${c.id}`;

      const editBtn = document.createElement("button");
      editBtn.innerHTML = '<i data-lucide="edit-3"></i>';
      editBtn.onclick = e=>{ e.stopPropagation(); openEditEditor(c); };

      const deleteBtn = document.createElement("button");
      deleteBtn.innerHTML = '<i data-lucide="trash-2"></i>';
      deleteBtn.onclick = async e=>{
        e.stopPropagation();
        if(!confirm(`Supprimer "${c.name}" ?`)) return;
        await apiDelete("colocs", { id:c.id });
        loadData();
      };

      li.append(nameSpan, editBtn, deleteBtn);
      colocsList.appendChild(li);
    });

    // active Lucide
    if(window.lucide) lucide.createIcons();
  }

  // ===== OUVRIR L'EDITEUR POUR CREER =====
  function openCreateEditor(){
    isCreating = true;
    selectedColoc = null;
    tempUsers = [];
    editor.style.display="block";
    editorTitle.textContent="➕ Nouvelle colocation";
    colocNameInput.value="";
    renderTempUsers();
  }

  // ===== OUVRIR L'EDITEUR POUR MODIFIER =====
  function openEditEditor(coloc){
    isCreating = false;
    selectedColoc = coloc;
    editor.style.display="block";
    editorTitle.textContent="✏️ Modifier la colocation";
    colocNameInput.value = coloc.name;

    tempUsers = users
      .filter(u=>Number(u.colocid)===Number(coloc.id))
      .map(u=>({ name:u.name, weight:Number(u.weight) }));

    renderTempUsers();
  }

  // ===== FERMER L'EDITEUR =====
  function closeEditor(){
    editor.style.display="none";
    selectedColoc=null;
    isCreating=false;
    tempUsers=[];
    usersList.innerHTML="";
    newUserInput.value="";
    newUserWeight.value="";
  }

  // ===== RENDER TEMP USERS =====
  function renderTempUsers(){
    usersList.innerHTML="";
    if(!tempUsers.length){
      usersList.innerHTML="<li class='muted'>Aucun colocataire</li>";
      return;
    }

    tempUsers.forEach((u,i)=>{
      const li = document.createElement("li");
      li.textContent=`${u.name} (poids: ${u.weight.toFixed(4)})`;

      const delBtn = document.createElement("button");
      delBtn.textContent="✕";
      delBtn.onclick=()=>{ tempUsers.splice(i,1); renderTempUsers(); };

      li.appendChild(delBtn);
      usersList.appendChild(li);
    });
  }

  // ===== AJOUTER UN UTILISATEUR TEMPORAIRE =====
  function addUser(){
    const name = newUserInput.value.trim();
    let weight = parseFloat(newUserWeight.value);

    if(!name) return alert("Nom obligatoire");
    if(tempUsers.some(u=>u.name===name)) return alert("Colocataire déjà présent");
    if(isNaN(weight) || weight<=0 || weight>1) return alert("Poids entre 0 et 1");

    tempUsers.push({ name, weight });
    newUserInput.value="";
    newUserWeight.value="";
    renderTempUsers();
  }

  // ===== ENREGISTRER COLOCATION =====
  async function saveColoc(){
    const name = colocNameInput.value.trim();
    if(!name || !tempUsers.length) return alert("Nom et colocataires obligatoires");

    const totalWeight = tempUsers.reduce((s,u)=>s+u.weight,0);
    if(Math.abs(totalWeight-1)>0.0001) return alert("La somme des poids doit faire 1");

    tempUsers = tempUsers.map(u=>({ name:u.name, weight:parseFloat(u.weight.toFixed(4)) }));

    try{
      if(isCreating){
        const colocData = await apiPost("colocs", { name });
        const colocId = colocData[0].id;
        const usersToInsert = tempUsers.map(u=>({ name:u.name, colocid:colocId, weight:u.weight }));
        await apiPost("users", usersToInsert);
      } else {
        await apiUpdate("colocs",{ name },{ id:selectedColoc.id });
        await apiDelete("users",{ colocid:selectedColoc.id });
        const usersToInsert = tempUsers.map(u=>({ name:u.name, colocid:selectedColoc.id, weight:u.weight }));
        await apiPost("users", usersToInsert);
      }
      loadData();
      closeEditor();
    } catch(err){
      console.error(err);
      alert("Erreur enregistrement : "+err.message);
    }
  }

  // ===== ASSIGNATION DES BOUTONS =====
  createBtn.onclick = openCreateEditor;
  closeEditorBtn.onclick = closeEditor;
  addUserBtn.onclick = addUser;
  saveColocBtn.onclick = saveColoc;

  // ===== CHARGEMENT INITIAL =====
  loadData();

  console.log("✅ index.js chargé – version stable, mobile-ready, poids 0-1");
});
