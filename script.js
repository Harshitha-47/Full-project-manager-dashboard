// Storage Manager Class
class StorageManager {
    static save(key, data) {
        localStorage.setItem(key, JSON.stringify(data));
    }

    static load(key) {
        const data = localStorage.getItem(key);
        return data ? JSON.parse(data) : null;
    }

    static remove(key) {
        localStorage.removeItem(key);
    }
}

// Project Class
class Project {
    constructor(id, name, description, status, priority, deadline, createdAt = new Date()) {
        this.id = id;
        this.name = name;
        this.description = description;
        this.status = status;
        this.priority = priority;
        this.deadline = deadline;
        this.createdAt = createdAt;
        this.tasks = [];
    }

    getProgress() {
        if (this.tasks.length === 0) return 0;
        const completed = this.tasks.filter(t => t.status === 'Done').length;
        return Math.round((completed / this.tasks.length) * 100);
    }
}

// Task Class
class Task {
    constructor(id, projectId, name, description, status, priority, dueDate, assignee) {
        this.id = id;
        this.projectId = projectId;
        this.name = name;
        this.description = description;
        this.status = status;
        this.priority = priority;
        this.dueDate = dueDate;
        this.assignee = assignee;
        this.completed = status === 'Done';
        this.createdAt = new Date();
    }

    isOverdue() {
        if (!this.dueDate || this.completed) return false;
        return new Date(this.dueDate) < new Date();
    }
}

// Project Manager Class
class ProjectManager {
    constructor() {
        this.projects = this.loadProjects();
    }

    loadProjects() {
        const data = StorageManager.load('projects');
        return data ? data.map(p => Object.assign(new Project(), p)) : [];
    }

    saveProjects() {
        StorageManager.save('projects', this.projects);
    }

    createProject(name, description, status, priority, deadline) {
        const id = Date.now().toString();
        const project = new Project(id, name, description, status, priority, deadline);
        this.projects.push(project);
        this.saveProjects();
        return project;
    }

    updateProject(id, data) {
        const project = this.projects.find(p => p.id === id);
        if (project) {
            Object.assign(project, data);
            this.saveProjects();
        }
        return project;
    }

    deleteProject(id) {
        this.projects = this.projects.filter(p => p.id !== id);
        this.saveProjects();
    }

    getProject(id) {
        return this.projects.find(p => p.id === id);
    }

    getAllProjects() {
        return this.projects;
    }

    getStats() {
        const total = this.projects.length;
        const active = this.projects.filter(p => p.status === 'Active').length;
        const completed = this.projects.filter(p => p.status === 'Completed').length;
        const onHold = this.projects.filter(p => p.status === 'On Hold').length;
        
        return { total, active, completed, onHold };
    }
}

// Task Manager Class
class TaskManager {
    constructor(projectManager) {
        this.projectManager = projectManager;
    }

    createTask(projectId, name, description, status, priority, dueDate, assignee) {
        const id = Date.now().toString();
        const task = new Task(id, projectId, name, description, status, priority, dueDate, assignee);
        const project = this.projectManager.getProject(projectId);
        if (project) {
            project.tasks.push(task);
            this.projectManager.saveProjects();
        }
        return task;
    }

    updateTask(projectId, taskId, data) {
        const project = this.projectManager.getProject(projectId);
        if (project) {
            const task = project.tasks.find(t => t.id === taskId);
            if (task) {
                Object.assign(task, data);
                task.completed = data.status === 'Done';
                this.projectManager.saveProjects();
                return task;
            }
        }
        return null;
    }

    deleteTask(projectId, taskId) {
        const project = this.projectManager.getProject(projectId);
        if (project) {
            project.tasks = project.tasks.filter(t => t.id !== taskId);
            this.projectManager.saveProjects();
        }
    }

    getTask(projectId, taskId) {
        const project = this.projectManager.getProject(projectId);
        return project ? project.tasks.find(t => t.id === taskId) : null;
    }

    getAllTasks() {
        return this.projectManager.projects.flatMap(p => 
            p.tasks.map(t => ({ ...t, projectName: p.name }))
        );
    }

    getTasksByStatus(status) {
        return this.getAllTasks().filter(t => t.status === status);
    }

    getOverdueTasks() {
        return this.getAllTasks().filter(t => {
            if (!t.dueDate || t.completed) return false;
            return new Date(t.dueDate) < new Date();
        });
    }

    getPendingTasks() {
        return this.getAllTasks().filter(t => !t.completed);
    }

    getStats() {
        const allTasks = this.getAllTasks();
        const pending = allTasks.filter(t => !t.completed).length;
        const overdue = this.getOverdueTasks().length;
        const completed = allTasks.filter(t => t.completed).length;
        const toDo = allTasks.filter(t => t.status === 'To Do').length;
        const inProgress = allTasks.filter(t => t.status === 'In Progress').length;
        
        return { pending, overdue, completed, toDo, inProgress, total: allTasks.length };
    }
}

// Kanban Manager Class
class KanbanManager {
    constructor(taskManager) {
        this.taskManager = taskManager;
        this.draggedTask = null;
    }

    setupDragAndDrop() {
        document.addEventListener('dragstart', (e) => {
            if (e.target.classList.contains('task-card')) {
                e.target.classList.add('dragging');
                this.draggedTask = {
                    projectId: e.target.dataset.projectId,
                    taskId: e.target.dataset.taskId
                };
            }
        });

        document.addEventListener('dragend', (e) => {
            if (e.target.classList.contains('task-card')) {
                e.target.classList.remove('dragging');
                this.draggedTask = null;
            }
        });

        document.addEventListener('dragover', (e) => {
            e.preventDefault();
            const column = e.target.closest('.kanban-tasks');
            if (column) {
                column.classList.add('drag-over');
            }
        });

        document.addEventListener('dragleave', (e) => {
            const column = e.target.closest('.kanban-tasks');
            if (column && !column.contains(e.relatedTarget)) {
                column.classList.remove('drag-over');
            }
        });

        document.addEventListener('drop', (e) => {
            e.preventDefault();
            const column = e.target.closest('.kanban-tasks');
            if (column && this.draggedTask) {
                column.classList.remove('drag-over');
                const newStatus = column.dataset.status;
                this.taskManager.updateTask(
                    this.draggedTask.projectId,
                    this.draggedTask.taskId,
                    { status: newStatus }
                );
                uiController.renderKanbanBoard();
                showToast('Task status updated', 'success');
            }
        });
    }
}

// Calendar Manager Class
class CalendarManager {
    constructor(taskManager) {
        this.taskManager = taskManager;
        this.currentDate = new Date();
    }

    getMonthData(year, month) {
        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);
        const prevLastDay = new Date(year, month, 0);
        
        const firstDayOfWeek = firstDay.getDay();
        const daysInMonth = lastDay.getDate();
        const daysInPrevMonth = prevLastDay.getDate();
        
        const days = [];
        
        // Previous month days
        for (let i = firstDayOfWeek - 1; i >= 0; i--) {
            days.push({
                day: daysInPrevMonth - i,
                month: month - 1,
                year: month === 0 ? year - 1 : year,
                isCurrentMonth: false
            });
        }
        
        // Current month days
        for (let i = 1; i <= daysInMonth; i++) {
            days.push({
                day: i,
                month: month,
                year: year,
                isCurrentMonth: true
            });
        }
        
        // Next month days
        const remainingDays = 42 - days.length;
        for (let i = 1; i <= remainingDays; i++) {
            days.push({
                day: i,
                month: month + 1,
                year: month === 11 ? year + 1 : year,
                isCurrentMonth: false
            });
        }
        
        return days;
    }

    getTasksForDate(date) {
        const allTasks = this.taskManager.getAllTasks();
        return allTasks.filter(task => {
            if (!task.dueDate) return false;
            const taskDate = new Date(task.dueDate);
            return taskDate.toDateString() === date.toDateString();
        });
    }

    nextMonth() {
        this.currentDate.setMonth(this.currentDate.getMonth() + 1);
    }

    prevMonth() {
        this.currentDate.setMonth(this.currentDate.getMonth() - 1);
    }

    getCurrentMonth() {
        return this.currentDate.getMonth();
    }

    getCurrentYear() {
        return this.currentDate.getFullYear();
    }
}

// UI Controller Class
class UIController {
    constructor(projectManager, taskManager, kanbanManager, calendarManager) {
        this.projectManager = projectManager;
        this.taskManager = taskManager;
        this.kanbanManager = kanbanManager;
        this.calendarManager = calendarManager;
        this.currentPage = 'dashboard';
        this.currentProjectId = null;
        this.searchQuery = '';
        this.projectFilter = 'all';
    }

    init() {
        this.setupEventListeners();
        this.renderPage('dashboard');
        this.updateNotifications();
    }

    setupEventListeners() {
        // Navigation
        document.querySelectorAll('.nav-item').forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                const page = item.dataset.page;
                this.renderPage(page);
                document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
                item.classList.add('active');
            });
        });

        // Sidebar toggle
        document.getElementById('sidebarToggle').addEventListener('click', () => {
            document.getElementById('sidebar').classList.toggle('collapsed');
            document.querySelector('.main-container').classList.toggle('expanded');
        });

        // Theme toggle
        document.getElementById('themeToggle').addEventListener('click', () => {
            const html = document.documentElement;
            const currentTheme = html.getAttribute('data-theme') || 'light';
            const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
            html.setAttribute('data-theme', newTheme);
            localStorage.setItem('theme', newTheme);
            const icon = document.querySelector('#themeToggle i');
            icon.className = newTheme === 'dark' ? 'fas fa-sun' : 'fas fa-moon';
        });

        // Load saved theme
        const savedTheme = localStorage.getItem('theme');
        if (savedTheme) {
            document.documentElement.setAttribute('data-theme', savedTheme);
            const icon = document.querySelector('#themeToggle i');
            icon.className = savedTheme === 'dark' ? 'fas fa-sun' : 'fas fa-moon';
        }

        // Search
        document.getElementById('searchInput').addEventListener('input', (e) => {
            this.searchQuery = e.target.value.toLowerCase();
            this.renderPage(this.currentPage);
        });

        // Project form
        document.getElementById('projectForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleProjectSubmit();
        });

        // Task form
        document.getElementById('taskForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleTaskSubmit();
        });
    }

    renderPage(page) {
        this.currentPage = page;
        const content = document.getElementById('content');
        const skeleton = content.querySelector('.skeleton-loader');
        
        if (skeleton) skeleton.classList.add('show');
        
        setTimeout(() => {
            switch(page) {
                case 'dashboard':
                    content.innerHTML = this.renderDashboard();
                    this.initCharts();
                    break;
                case 'projects':
                    content.innerHTML = this.renderProjects();
                    break;
                case 'tasks':
                    content.innerHTML = this.renderTasks();
                    break;
                case 'kanban':
                    content.innerHTML = this.renderKanban();
                    this.kanbanManager.setupDragAndDrop();
                    break;
                case 'calendar':
                    content.innerHTML = this.renderCalendar();
                    this.setupCalendarEvents();
                    break;
                case 'settings':
                    content.innerHTML = this.renderSettings();
                    break;
            }
        }, 300);
    }

    renderDashboard() {
        const projectStats = this.projectManager.getStats();
        const taskStats = this.taskManager.getStats();
        
        return `
            <div class="page-header">
                <h1>Dashboard Overview</h1>
            </div>
            
            <div class="stats-grid">
                <div class="stat-card">
                    <div class="stat-card-header">
                        <span class="stat-card-title">Total Projects</span>
                        <div class="stat-card-icon" style="background: #e0e7ff; color: #667eea;">
                            <i class="fas fa-folder"></i>
                        </div>
                    </div>
                    <div class="stat-card-value" data-target="${projectStats.total}">0</div>
                    <div class="stat-card-change positive">
                        <i class="fas fa-arrow-up"></i>
                        <span>All projects</span>
                    </div>
                </div>
                
                <div class="stat-card">
                    <div class="stat-card-header">
                        <span class="stat-card-title">Active Projects</span>
                        <div class="stat-card-icon" style="background: #dcfce7; color: #10b981;">
                            <i class="fas fa-rocket"></i>
                        </div>
                    </div>
                    <div class="stat-card-value" data-target="${projectStats.active}">0</div>
                    <div class="stat-card-change positive">
                        <i class="fas fa-check"></i>
                        <span>In progress</span>
                    </div>
                </div>
                
                <div class="stat-card">
                    <div class="stat-card-header">
                        <span class="stat-card-title">Completed Projects</span>
                        <div class="stat-card-icon" style="background: #dbeafe; color: #3b82f6;">
                            <i class="fas fa-check-circle"></i>
                        </div>
                    </div>
                    <div class="stat-card-value" data-target="${projectStats.completed}">0</div>
                    <div class="stat-card-change positive">
                        <i class="fas fa-trophy"></i>
                        <span>Finished</span>
                    </div>
                </div>
                
                <div class="stat-card">
                    <div class="stat-card-header">
                        <span class="stat-card-title">Pending Tasks</span>
                        <div class="stat-card-icon" style="background: #fef3c7; color: #f59e0b;">
                            <i class="fas fa-clock"></i>
                        </div>
                    </div>
                    <div class="stat-card-value" data-target="${taskStats.pending}">0</div>
                    <div class="stat-card-change">
                        <i class="fas fa-tasks"></i>
                        <span>To complete</span>
                    </div>
                </div>
                
                <div class="stat-card">
                    <div class="stat-card-header">
                        <span class="stat-card-title">Overdue Tasks</span>
                        <div class="stat-card-icon" style="background: #fee2e2; color: #ef4444;">
                            <i class="fas fa-exclamation-triangle"></i>
                        </div>
                    </div>
                    <div class="stat-card-value" data-target="${taskStats.overdue}">0</div>
                    <div class="stat-card-change negative">
                        <i class="fas fa-arrow-down"></i>
                        <span>Need attention</span>
                    </div>
                </div>
            </div>
            
            <div class="charts-grid">
                <div class="chart-card">
                    <h3>Task Distribution</h3>
                    <canvas id="taskChart"></canvas>
                </div>
                <div class="chart-card">
                    <h3>Project Status</h3>
                    <canvas id="projectChart"></canvas>
                </div>
            </div>
        `;
    }

    renderProjects() {
        let projects = this.projectManager.getAllProjects();
        
        if (this.projectFilter !== 'all') {
            projects = projects.filter(p => p.status === this.projectFilter);
        }
        
        if (this.searchQuery) {
            projects = projects.filter(p => 
                p.name.toLowerCase().includes(this.searchQuery) ||
                p.description.toLowerCase().includes(this.searchQuery)
            );
        }
        
        const projectCards = projects.map(project => `
            <div class="project-card" onclick="uiController.viewProjectDetails('${project.id}')">
                <div class="project-card-header">
                    <div>
                        <div class="project-card-title">${project.name}</div>
                    </div>
                    <div class="project-card-actions">
                        <button class="icon-btn" onclick="event.stopPropagation(); uiController.editProject('${project.id}')">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="icon-btn" onclick="event.stopPropagation(); uiController.deleteProject('${project.id}')">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
                <div class="project-card-description">${project.description || 'No description'}</div>
                <div class="project-card-meta">
                    <span class="badge-status ${project.status.toLowerCase().replace(' ', '-')}">${project.status}</span>
                    <span class="badge-priority ${project.priority.toLowerCase()}">${project.priority}</span>
                    ${project.deadline ? `<span><i class="fas fa-calendar"></i> ${new Date(project.deadline).toLocaleDateString()}</span>` : ''}
                </div>
                <div class="project-card-footer">
                    <div class="project-progress">
                        <div class="progress-label">${project.getProgress()}% Complete</div>
                        <div class="progress-bar">
                            <div class="progress-fill" style="width: ${project.getProgress()}%"></div>
                        </div>
                    </div>
                    <span>${project.tasks.length} tasks</span>
                </div>
            </div>
        `).join('');
        
        const html = `
            <div class="page-header">
                <h1>Projects</h1>
                <div style="display: flex; gap: 12px;">
                    <select id="projectFilter" class="filter-select" onchange="uiController.filterProjects(this.value)">
                        <option value="all" ${this.projectFilter === 'all' ? 'selected' : ''}>All Projects</option>
                        <option value="Active" ${this.projectFilter === 'Active' ? 'selected' : ''}>Active</option>
                        <option value="Completed" ${this.projectFilter === 'Completed' ? 'selected' : ''}>Completed</option>
                        <option value="On Hold" ${this.projectFilter === 'On Hold' ? 'selected' : ''}>On Hold</option>
                    </select>
                    <button class="btn btn-primary" onclick="uiController.openProjectModal()">
                        <i class="fas fa-plus"></i> New Project
                    </button>
                </div>
            </div>
            <div class="projects-grid">
                ${projectCards || '<p>No projects found. Create your first project!</p>'}
            </div>
        `;
        
        return html;
    }

    renderTasks() {
        let tasks = this.taskManager.getAllTasks();
        
        if (this.searchQuery) {
            tasks = tasks.filter(t => 
                t.name.toLowerCase().includes(this.searchQuery) ||
                t.description.toLowerCase().includes(this.searchQuery)
            );
        }
        
        const taskItems = tasks.map(task => `
            <div class="task-list-item">
                <input type="checkbox" class="task-checkbox" ${task.completed ? 'checked' : ''} 
                    onchange="uiController.toggleTaskComplete('${task.projectId}', '${task.id}', this.checked)">
                <div class="task-list-content">
                    <div class="task-card-header">
                        <div class="task-card-title">${task.name}</div>
                        <div class="project-card-actions">
                            <button class="icon-btn" onclick="uiController.editTask('${task.projectId}', '${task.id}')">
                                <i class="fas fa-edit"></i>
                            </button>
                            <button class="icon-btn" onclick="uiController.deleteTask('${task.projectId}', '${task.id}')">
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>
                    </div>
                    ${task.description ? `<div class="task-card-description">${task.description}</div>` : ''}
                    <div class="task-card-meta">
                        <span class="badge-status ${task.status.toLowerCase().replace(' ', '-')}">${task.status}</span>
                        <span class="badge-priority ${task.priority.toLowerCase()}">${task.priority}</span>
                        <span><i class="fas fa-folder"></i> ${task.projectName}</span>
                        ${task.assignee ? `<span><i class="fas fa-user"></i> ${task.assignee}</span>` : ''}
                        ${task.dueDate ? `<span class="${task.isOverdue() ? 'task-due-date overdue' : 'task-due-date'}">
                            <i class="fas fa-calendar"></i> ${new Date(task.dueDate).toLocaleDateString()}
                        </span>` : ''}
                    </div>
                </div>
            </div>
        `).join('');
        
        return `
            <div class="page-header">
                <h1>All Tasks</h1>
            </div>
            <div class="task-list">
                ${taskItems || '<p>No tasks found.</p>'}
            </div>
        `;
    }

    renderKanban() {
        const todoTasks = this.taskManager.getTasksByStatus('To Do');
        const inProgressTasks = this.taskManager.getTasksByStatus('In Progress');
        const doneTasks = this.taskManager.getTasksByStatus('Done');
        
        const renderTaskCard = (task) => `
            <div class="task-card" draggable="true" data-project-id="${task.projectId}" data-task-id="${task.id}">
                <div class="task-card-header">
                    <div class="task-card-title">${task.name}</div>
                    <div class="project-card-actions">
                        <button class="icon-btn" onclick="uiController.editTask('${task.projectId}', '${task.id}')">
                            <i class="fas fa-edit"></i>
                        </button>
                    </div>
                </div>
                ${task.description ? `<div class="task-card-description">${task.description}</div>` : ''}
                <div class="task-card-meta">
                    <span class="badge-priority ${task.priority.toLowerCase()}">${task.priority}</span>
                </div>
                <div class="task-card-footer">
                    ${task.assignee ? `<div class="task-assignee"><i class="fas fa-user"></i> ${task.assignee}</div>` : '<div></div>'}
                    ${task.dueDate ? `<div class="task-due-date ${task.isOverdue() ? 'overdue' : ''}">
                        <i class="fas fa-calendar"></i> ${new Date(task.dueDate).toLocaleDateString()}
                    </div>` : ''}
                </div>
            </div>
        `;
        
        return `
            <div class="page-header">
                <h1>Kanban Board</h1>
            </div>
            <div class="kanban-board">
                <div class="kanban-column">
                    <div class="kanban-header">
                        <div class="kanban-title">
                            <i class="fas fa-circle" style="color: #f59e0b;"></i>
                            To Do
                            <span class="kanban-count">${todoTasks.length}</span>
                        </div>
                    </div>
                    <div class="kanban-tasks" data-status="To Do">
                        ${todoTasks.map(renderTaskCard).join('')}
                    </div>
                </div>
                
                <div class="kanban-column">
                    <div class="kanban-header">
                        <div class="kanban-title">
                            <i class="fas fa-circle" style="color: #3b82f6;"></i>
                            In Progress
                            <span class="kanban-count">${inProgressTasks.length}</span>
                        </div>
                    </div>
                    <div class="kanban-tasks" data-status="In Progress">
                        ${inProgressTasks.map(renderTaskCard).join('')}
                    </div>
                </div>
                
                <div class="kanban-column">
                    <div class="kanban-header">
                        <div class="kanban-title">
                            <i class="fas fa-circle" style="color: #10b981;"></i>
                            Done
                            <span class="kanban-count">${doneTasks.length}</span>
                        </div>
                    </div>
                    <div class="kanban-tasks" data-status="Done">
                        ${doneTasks.map(renderTaskCard).join('')}
                    </div>
                </div>
            </div>
        `;
    }

    renderKanbanBoard() {
        if (this.currentPage === 'kanban') {
            this.renderPage('kanban');
        }
    }

    renderCalendar() {
        const month = this.calendarManager.getCurrentMonth();
        const year = this.calendarManager.getCurrentYear();
        const days = this.calendarManager.getMonthData(year, month);
        const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 
                           'July', 'August', 'September', 'October', 'November', 'December'];
        
        const dayHeaders = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        
        const today = new Date();
        
        return `
            <div class="page-header">
                <h1>Calendar</h1>
            </div>
            <div class="calendar-container">
                <div class="calendar-header">
                    <h2>${monthNames[month]} ${year}</h2>
                    <div class="calendar-nav">
                        <button class="btn btn-secondary" onclick="uiController.prevMonth()">
                            <i class="fas fa-chevron-left"></i>
                        </button>
                        <button class="btn btn-secondary" onclick="uiController.todayMonth()">Today</button>
                        <button class="btn btn-secondary" onclick="uiController.nextMonth()">
                            <i class="fas fa-chevron-right"></i>
                        </button>
                    </div>
                </div>
                <div class="calendar-grid">
                    ${dayHeaders.map(day => `<div class="calendar-day-header">${day}</div>`).join('')}
                    ${days.map(day => {
                        const date = new Date(day.year, day.month, day.day);
                        const tasks = this.calendarManager.getTasksForDate(date);
                        const isToday = date.toDateString() === today.toDateString();
                        
                        return `
                            <div class="calendar-day ${!day.isCurrentMonth ? 'other-month' : ''} ${isToday ? 'today' : ''}"
                                 onclick="uiController.showDayTasks('${date.toISOString()}')">
                                <div class="calendar-day-number">${day.day}</div>
                                <div class="calendar-day-tasks">
                                    ${tasks.slice(0, 3).map(() => '<div class="calendar-task-dot"></div>').join('')}
                                </div>
                            </div>
                        `;
                    }).join('')}
                </div>
            </div>
        `;
    }

    renderSettings() {
        return `
            <div class="page-header">
                <h1>Settings</h1>
            </div>
            <div class="chart-card">
                <h3>Application Settings</h3>
                <p>Theme: Use the toggle in the navbar to switch between light and dark mode.</p>
                <br>
                <h3>Data Management</h3>
                <button class="btn btn-primary" onclick="uiController.exportData()">
                    <i class="fas fa-download"></i> Export Data
                </button>
                <button class="btn btn-secondary" onclick="uiController.importData()">
                    <i class="fas fa-upload"></i> Import Data
                </button>
                <button class="btn btn-danger" onclick="uiController.clearAllData()">
                    <i class="fas fa-trash"></i> Clear All Data
                </button>
            </div>
        `;
    }

    // Project Actions
    openProjectModal(projectId = null) {
        const modal = document.getElementById('projectModal');
        const form = document.getElementById('projectForm');
        const title = document.getElementById('projectModalTitle');
        
        form.reset();
        
        if (projectId) {
            const project = this.projectManager.getProject(projectId);
            title.textContent = 'Edit Project';
            document.getElementById('projectId').value = project.id;
            document.getElementById('projectName').value = project.name;
            document.getElementById('projectDescription').value = project.description;
            document.getElementById('projectStatus').value = project.status;
            document.getElementById('projectPriority').value = project.priority;
            document.getElementById('projectDeadline').value = project.deadline;
        } else {
            title.textContent = 'Create New Project';
        }
        
        modal.classList.add('active');
    }

    handleProjectSubmit() {
        if (!validateForm('projectForm')) return;
        
        const id = document.getElementById('projectId').value;
        const name = document.getElementById('projectName').value;
        const description = document.getElementById('projectDescription').value;
        const status = document.getElementById('projectStatus').value;
        const priority = document.getElementById('projectPriority').value;
        const deadline = document.getElementById('projectDeadline').value;
        
        if (id) {
            this.projectManager.updateProject(id, { name, description, status, priority, deadline });
            showToast('Project updated successfully', 'success');
        } else {
            this.projectManager.createProject(name, description, status, priority, deadline);
            showToast('Project created successfully', 'success');
        }
        
        autoSave();
        closeModal('projectModal');
        this.renderPage(this.currentPage);
        this.updateNotifications();
    }

    editProject(id) {
        this.openProjectModal(id);
    }

    deleteProject(id) {
        showConfirm('Are you sure you want to delete this project? All tasks will be lost.', () => {
            this.projectManager.deleteProject(id);
            showToast('Project deleted', 'success');
            this.renderPage(this.currentPage);
            this.updateNotifications();
        });
    }

    viewProjectDetails(id) {
        this.currentProjectId = id;
        const project = this.projectManager.getProject(id);
        const content = document.getElementById('content');
        
        const taskCards = project.tasks.map(task => `
            <div class="task-list-item">
                <input type="checkbox" class="task-checkbox" ${task.completed ? 'checked' : ''} 
                    onchange="uiController.toggleTaskComplete('${task.projectId}', '${task.id}', this.checked)">
                <div class="task-list-content">
                    <div class="task-card-header">
                        <div class="task-card-title">${task.name}</div>
                        <div class="project-card-actions">
                            <button class="icon-btn" onclick="uiController.editTask('${task.projectId}', '${task.id}')">
                                <i class="fas fa-edit"></i>
                            </button>
                            <button class="icon-btn" onclick="uiController.deleteTask('${task.projectId}', '${task.id}')">
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>
                    </div>
                    ${task.description ? `<div class="task-card-description">${task.description}</div>` : ''}
                    <div class="task-card-meta">
                        <span class="badge-status ${task.status.toLowerCase().replace(' ', '-')}">${task.status}</span>
                        <span class="badge-priority ${task.priority.toLowerCase()}">${task.priority}</span>
                        ${task.assignee ? `<span><i class="fas fa-user"></i> ${task.assignee}</span>` : ''}
                        ${task.dueDate ? `<span class="${task.isOverdue() ? 'task-due-date overdue' : 'task-due-date'}">
                            <i class="fas fa-calendar"></i> ${new Date(task.dueDate).toLocaleDateString()}
                        </span>` : ''}
                    </div>
                </div>
            </div>
        `).join('');
        
        content.innerHTML = `
            <div class="page-header">
                <div>
                    <button class="btn btn-secondary" onclick="uiController.renderPage('projects')">
                        <i class="fas fa-arrow-left"></i> Back
                    </button>
                    <h1 style="margin-top: 16px;">${project.name}</h1>
                    <p style="color: var(--text-secondary);">${project.description || 'No description'}</p>
                </div>
                <button class="btn btn-primary" onclick="uiController.openTaskModal('${project.id}')">
                    <i class="fas fa-plus"></i> New Task
                </button>
            </div>
            
            <div class="stats-grid" style="margin-bottom: 24px;">
                <div class="stat-card">
                    <div class="stat-card-header">
                        <span class="stat-card-title">Total Tasks</span>
                        <div class="stat-card-icon" style="background: #e0e7ff; color: #667eea;">
                            <i class="fas fa-tasks"></i>
                        </div>
                    </div>
                    <div class="stat-card-value">${project.tasks.length}</div>
                </div>
                <div class="stat-card">
                    <div class="stat-card-header">
                        <span class="stat-card-title">Completed</span>
                        <div class="stat-card-icon" style="background: #dcfce7; color: #10b981;">
                            <i class="fas fa-check"></i>
                        </div>
                    </div>
                    <div class="stat-card-value">${project.tasks.filter(t => t.completed).length}</div>
                </div>
                <div class="stat-card">
                    <div class="stat-card-header">
                        <span class="stat-card-title">Progress</span>
                        <div class="stat-card-icon" style="background: #dbeafe; color: #3b82f6;">
                            <i class="fas fa-chart-line"></i>
                        </div>
                    </div>
                    <div class="stat-card-value">${project.getProgress()}%</div>
                </div>
            </div>
            
            <div class="task-list">
                ${taskCards || '<p>No tasks yet. Create your first task!</p>'}
            </div>
        `;
    }

    // Task Actions
    openTaskModal(projectId, taskId = null) {
        const modal = document.getElementById('taskModal');
        const form = document.getElementById('taskForm');
        const title = document.getElementById('taskModalTitle');
        
        form.reset();
        document.getElementById('taskProjectId').value = projectId;
        
        if (taskId) {
            const task = this.taskManager.getTask(projectId, taskId);
            title.textContent = 'Edit Task';
            document.getElementById('taskId').value = task.id;
            document.getElementById('taskName').value = task.name;
            document.getElementById('taskDescription').value = task.description;
            document.getElementById('taskStatus').value = task.status;
            document.getElementById('taskPriority').value = task.priority;
            document.getElementById('taskDueDate').value = task.dueDate;
            document.getElementById('taskAssignee').value = task.assignee;
        } else {
            title.textContent = 'Create New Task';
        }
        
        modal.classList.add('active');
    }

    handleTaskSubmit() {
        if (!validateForm('taskForm')) return;
        
        const projectId = document.getElementById('taskProjectId').value;
        const taskId = document.getElementById('taskId').value;
        const name = document.getElementById('taskName').value;
        const description = document.getElementById('taskDescription').value;
        const status = document.getElementById('taskStatus').value;
        const priority = document.getElementById('taskPriority').value;
        const dueDate = document.getElementById('taskDueDate').value;
        const assignee = document.getElementById('taskAssignee').value;
        
        if (taskId) {
            this.taskManager.updateTask(projectId, taskId, { name, description, status, priority, dueDate, assignee });
            showToast('Task updated successfully', 'success');
        } else {
            this.taskManager.createTask(projectId, name, description, status, priority, dueDate, assignee);
            showToast('Task created successfully', 'success');
        }
        
        autoSave();
        closeModal('taskModal');
        this.renderPage(this.currentPage);
        this.updateNotifications();
    }

    editTask(projectId, taskId) {
        this.openTaskModal(projectId, taskId);
    }

    deleteTask(projectId, taskId) {
        showConfirm('Are you sure you want to delete this task?', () => {
            this.taskManager.deleteTask(projectId, taskId);
            showToast('Task deleted', 'success');
            this.renderPage(this.currentPage);
            this.updateNotifications();
        });
    }

    toggleTaskComplete(projectId, taskId, completed) {
        const status = completed ? 'Done' : 'To Do';
        this.taskManager.updateTask(projectId, taskId, { status, completed });
        this.renderPage(this.currentPage);
        this.updateNotifications();
    }

    // Calendar Actions
    nextMonth() {
        this.calendarManager.nextMonth();
        this.renderPage('calendar');
    }

    prevMonth() {
        this.calendarManager.prevMonth();
        this.renderPage('calendar');
    }

    todayMonth() {
        this.calendarManager.currentDate = new Date();
        this.renderPage('calendar');
    }

    showDayTasks(dateStr) {
        const date = new Date(dateStr);
        const tasks = this.calendarManager.getTasksForDate(date);
        
        if (tasks.length === 0) {
            showToast('No tasks for this date', 'info');
            return;
        }
        
        const taskList = tasks.map(t => `<li>${t.name} - ${t.projectName}</li>`).join('');
        showConfirm(`<strong>Tasks for ${date.toLocaleDateString()}:</strong><ul style="margin-top: 12px; text-align: left;">${taskList}</ul>`, null, true);
    }

    // Charts
    initCharts() {
        setTimeout(() => {
            this.animateCounters();
            this.renderTaskChart();
            this.renderProjectChart();
        }, 100);
    }

    animateCounters() {
        document.querySelectorAll('.stat-card-value').forEach(counter => {
            const target = parseInt(counter.dataset.target);
            const duration = 1000;
            const step = target / (duration / 16);
            let current = 0;
            
            const timer = setInterval(() => {
                current += step;
                if (current >= target) {
                    counter.textContent = target;
                    clearInterval(timer);
                } else {
                    counter.textContent = Math.floor(current);
                }
            }, 16);
        });
    }

    renderTaskChart() {
        const canvas = document.getElementById('taskChart');
        if (!canvas) return;
        
        const stats = this.taskManager.getStats();
        
        new Chart(canvas, {
            type: 'doughnut',
            data: {
                labels: ['To Do', 'In Progress', 'Done'],
                datasets: [{
                    data: [stats.toDo, stats.inProgress, stats.completed],
                    backgroundColor: ['#f59e0b', '#3b82f6', '#10b981']
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                plugins: {
                    legend: {
                        position: 'bottom'
                    }
                }
            }
        });
    }

    renderProjectChart() {
        const canvas = document.getElementById('projectChart');
        if (!canvas) return;
        
        const stats = this.projectManager.getStats();
        
        new Chart(canvas, {
            type: 'bar',
            data: {
                labels: ['Active', 'Completed', 'On Hold'],
                datasets: [{
                    label: 'Projects',
                    data: [stats.active, stats.completed, stats.onHold],
                    backgroundColor: ['#10b981', '#3b82f6', '#f59e0b']
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                plugins: {
                    legend: {
                        display: false
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            stepSize: 1
                        }
                    }
                }
            }
        });
    }

    // Notifications
    updateNotifications() {
        const overdueTasks = this.taskManager.getOverdueTasks().length;
        document.getElementById('notificationBadge').textContent = overdueTasks;
    }

    // Data Management
    exportData() {
        const data = {
            projects: this.projectManager.getAllProjects(),
            exportDate: new Date().toISOString()
        };
        
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `project-data-${Date.now()}.json`;
        a.click();
        URL.revokeObjectURL(url);
        
        showToast('Data exported successfully', 'success');
    }

    importData() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'application/json';
        
        input.onchange = (e) => {
            const file = e.target.files[0];
            const reader = new FileReader();
            
            reader.onload = (event) => {
                try {
                    const data = JSON.parse(event.target.result);
                    StorageManager.save('projects', data.projects);
                    this.projectManager.projects = this.projectManager.loadProjects();
                    this.renderPage(this.currentPage);
                    showToast('Data imported successfully', 'success');
                } catch (error) {
                    showToast('Invalid file format', 'error');
                }
            };
            
            reader.readAsText(file);
        };
        
        input.click();
    }

    clearAllData() {
        showConfirm('Are you sure you want to clear all data? This cannot be undone.', () => {
            StorageManager.remove('projects');
            this.projectManager.projects = [];
            this.renderPage(this.currentPage);
            showToast('All data cleared', 'success');
        });
    }

    setupCalendarEvents() {
        // Additional calendar event setup if needed
    }
    
    filterProjects(status) {
        this.projectFilter = status;
        this.renderPage('projects');
    }
}

// Utility Functions
function closeModal(modalId) {
    document.getElementById(modalId).classList.remove('active');
}

function showToast(message, type = 'info') {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = `toast ${type} show`;
    
    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

function showConfirm(message, callback, infoOnly = false) {
    const modal = document.getElementById('confirmModal');
    const messageEl = document.getElementById('confirmMessage');
    const confirmBtn = document.getElementById('confirmBtn');
    
    messageEl.innerHTML = message;
    modal.classList.add('active');
    
    if (infoOnly) {
        confirmBtn.style.display = 'none';
    } else {
        confirmBtn.style.display = 'inline-flex';
        confirmBtn.onclick = () => {
            if (callback) callback();
            closeModal('confirmModal');
        };
    }
}

// Login functionality
const users = [
    { username: 'admin', password: 'admin123', name: 'Admin User' },
    { username: 'demo', password: 'demo123', name: 'Demo User' }
];

const handleLogin = (e) => {
    e.preventDefault();
    const username = document.getElementById('loginUsername').value;
    const password = document.getElementById('loginPassword').value;
    
    const user = users.find(u => u.username === username && u.password === password);
    
    if (user) {
        localStorage.setItem('currentUser', JSON.stringify(user));
        document.getElementById('loginScreen').style.display = 'none';
        document.getElementById('appContainer').style.display = 'block';
        document.getElementById('userName').textContent = user.name;
        showToast('Login successful!', 'success');
    } else {
        showToast('Invalid credentials', 'error');
    }
};

const handleLogout = () => {
    localStorage.removeItem('currentUser');
    document.getElementById('loginScreen').style.display = 'flex';
    document.getElementById('appContainer').style.display = 'none';
    document.getElementById('loginForm').reset();
    showToast('Logged out successfully', 'success');
};

const checkAuth = () => {
    const user = JSON.parse(localStorage.getItem('currentUser'));
    if (user) {
        document.getElementById('loginScreen').style.display = 'none';
        document.getElementById('appContainer').style.display = 'block';
        document.getElementById('userName').textContent = user.name;
    }
};

// Initialize Application
const projectManager = new ProjectManager();
const taskManager = new TaskManager(projectManager);
const kanbanManager = new KanbanManager(taskManager);
const calendarManager = new CalendarManager(taskManager);
const uiController = new UIController(projectManager, taskManager, kanbanManager, calendarManager);

// Auto-save functionality
let autoSaveTimer;
const autoSave = () => {
    clearTimeout(autoSaveTimer);
    autoSaveTimer = setTimeout(() => {
        projectManager.saveProjects();
    }, 1000);
};

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.key === 'k') {
        e.preventDefault();
        document.getElementById('searchInput').focus();
    }
    if (e.ctrlKey && e.key === 'n') {
        e.preventDefault();
        uiController.openProjectModal();
    }
    if (e.key === 'Escape') {
        document.querySelectorAll('.modal.active').forEach(m => m.classList.remove('active'));
        document.getElementById('shortcutsHelp').classList.remove('show');
    }
    if (e.key === '?') {
        document.getElementById('shortcutsHelp').classList.toggle('show');
    }
    if (e.altKey && e.key >= '1' && e.key <= '6') {
        e.preventDefault();
        const pages = ['dashboard', 'projects', 'tasks', 'kanban', 'calendar', 'settings'];
        const page = pages[parseInt(e.key) - 1];
        uiController.renderPage(page);
        document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
        document.querySelector(`[data-page="${page}"]`).classList.add('active');
    }
});

// Theme management
const initTheme = () => {
    const saved = localStorage.getItem('theme') || 'light';
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    
    document.querySelectorAll('.theme-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const theme = btn.dataset.theme;
            document.querySelectorAll('.theme-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            if (theme === 'auto') {
                document.documentElement.setAttribute('data-theme', prefersDark ? 'dark' : 'light');
                localStorage.setItem('theme', 'auto');
            } else {
                document.documentElement.setAttribute('data-theme', theme);
                localStorage.setItem('theme', theme);
            }
        });
    });
    
    if (saved === 'auto') {
        document.documentElement.setAttribute('data-theme', prefersDark ? 'dark' : 'light');
        document.querySelector('[data-theme="auto"]').classList.add('active');
    } else {
        document.documentElement.setAttribute('data-theme', saved);
        document.querySelector(`[data-theme="${saved}"]`).classList.add('active');
    }
    
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
        if (localStorage.getItem('theme') === 'auto') {
            document.documentElement.setAttribute('data-theme', e.matches ? 'dark' : 'light');
        }
    });
};

// Ripple effect
document.addEventListener('click', (e) => {
    if (e.target.closest('.btn-primary')) {
        const btn = e.target.closest('.btn-primary');
        const ripple = btn.querySelector('.ripple');
        if (ripple) {
            const rect = btn.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            ripple.style.left = x + 'px';
            ripple.style.top = y + 'px';
            ripple.style.animation = 'none';
            setTimeout(() => ripple.style.animation = 'ripple-effect 0.6s ease-out', 10);
        }
    }
});

// Form validation
const validateForm = (formId) => {
    const form = document.getElementById(formId);
    const inputs = form.querySelectorAll('[required]');
    let valid = true;
    
    inputs.forEach(input => {
        const errorMsg = input.parentElement.querySelector('.error-msg');
        if (!input.value.trim() || (input.minLength && input.value.length < input.minLength)) {
            input.classList.add('error');
            if (errorMsg) {
                errorMsg.textContent = input.minLength ? `Minimum ${input.minLength} characters required` : 'This field is required';
                errorMsg.classList.add('show');
            }
            valid = false;
        } else {
            input.classList.remove('error');
            if (errorMsg) errorMsg.classList.remove('show');
        }
    });
    
    return valid;
};

// Loading state
const showLoader = () => document.getElementById('loader').classList.add('show');
const hideLoader = () => document.getElementById('loader').classList.remove('show');

document.addEventListener('DOMContentLoaded', () => {
    checkAuth();
    
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', handleLogin);
    }
    
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', handleLogout);
    }
    
    initTheme();
    uiController.init();
});
