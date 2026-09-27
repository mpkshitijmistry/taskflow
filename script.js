/* =========================================================
   TaskFlow — application logic
   No frameworks, no build step: just the DOM APIs and
   localStorage. Sections below, top to bottom:

   1. State + persistence
   2. Seed data (first run only)
   3. Small helper functions (dates, ids, toasts)
   4. Rendering (sidebar, dashboard, task list)
   5. Filtering + sorting
   6. Modals (task form, confirm, project form)
   7. Event wiring
   8. Init
   ========================================================= */

/* ---------------------------------------------------------
   1. STATE + PERSISTENCE

   Everything the app knows lives in two arrays, `tasks` and
   `projects`. They are kept in memory while the page is open,
   and mirrored into localStorage every time they change — so
   a refresh (or closing the tab) never loses data.
--------------------------------------------------------- */

const STORAGE_KEYS = {
  tasks: 'taskflow.tasks',
  projects: 'taskflow.projects',
  theme: 'taskflow.theme',
};

let tasks = [];
let projects = [];

// Transient UI state (not persisted — resets on reload, which is fine).
let state = {
  activeProjectId: 'all',   // 'all' or a project id
  activeView: 'all',        // all | today | upcoming | completed | overdue
  priorityFilter: 'all',
  statusFilter: 'all',
  sortBy: 'due',
  searchTerm: '',
  editingTaskId: null,      // set when the task modal is open for an existing task
  editingProjectId: null,   // set when the project modal is open for an existing project
  pendingDelete: null,      // { type: 'task' | 'project', id } while the confirm modal is open
};

function saveTasks() {
  localStorage.setItem(STORAGE_KEYS.tasks, JSON.stringify(tasks));
}
function saveProjects() {
  localStorage.setItem(STORAGE_KEYS.projects, JSON.stringify(projects));
}

function loadData() {
  const storedTasks = localStorage.getItem(STORAGE_KEYS.tasks);
  const storedProjects = localStorage.getItem(STORAGE_KEYS.projects);

  if (storedTasks && storedProjects) {
    tasks = JSON.parse(storedTasks);
    projects = JSON.parse(storedProjects);
  } else {
    // First run on this browser: plant seed data so the app
    // never opens empty (see brief, section 03).
    seedData();
    saveTasks();
    saveProjects();
  }
}

/* ---------------------------------------------------------
   2. SEED DATA — 3 projects, 6 tasks, spread across them.
--------------------------------------------------------- */
function seedData() {
  const today = new Date();
  const iso = (offsetDays) => {
    const d = new Date(today);
    d.setDate(d.getDate() + offsetDays);
    return d.toISOString().slice(0, 10);
  };

  projects = [
    { id: 'p1', name: 'Work', createdAt: Date.now() },
    { id: 'p2', name: 'Personal', createdAt: Date.now() },
    { id: 'p3', name: 'Errands', createdAt: Date.now() },
  ];

  tasks = [
    { id: uid(), title: 'Finish internship project brief', description: 'Build and deploy the task manager.', dueDate: iso(0), priority: 'high', status: 'in-progress', projectId: 'p1', createdAt: Date.now() },
    { id: uid(), title: 'Review pull request', description: '', dueDate: iso(-1), priority: 'high', status: 'todo', projectId: 'p1', createdAt: Date.now() },
    { id: uid(), title: 'Team standup notes', description: '', dueDate: iso(2), priority: 'low', status: 'todo', projectId: 'p1', createdAt: Date.now() },
    { id: uid(), title: 'Book dentist appointment', description: '', dueDate: iso(5), priority: 'medium', status: 'todo', projectId: 'p2', createdAt: Date.now() },
    { id: uid(), title: 'Read a chapter before bed', description: '', dueDate: '', priority: 'low', status: 'completed', projectId: 'p2', createdAt: Date.now() },
    { id: uid(), title: 'Pick up groceries', description: '', dueDate: iso(0), priority: 'medium', status: 'todo', projectId: 'p3', createdAt: Date.now() },
  ];
}

/* ---------------------------------------------------------
   3. HELPERS
--------------------------------------------------------- */

// Short unique id — good enough for a client-only app (no
// server ever needs to agree with us on what an id means).
function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function isOverdue(task) {
  return task.dueDate && task.status !== 'completed' && task.dueDate < todayISO();
}
function isToday(task) {
  return task.dueDate === todayISO();
}
function isUpcoming(task) {
  return task.dueDate && task.dueDate > todayISO();
}

function formatDueDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T00:00:00');
  const diffDays = Math.round((d - new Date(todayISO() + 'T00:00:00')) / 86400000);
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Tomorrow';
  if (diffDays === -1) return 'Yesterday';
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function projectById(id) {
  return projects.find((p) => p.id === id);
}

function showToast(message) {
  const container = document.getElementById('toastContainer');
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 2600);
}

/* ---------------------------------------------------------
   4. RENDERING
   Everything here reads from `tasks` / `projects` / `state`
   and rebuilds the relevant piece of the DOM. Simple and a
   little wasteful (we re-render more than strictly needed)
   but easy to follow — the right trade-off for an app this size.
--------------------------------------------------------- */

function renderAll() {
  renderSidebar();
  renderDashboard();
  renderTaskList();
}

function renderSidebar() {
  const list = document.getElementById('projectList');
  const allCount = tasks.length;

  const allRow = projectRowHTML({ id: 'all', name: 'All tasks' }, allCount, state.activeProjectId === 'all');
  const rows = projects.map((p) => {
    const count = tasks.filter((t) => t.projectId === p.id).length;
    return projectRowHTML(p, count, state.activeProjectId === p.id);
  });

  list.innerHTML = allRow + rows.join('');

  // Wire clicks (filter) and edit buttons (rename/delete) after injecting HTML.
  list.querySelectorAll('.project-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.activeProjectId = btn.dataset.id;
      renderAll();
    });
  });
  list.querySelectorAll('.project-edit-btn').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      openProjectModal(btn.dataset.id);
    });
  });

  // Also refresh the project <select> inside the task modal.
  const taskProjectSelect = document.getElementById('taskProject');
  taskProjectSelect.innerHTML = '<option value="">No project</option>' +
    projects.map((p) => `<option value="${p.id}">${escapeHTML(p.name)}</option>`).join('');
}

function projectRowHTML(project, count, isActive) {
  const editButton = project.id === 'all'
    ? ''
    : `<button class="project-edit-btn" data-id="${project.id}" type="button" aria-label="Edit project">&#9998;</button>`;
  return `
    <li class="project-item ${isActive ? 'active' : ''}">
      <button class="project-btn" data-id="${project.id}" type="button">
        <span class="project-dot"></span>
        <span class="project-name">${escapeHTML(project.name)}</span>
        <span class="project-count">${count}</span>
      </button>
      ${editButton}
    </li>`;
}

function renderDashboard() {
  const counts = {
    all: tasks.length,
    today: tasks.filter(isToday).length,
    inProgress: tasks.filter((t) => t.status === 'in-progress').length,
    completed: tasks.filter((t) => t.status === 'completed').length,
    overdue: tasks.filter(isOverdue).length,
  };

  const cards = [
    { key: 'all', label: 'All tasks', value: counts.all, view: 'all' },
    { key: 'today', label: 'Due today', value: counts.today, view: 'today' },
    { key: 'inProgress', label: 'In progress', value: counts.inProgress, view: 'all', statusFilter: 'in-progress' },
    { key: 'completed', label: 'Completed', value: counts.completed, view: 'completed' },
    { key: 'overdue', label: 'Overdue', value: counts.overdue, view: 'overdue', className: 'overdue' },
  ];

  const dashboard = document.getElementById('dashboard');
  dashboard.innerHTML = cards.map((c) => `
    <button class="stat-card ${c.className || ''} ${state.activeView === c.view && c.key !== 'inProgress' ? 'is-active' : ''}"
            data-view="${c.view}" data-status="${c.statusFilter || ''}" type="button">
      <div class="stat-label">${c.label}</div>
      <div class="stat-value">${c.value}</div>
    </button>`).join('');

  dashboard.querySelectorAll('.stat-card').forEach((card) => {
    card.addEventListener('click', () => {
      state.activeView = card.dataset.view;
      state.statusFilter = card.dataset.status || 'all';
      syncViewControlsToState();
      renderAll();
    });
  });
}

function renderTaskList() {
  const container = document.getElementById('taskList');
  const visible = getVisibleTasks();

  if (visible.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <h3>No tasks here</h3>
        <p>${tasks.length === 0
          ? 'Add your first task above to get started.'
          : 'Nothing matches these filters — try a different view or clear the search.'}</p>
      </div>`;
    return;
  }

  container.innerHTML = visible.map(taskRowHTML).join('');

  container.querySelectorAll('.task-checkbox').forEach((box) => {
    box.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleComplete(box.dataset.id);
    });
  });
  container.querySelectorAll('.task-row').forEach((row) => {
    row.addEventListener('click', () => openTaskModal(row.dataset.id));
  });
}

function taskRowHTML(task) {
  const project = projectById(task.projectId);
  const overdue = isOverdue(task);
  const dueLabel = task.dueDate ? formatDueDate(task.dueDate) : '';

  return `
    <div class="task-row ${task.status === 'completed' ? 'completed' : ''}" data-id="${task.id}">
      <button class="task-checkbox" data-id="${task.id}" type="button" aria-label="Toggle complete">
        ${task.status === 'completed' ? '&#10003;' : ''}
      </button>
      <div class="task-main">
        <div class="task-title">${escapeHTML(task.title)}</div>
        <div class="task-meta">
          ${project ? `<span class="tag tag-project">${escapeHTML(project.name)}</span>` : ''}
          <span class="tag tag-priority-${task.priority}">${capitalize(task.priority)}</span>
          ${dueLabel ? `<span class="tag tag-due ${overdue ? 'overdue' : ''}">${overdue ? 'Overdue · ' : ''}${dueLabel}</span>` : ''}
        </div>
      </div>
    </div>`;
}

function escapeHTML(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/* ---------------------------------------------------------
   5. FILTERING + SORTING
--------------------------------------------------------- */

function getVisibleTasks() {
  let list = tasks.slice();

  // Project (sidebar)
  if (state.activeProjectId !== 'all') {
    list = list.filter((t) => t.projectId === state.activeProjectId);
  }

  // View tab
  if (state.activeView === 'today') list = list.filter(isToday);
  if (state.activeView === 'upcoming') list = list.filter(isUpcoming);
  if (state.activeView === 'completed') list = list.filter((t) => t.status === 'completed');
  if (state.activeView === 'overdue') list = list.filter(isOverdue);

  // Priority / status dropdown filters
  if (state.priorityFilter !== 'all') list = list.filter((t) => t.priority === state.priorityFilter);
  if (state.statusFilter !== 'all') list = list.filter((t) => t.status === state.statusFilter);

  // Search
  if (state.searchTerm.trim()) {
    const q = state.searchTerm.trim().toLowerCase();
    list = list.filter((t) =>
      t.title.toLowerCase().includes(q) || (t.description || '').toLowerCase().includes(q)
    );
  }

  // Sort
  const priorityRank = { high: 0, medium: 1, low: 2 };
  list.sort((a, b) => {
    switch (state.sortBy) {
      case 'priority':
        return priorityRank[a.priority] - priorityRank[b.priority];
      case 'created':
        return b.createdAt - a.createdAt;
      case 'az':
        return a.title.localeCompare(b.title);
      case 'due':
      default:
        if (!a.dueDate && !b.dueDate) return 0;
        if (!a.dueDate) return 1;
        if (!b.dueDate) return -1;
        return a.dueDate.localeCompare(b.dueDate);
    }
  });

  return list;
}

function syncViewControlsToState() {
  document.querySelectorAll('.tab').forEach((tab) => {
    tab.classList.toggle('active', tab.dataset.view === state.activeView);
  });
  document.getElementById('statusFilter').value = state.statusFilter;
}

/* ---------------------------------------------------------
   6. MODALS
--------------------------------------------------------- */

// --- Task modal ---
function openTaskModal(taskId) {
  state.editingTaskId = taskId || null;
  const task = taskId ? tasks.find((t) => t.id === taskId) : null;

  document.getElementById('taskModalTitle').textContent = task ? 'Edit task' : 'New task';
  document.getElementById('deleteTaskBtn').style.display = task ? 'inline-flex' : 'none';

  document.getElementById('taskTitle').value = task ? task.title : '';
  document.getElementById('taskDescription').value = task ? task.description : '';
  document.getElementById('taskProject').value = task ? (task.projectId || '') : (state.activeProjectId !== 'all' ? state.activeProjectId : '');
  document.getElementById('taskDueDate').value = task ? task.dueDate : '';
  document.getElementById('taskPriority').value = task ? task.priority : 'medium';
  document.getElementById('taskStatus').value = task ? task.status : 'todo';

  document.getElementById('taskModalBackdrop').classList.add('open');
  document.getElementById('taskTitle').focus();
}
function closeTaskModal() {
  document.getElementById('taskModalBackdrop').classList.remove('open');
  state.editingTaskId = null;
}

function handleTaskFormSubmit(e) {
  e.preventDefault();
  const title = document.getElementById('taskTitle').value.trim();
  if (!title) return;

  const data = {
    title,
    description: document.getElementById('taskDescription').value.trim(),
    projectId: document.getElementById('taskProject').value || null,
    dueDate: document.getElementById('taskDueDate').value || '',
    priority: document.getElementById('taskPriority').value,
    status: document.getElementById('taskStatus').value,
  };

  if (state.editingTaskId) {
    const task = tasks.find((t) => t.id === state.editingTaskId);
    Object.assign(task, data);
    showToast('Task updated');
  } else {
    tasks.push({ id: uid(), createdAt: Date.now(), ...data });
    showToast('Task added');
  }

  saveTasks();
  closeTaskModal();
  renderAll();
}

function toggleComplete(taskId) {
  const task = tasks.find((t) => t.id === taskId);
  task.status = task.status === 'completed' ? 'todo' : 'completed';
  saveTasks();
  renderAll();
  showToast(task.status === 'completed' ? 'Task completed' : 'Task reopened');
}

// --- Confirm modal (reused for deleting a task or a project) ---
function openConfirmModal(message, onConfirm) {
  document.getElementById('confirmMessage').textContent = message;
  document.getElementById('confirmBackdrop').classList.add('open');
  state.pendingDelete = onConfirm;
}
function closeConfirmModal() {
  document.getElementById('confirmBackdrop').classList.remove('open');
  state.pendingDelete = null;
}

// --- Project modal ---
function openProjectModal(projectId) {
  state.editingProjectId = projectId || null;
  const project = projectId ? projectById(projectId) : null;

  document.getElementById('projectModalTitle').textContent = project ? 'Edit project' : 'New project';
  document.getElementById('deleteProjectBtn').style.display = project ? 'inline-flex' : 'none';
  document.getElementById('projectName').value = project ? project.name : '';

  document.getElementById('projectModalBackdrop').classList.add('open');
  document.getElementById('projectName').focus();
}
function closeProjectModal() {
  document.getElementById('projectModalBackdrop').classList.remove('open');
  state.editingProjectId = null;
}

function handleProjectFormSubmit(e) {
  e.preventDefault();
  const name = document.getElementById('projectName').value.trim();
  if (!name) return;

  if (state.editingProjectId) {
    projectById(state.editingProjectId).name = name;
    showToast('Project renamed');
  } else {
    projects.push({ id: uid(), name, createdAt: Date.now() });
    showToast('Project created');
  }

  saveProjects();
  closeProjectModal();
  renderAll();
}

/* ---------------------------------------------------------
   7. EVENT WIRING
--------------------------------------------------------- */
function setupEvents() {
  // New task
  document.getElementById('newTaskBtn').addEventListener('click', () => openTaskModal());
  document.getElementById('closeTaskModal').addEventListener('click', closeTaskModal);
  document.getElementById('cancelTaskBtn').addEventListener('click', closeTaskModal);
  document.getElementById('taskForm').addEventListener('submit', handleTaskFormSubmit);
  document.getElementById('deleteTaskBtn').addEventListener('click', () => {
    const id = state.editingTaskId;
    openConfirmModal('This task will be permanently deleted.', () => {
      tasks = tasks.filter((t) => t.id !== id);
      saveTasks();
      closeTaskModal();
      renderAll();
      showToast('Task deleted');
    });
  });

  // Quick add
  document.getElementById('quickAddInput').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      const input = e.target;
      const title = input.value.trim();
      if (!title) return;
      tasks.push({
        id: uid(),
        title,
        description: '',
        projectId: state.activeProjectId !== 'all' ? state.activeProjectId : null,
        dueDate: '',
        priority: 'medium',
        status: 'todo',
        createdAt: Date.now(),
      });
      saveTasks();
      input.value = '';
      renderAll();
      showToast('Task added');
    }
  });

  // Projects
  document.getElementById('addProjectBtn').addEventListener('click', () => openProjectModal());
  document.getElementById('closeProjectModal').addEventListener('click', closeProjectModal);
  document.getElementById('cancelProjectBtn').addEventListener('click', closeProjectModal);
  document.getElementById('projectForm').addEventListener('submit', handleProjectFormSubmit);
  document.getElementById('deleteProjectBtn').addEventListener('click', () => {
    const id = state.editingProjectId;
    openConfirmModal('The project will be deleted. Its tasks stay, unassigned.', () => {
      projects = projects.filter((p) => p.id !== id);
      tasks.forEach((t) => { if (t.projectId === id) t.projectId = null; });
      saveProjects();
      saveTasks();
      closeProjectModal();
      if (state.activeProjectId === id) state.activeProjectId = 'all';
      renderAll();
      showToast('Project deleted');
    });
  });

  // Confirm modal
  document.getElementById('closeConfirmModal').addEventListener('click', closeConfirmModal);
  document.getElementById('cancelConfirmBtn').addEventListener('click', closeConfirmModal);
  document.getElementById('confirmActionBtn').addEventListener('click', () => {
    if (state.pendingDelete) state.pendingDelete();
    closeConfirmModal();
  });

  // Close modals by clicking the backdrop itself
  document.querySelectorAll('.modal-backdrop').forEach((backdrop) => {
    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) backdrop.classList.remove('open');
    });
  });

  // View tabs
  document.getElementById('viewTabs').addEventListener('click', (e) => {
    const btn = e.target.closest('.tab');
    if (!btn) return;
    state.activeView = btn.dataset.view;
    renderAll();
  });

  // Filters + sort
  document.getElementById('priorityFilter').addEventListener('change', (e) => {
    state.priorityFilter = e.target.value;
    renderTaskList();
  });
  document.getElementById('statusFilter').addEventListener('change', (e) => {
    state.statusFilter = e.target.value;
    renderTaskList();
  });
  document.getElementById('sortSelect').addEventListener('change', (e) => {
    state.sortBy = e.target.value;
    renderTaskList();
  });

  // Search
  document.getElementById('searchInput').addEventListener('input', (e) => {
    state.searchTerm = e.target.value;
    renderTaskList();
  });

  // Theme toggle
  document.getElementById('themeToggle').addEventListener('click', toggleTheme);

  // Mobile sidebar
  document.getElementById('menuBtn').addEventListener('click', () => {
    document.getElementById('sidebar').classList.add('open');
    document.getElementById('sidebarOverlay').classList.add('open');
  });
  document.getElementById('sidebarOverlay').addEventListener('click', () => {
    document.getElementById('sidebar').classList.remove('open');
    document.getElementById('sidebarOverlay').classList.remove('open');
  });

  // Keyboard shortcuts
  document.addEventListener('keydown', (e) => {
    const tag = document.activeElement.tagName;
    const typing = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';

    if (e.key === 'Escape') {
      document.querySelectorAll('.modal-backdrop.open').forEach((m) => m.classList.remove('open'));
      return;
    }
    if (typing) return; // don't hijack shortcuts while the user is typing

    if (e.key === '/') {
      e.preventDefault();
      document.getElementById('searchInput').focus();
    }
    if (e.key === 'n') {
      e.preventDefault();
      document.getElementById('quickAddInput').focus();
    }
  });
}

/* ---------------------------------------------------------
   THEME
--------------------------------------------------------- */
function toggleTheme() {
  const html = document.documentElement;
  const next = html.dataset.theme === 'dark' ? 'light' : 'dark';
  html.dataset.theme = next;
  localStorage.setItem(STORAGE_KEYS.theme, next);
  document.getElementById('themeToggle').innerHTML = next === 'dark' ? '&#9728;' : '&#9789;';
}
function applyStoredTheme() {
  const stored = localStorage.getItem(STORAGE_KEYS.theme);
  const preferred = stored || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  document.documentElement.dataset.theme = preferred;
  document.getElementById('themeToggle').innerHTML = preferred === 'dark' ? '&#9728;' : '&#9789;';
}

/* ---------------------------------------------------------
   8. INIT
--------------------------------------------------------- */
document.addEventListener('DOMContentLoaded', () => {
  applyStoredTheme();
  loadData();
  setupEvents();
  renderAll();
});
