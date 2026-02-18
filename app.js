const ROLES = [
  "Projektový manažer",
  "Obchodní manažer",
  "Designer",
  "Business support",
  "Vedení",
  "Marketing",
  "Office manager",
];

const BOARD_COLUMNS = ["K vyřízení", "Rozpracováno", "Čeká na klienta", "Hotovo"];

const state = {
  users: JSON.parse(localStorage.getItem("rb_users") || "[]"),
  projects: JSON.parse(localStorage.getItem("rb_projects") || "[]"),
  currentUserId: localStorage.getItem("rb_current_user") || null,
};

const registerForm = document.getElementById("register-form");
const loginForm = document.getElementById("login-form");
const projectForm = document.getElementById("project-form");
const taskForm = document.getElementById("task-form");

const registerRole = document.getElementById("register-role");
const loginEmail = document.getElementById("login-email");
const currentUser = document.getElementById("current-user");
const projectMembers = document.getElementById("project-members");
const taskAssignees = document.getElementById("task-assignees");
const taskProject = document.getElementById("task-project");
const projectCards = document.getElementById("project-cards");

function saveState() {
  localStorage.setItem("rb_users", JSON.stringify(state.users));
  localStorage.setItem("rb_projects", JSON.stringify(state.projects));
  if (state.currentUserId) {
    localStorage.setItem("rb_current_user", state.currentUserId);
  } else {
    localStorage.removeItem("rb_current_user");
  }
}

function renderRoleOptions() {
  registerRole.innerHTML = "";
  for (const role of ROLES) {
    const option = document.createElement("option");
    option.value = role;
    option.textContent = role;
    registerRole.append(option);
  }
}

function renderUsers() {
  loginEmail.innerHTML = "";
  projectMembers.innerHTML = "";
  taskAssignees.innerHTML = "";

  const emptyOption = document.createElement("option");
  emptyOption.value = "";
  emptyOption.textContent = state.users.length ? "Vyberte účet" : "Nejprve vytvořte účet";
  loginEmail.append(emptyOption);

  for (const user of state.users) {
    const option = document.createElement("option");
    option.value = user.email;
    option.textContent = `${user.name} (${user.role})`;
    loginEmail.append(option);

    const projectOption = document.createElement("option");
    projectOption.value = user.id;
    projectOption.textContent = `${user.name} (${user.role})`;
    projectMembers.append(projectOption);

    const taskOption = document.createElement("option");
    taskOption.value = user.id;
    taskOption.textContent = `${user.name} (${user.role})`;
    taskAssignees.append(taskOption);
  }

  renderCurrentUser();
}

function renderCurrentUser() {
  const user = state.users.find((item) => item.id === state.currentUserId);
  currentUser.textContent = user
    ? `Přihlášen: ${user.name} (${user.role})`
    : "Aktuálně není nikdo přihlášen.";
}

function renderProjectsForTaskForm() {
  taskProject.innerHTML = "";
  const emptyOption = document.createElement("option");
  emptyOption.value = "";
  emptyOption.textContent = state.projects.length ? "Vyberte zakázku" : "Nejprve vytvořte zakázku";
  taskProject.append(emptyOption);

  for (const project of state.projects) {
    const option = document.createElement("option");
    option.value = project.id;
    option.textContent = `${project.name} (${project.status})`;
    taskProject.append(option);
  }
}

function resolveNames(ids = []) {
  return ids
    .map((id) => state.users.find((user) => user.id === id)?.name)
    .filter(Boolean)
    .join(", ");
}

function renderBoard() {
  projectCards.innerHTML = "";
  const template = document.getElementById("project-template");

  for (const project of state.projects) {
    const clone = template.content.cloneNode(true);
    clone.querySelector(".project-title").textContent = project.name;
    clone.querySelector(".project-meta").textContent = `${project.client} • Stav: ${project.status}`;
    clone.querySelector(".project-description").textContent = project.description;

    const details = clone.querySelector(".project-details");
    const detailItems = [
      `Adresa: ${project.address}`,
      `Odhadovaná cena: ${Number(project.estimatedPrice).toLocaleString("cs-CZ")} Kč`,
      `Zapojení pracovníci: ${resolveNames(project.memberIds) || "Neuvedeno"}`,
      `Zakázku vytvořil: ${state.users.find((u) => u.id === project.createdBy)?.name || "Neznámý uživatel"}`,
    ];

    for (const item of detailItems) {
      const li = document.createElement("li");
      li.textContent = item;
      details.append(li);
    }

    const columns = clone.querySelector(".board-columns");
    for (const columnName of BOARD_COLUMNS) {
      const column = document.createElement("section");
      column.className = "column";
      const title = document.createElement("h4");
      title.textContent = columnName;
      column.append(title);

      const tasks = project.tasks.filter((task) => task.column === columnName);
      if (!tasks.length) {
        const placeholder = document.createElement("small");
        placeholder.textContent = "Bez úkolů";
        column.append(placeholder);
      } else {
        for (const task of tasks) {
          const taskCard = document.createElement("article");
          taskCard.className = "task";
          const heading = document.createElement("strong");
          heading.textContent = task.title;
          const description = document.createElement("p");
          description.textContent = task.description || "Bez doplňujícího popisu";
          const assignees = document.createElement("small");
          assignees.textContent = `Přiřazení: ${resolveNames(task.assigneeIds) || "Nikdo"}`;
          taskCard.append(heading, description, assignees);
          column.append(taskCard);
        }
      }

      columns.append(column);
    }

    projectCards.append(clone);
  }

  if (!state.projects.length) {
    projectCards.innerHTML = "<p>Zatím nebyla vytvořena žádná realizace.</p>";
  }
}

registerForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const name = document.getElementById("register-name").value.trim();
  const email = document.getElementById("register-email").value.trim().toLowerCase();
  const role = registerRole.value;

  if (!name || !email || !role) {
    return;
  }

  const exists = state.users.some((user) => user.email === email);
  if (exists) {
    alert("Uživatel s tímto e-mailem už existuje.");
    return;
  }

  const user = {
    id: crypto.randomUUID(),
    name,
    email,
    role,
  };

  state.users.push(user);
  state.currentUserId = user.id;
  saveState();
  renderUsers();
  registerForm.reset();
});

loginForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const email = loginEmail.value;
  const user = state.users.find((item) => item.email === email);
  if (!user) {
    alert("Vyberte existující účet.");
    return;
  }

  state.currentUserId = user.id;
  saveState();
  renderCurrentUser();
  loginForm.reset();
});

projectForm.addEventListener("submit", (event) => {
  event.preventDefault();
  if (!state.currentUserId) {
    alert("Nejprve se přihlaste.");
    return;
  }

  const selectedMembers = [...projectMembers.selectedOptions].map((option) => option.value);

  const project = {
    id: crypto.randomUUID(),
    name: document.getElementById("project-name").value.trim(),
    description: document.getElementById("project-description").value.trim(),
    client: document.getElementById("project-client").value.trim(),
    estimatedPrice: document.getElementById("project-estimated-price").value,
    address: document.getElementById("project-address").value.trim(),
    status: document.getElementById("project-status").value,
    memberIds: selectedMembers,
    createdBy: state.currentUserId,
    tasks: [],
  };

  state.projects.unshift(project);
  saveState();
  renderProjectsForTaskForm();
  renderBoard();
  projectForm.reset();
});

taskForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const projectId = taskProject.value;
  const project = state.projects.find((item) => item.id === projectId);

  if (!project) {
    alert("Vyberte platnou zakázku.");
    return;
  }

  const task = {
    id: crypto.randomUUID(),
    title: document.getElementById("task-title").value.trim(),
    description: document.getElementById("task-description").value.trim(),
    column: document.getElementById("task-column").value,
    assigneeIds: [...taskAssignees.selectedOptions].map((option) => option.value),
  };

  project.tasks.push(task);
  saveState();
  renderBoard();
  taskForm.reset();
});

renderRoleOptions();
renderUsers();
renderProjectsForTaskForm();
renderBoard();
