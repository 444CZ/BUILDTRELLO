const state = {
  token: localStorage.getItem('rb_token') || '',
  user: null,
  users: [],
  projects: [],
  meta: { roles: [], projectStatuses: [], taskStatuses: [] },
};

const $ = (s) => document.querySelector(s);
const authView = $('#auth-view');
const dashboardView = $('#dashboard-view');
const authMessage = $('#auth-message');

async function api(path, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  if (state.token) headers.Authorization = `Bearer ${state.token}`;
  const response = await fetch(path, { ...options, headers });
  if (response.status === 204) return null;
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Chyba API');
  return data;
}

function setAuthMessage(text, isError = false) {
  authMessage.textContent = text;
  authMessage.style.color = isError ? '#ff8888' : '#8ac6ff';
}

function setView(logged) {
  authView.classList.toggle('hidden', logged);
  dashboardView.classList.toggle('hidden', !logged);
}

function fillSelect(select, values, empty = null) {
  select.innerHTML = '';
  if (empty) {
    const option = document.createElement('option');
    option.value = '';
    option.textContent = empty;
    select.append(option);
  }
  values.forEach((item) => {
    const option = document.createElement('option');
    if (typeof item === 'object') {
      option.value = item.value;
      option.textContent = item.label;
    } else {
      option.value = item;
      option.textContent = item;
    }
    select.append(option);
  });
}

function formatMoney(value) {
  return Number(value || 0).toLocaleString('cs-CZ');
}

function peopleText(members) {
  if (!members?.length) return 'Bez členů';
  return members.map((m) => m.name).join(', ');
}

function groupByStatus(projects) {
  return state.meta.projectStatuses.reduce((acc, status) => {
    acc[status] = projects.filter((p) => p.status === status);
    return acc;
  }, {});
}

function renderPeople() {
  const list = $('#people-list');
  list.innerHTML = '';
  state.users.forEach((user) => {
    const li = document.createElement('li');
    li.textContent = `${user.name} · ${user.role}`;
    list.append(li);
  });
}

function renderBoard() {
  $('#user-badge').textContent = `Přihlášen: ${state.user.name} (${state.user.role})`;
  const columns = $('#board-columns');
  columns.innerHTML = '';
  const grouped = groupByStatus(state.projects);

  state.meta.projectStatuses.forEach((status) => {
    const col = document.createElement('section');
    col.className = 'status-column';
    col.innerHTML = `<h3>${status}</h3>`;

    grouped[status].forEach((project) => {
      const taskProgressDone = project.tasks.filter((t) => t.status === 'Hotovo').length;
      const card = document.createElement('article');
      card.className = 'project-card';
      card.innerHTML = `
        <h4>${project.title}</h4>
        <p class="meta">${project.client} · ${project.address}</p>
        <p class="meta">Rozpočet: ${formatMoney(project.estimatedPrice)} Kč</p>
        <div class="badges">
          <span class="badge">Úkoly: ${project.tasks.length}</span>
          <span class="badge">Hotovo: ${taskProgressDone}</span>
        </div>
        <p class="meta">Lidé: ${peopleText(project.members)}</p>
        <div class="card-actions">
          <button data-action="task-new" data-id="${project.id}">+ Úkol</button>
          <button data-action="project-edit" data-id="${project.id}" class="secondary">Upravit</button>
          <button data-action="project-delete" data-id="${project.id}" class="secondary">Smazat</button>
        </div>
      `;

      const taskList = document.createElement('div');
      taskList.className = 'task-list';
      project.tasks.slice(0, 3).forEach((task) => {
        const item = document.createElement('div');
        item.className = 'task-item';
        item.innerHTML = `
          <strong>${task.title}</strong>
          <small>${task.status}${task.assigneeName ? ` · ${task.assigneeName}` : ''}</small>
          <div class="card-actions" style="margin-top:0.3rem">
            <button data-action="task-edit" data-id="${task.id}" data-project-id="${project.id}" class="secondary">Upravit</button>
            <button data-action="task-delete" data-id="${task.id}" class="secondary">Smazat</button>
          </div>
        `;
        taskList.append(item);
      });
      if (project.tasks.length > 3) {
        const extra = document.createElement('small');
        extra.className = 'meta';
        extra.textContent = `+${project.tasks.length - 3} dalších úkolů...`;
        taskList.append(extra);
      }
      card.append(taskList);
      col.append(card);
    });

    if (!grouped[status].length) {
      const empty = document.createElement('p');
      empty.className = 'meta';
      empty.textContent = 'Zatím žádná zakázka';
      col.append(empty);
    }

    columns.append(col);
  });
}

async function refreshData() {
  const [usersRes, projectsRes] = await Promise.all([api('/api/users'), api('/api/projects')]);
  state.users = usersRes.users;
  state.projects = projectsRes.projects;
  renderPeople();
  renderBoard();
}

function openProjectDialog(project = null) {
  const dialog = $('#project-dialog');
  $('#project-dialog-title').textContent = project ? 'Upravit zakázku' : 'Nová zakázka';
  $('#project-id').value = project?.id || '';
  $('#project-title').value = project?.title || '';
  $('#project-description').value = project?.description || '';
  $('#project-client').value = project?.client || '';
  $('#project-price').value = project?.estimatedPrice || '';
  $('#project-address').value = project?.address || '';
  $('#project-status').value = project?.status || state.meta.projectStatuses[0];

  const memberIds = new Set((project?.members || []).map((m) => String(m.id)));
  [...$('#project-members').options].forEach((option) => {
    option.selected = memberIds.has(option.value);
  });

  dialog.showModal();
}

function openTaskDialog(projectId, task = null) {
  const dialog = $('#task-dialog');
  $('#task-dialog-title').textContent = task ? 'Upravit úkol' : 'Nový úkol';
  $('#task-project-id').value = projectId;
  $('#task-id').value = task?.id || '';
  $('#task-title').value = task?.title || '';
  $('#task-description').value = task?.description || '';
  $('#task-status').value = task?.status || state.meta.taskStatuses[0];
  $('#task-assignee').value = task?.assigneeId || '';
  dialog.showModal();
}

async function boot() {
  state.meta = await api('/api/meta');
  fillSelect($('#register-role'), state.meta.roles);
  fillSelect($('#project-status'), state.meta.projectStatuses);
  fillSelect($('#task-status'), state.meta.taskStatuses);

  if (state.token) {
    try {
      const me = await api('/api/me');
      state.user = me.user;
      setView(true);
      await refreshData();
      fillSelect(
        $('#project-members'),
        state.users.map((u) => ({ value: String(u.id), label: `${u.name} (${u.role})` }))
      );
      fillSelect(
        $('#task-assignee'),
        state.users.map((u) => ({ value: String(u.id), label: `${u.name} (${u.role})` })),
        'Nepřiřazeno'
      );
    } catch {
      localStorage.removeItem('rb_token');
      state.token = '';
      setView(false);
    }
  }
}

$('.tabs').addEventListener('click', (event) => {
  const target = event.target;
  if (!target.matches('.tab')) return;
  const tab = target.dataset.tab;
  document.querySelectorAll('.tab').forEach((item) => item.classList.remove('active'));
  target.classList.add('active');
  $('#login-form').classList.toggle('hidden', tab !== 'login');
  $('#register-form').classList.toggle('hidden', tab !== 'register');
});

$('#register-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  try {
    const data = await api('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        name: $('#register-name').value.trim(),
        email: $('#register-email').value.trim(),
        role: $('#register-role').value,
        password: $('#register-password').value,
      }),
    });
    state.token = data.token;
    state.user = data.user;
    localStorage.setItem('rb_token', data.token);
    setAuthMessage('Účet vytvořen, přihlašuji...');
    setView(true);
    await refreshData();
    fillSelect(
      $('#project-members'),
      state.users.map((u) => ({ value: String(u.id), label: `${u.name} (${u.role})` }))
    );
    fillSelect(
      $('#task-assignee'),
      state.users.map((u) => ({ value: String(u.id), label: `${u.name} (${u.role})` })),
      'Nepřiřazeno'
    );
  } catch (error) {
    setAuthMessage(error.message, true);
  }
});

$('#login-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  try {
    const data = await api('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: $('#login-email').value.trim(), password: $('#login-password').value }),
    });
    state.token = data.token;
    state.user = data.user;
    localStorage.setItem('rb_token', data.token);
    setView(true);
    await refreshData();
    fillSelect(
      $('#project-members'),
      state.users.map((u) => ({ value: String(u.id), label: `${u.name} (${u.role})` }))
    );
    fillSelect(
      $('#task-assignee'),
      state.users.map((u) => ({ value: String(u.id), label: `${u.name} (${u.role})` })),
      'Nepřiřazeno'
    );
  } catch (error) {
    setAuthMessage(error.message, true);
  }
});

$('#logout-btn').addEventListener('click', async () => {
  try {
    await api('/api/auth/logout', { method: 'POST' });
  } catch {}
  localStorage.removeItem('rb_token');
  state.token = '';
  state.user = null;
  setView(false);
});

$('#new-project-btn').addEventListener('click', () => openProjectDialog());
$('#cancel-project').addEventListener('click', () => $('#project-dialog').close());
$('#cancel-task').addEventListener('click', () => $('#task-dialog').close());

$('#project-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const projectId = $('#project-id').value;
  const payload = {
    title: $('#project-title').value.trim(),
    description: $('#project-description').value.trim(),
    client: $('#project-client').value.trim(),
    estimatedPrice: Number($('#project-price').value),
    address: $('#project-address').value.trim(),
    status: $('#project-status').value,
    memberIds: [...$('#project-members').selectedOptions].map((option) => Number(option.value)),
  };

  try {
    await api(projectId ? `/api/projects/${projectId}` : '/api/projects', {
      method: projectId ? 'PUT' : 'POST',
      body: JSON.stringify(payload),
    });
    $('#project-dialog').close();
    await refreshData();
  } catch (error) {
    alert(error.message);
  }
});

$('#task-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const projectId = $('#task-project-id').value;
  const taskId = $('#task-id').value;
  const payload = {
    title: $('#task-title').value.trim(),
    description: $('#task-description').value.trim(),
    status: $('#task-status').value,
    assigneeId: $('#task-assignee').value ? Number($('#task-assignee').value) : null,
  };

  try {
    await api(taskId ? `/api/tasks/${taskId}` : `/api/projects/${projectId}/tasks`, {
      method: taskId ? 'PUT' : 'POST',
      body: JSON.stringify(payload),
    });
    $('#task-dialog').close();
    await refreshData();
  } catch (error) {
    alert(error.message);
  }
});

$('#board-columns').addEventListener('click', async (event) => {
  const button = event.target.closest('button[data-action]');
  if (!button) return;

  const action = button.dataset.action;
  const projectId = Number(button.dataset.id || button.dataset.projectId);

  if (action === 'project-edit') {
    const project = state.projects.find((p) => p.id === projectId);
    if (project) openProjectDialog(project);
    return;
  }

  if (action === 'project-delete') {
    if (!confirm('Opravdu smazat zakázku včetně úkolů?')) return;
    await api(`/api/projects/${projectId}`, { method: 'DELETE' });
    await refreshData();
    return;
  }

  if (action === 'task-new') {
    openTaskDialog(projectId);
    return;
  }

  if (action === 'task-delete') {
    if (!confirm('Smazat úkol?')) return;
    await api(`/api/tasks/${button.dataset.id}`, { method: 'DELETE' });
    await refreshData();
    return;
  }

  if (action === 'task-edit') {
    const pId = Number(button.dataset.projectId);
    const taskId = Number(button.dataset.id);
    const project = state.projects.find((p) => p.id === pId);
    const task = project?.tasks.find((t) => t.id === taskId);
    if (project && task) openTaskDialog(project.id, task);
  }
});

boot();
