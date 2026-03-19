// Текущая активная секция
let currentSection = 'dashboard';

// Загрузка при старте
document.addEventListener('DOMContentLoaded', () => {
    loadDashboard();
    loadAdminInfo();
});

// Загрузка информации об администраторе
async function loadAdminInfo() {
    try {
        const response = await fetch('/api/admin/info');
        const data = await response.json();
        document.getElementById('adminName').textContent = data.username;
    } catch (error) {
        console.error('Ошибка загрузки информации об админе:', error);
    }
}

// Переключение секций
function showSection(section) {
    currentSection = section;
    
    // Обновляем активный класс в меню
    document.querySelectorAll('.admin-sidebar a').forEach(link => {
        link.classList.remove('active');
    });
    event.target.classList.add('active');
    
    // Загружаем соответствующую секцию
    switch(section) {
        case 'dashboard':
            loadDashboard();
            break;
        case 'people':
            loadPeople();
            break;
        case 'videos':
            loadVideos();
            break;
        case 'users':
            loadUsers();
            break;
        case 'chats':
            loadChats();
            break;
        case 'settings':
            loadSettings();
            break;
    }
}

// Загрузка дашборда
async function loadDashboard() {
    const content = document.getElementById('adminContent');
    content.innerHTML = '<div class="loading">Загрузка...</div>';
    
    try {
        const response = await fetch('/api/admin/stats');
        const stats = await response.json();
        
        content.innerHTML = `
            <div class="admin-header">
                <h2>Дашборд</h2>
                <button class="btn-refresh" onclick="loadDashboard()">🔄 Обновить</button>
            </div>
            
            <div class="stats-grid">
                <div class="stat-card">
                    <h3>Пользователи</h3>
                    <div class="value">${stats.users}</div>
                </div>
                <div class="stat-card">
                    <h3>Активные люди</h3>
                    <div class="value">${stats.activePeople}</div>
                </div>
                <div class="stat-card">
                    <h3>Активные видео</h3>
                    <div class="value">${stats.activeVideos}</div>
                </div>
                <div class="stat-card">
                    <h3>Сообщений</h3>
                    <div class="value">${stats.totalMessages}</div>
                </div>
                <div class="stat-card">
                    <h3>Диалогов</h3>
                    <div class="value">${stats.totalConversations}</div>
                </div>
                <div class="stat-card">
                    <h3>Новых за неделю</h3>
                    <div class="value">${stats.newUsersThisWeek}</div>
                </div>
            </div>
            
            <div class="card">
                <h3>Быстрые действия</h3>
                <div style="display: flex; gap: 1rem; margin-top: 1rem;">
                    <button class="btn-submit" onclick="showSection('people')">➕ Добавить человека</button>
                    <button class="btn-submit" onclick="showSection('videos')">🎬 Добавить видео</button>
                </div>
            </div>
        `;
    } catch (error) {
        content.innerHTML = '<div class="error">Ошибка загрузки данных</div>';
    }
}

// Загрузка людей
async function loadPeople() {
    const content = document.getElementById('adminContent');
    content.innerHTML = '<div class="loading">Загрузка...</div>';
    
    try {
        const response = await fetch('/api/admin/people');
        const people = await response.json();
        
        let html = `
            <div class="admin-header">
                <h2>Управление людьми</h2>
                <button class="btn-submit" onclick="showAddPersonForm()">➕ Добавить</button>
            </div>
            
            <div class="admin-table">
                <table>
                    <thead>
                        <tr>
                            <th>ID</th>
                            <th>Фото</th>
                            <th>Имя</th>
                            <th>Категория</th>
                            <th>Статус</th>
                            <th>Действия</th>
                        </tr>
                    </thead>
                    <tbody>
        `;
        
        people.forEach(person => {
            html += `
                <tr>
                    <td>${person.id}</td>
                    <td>
                        <img src="${person.photo_url || 'https://via.placeholder.com/50'}" 
                             style="width: 50px; height: 50px; object-fit: cover; border-radius: 50%;">
                    </td>
                    <td>${person.name}</td>
                    <td>${person.category || '-'}</td>
                    <td>
                        <span style="color: ${person.is_active ? 'green' : 'red'}">
                            ${person.is_active ? 'Активен' : 'Неактивен'}
                        </span>
                    </td>
                    <td>
                        <button class="btn-edit" onclick="editPerson(${person.id})">✏️</button>
                        <button class="btn-delete" onclick="deletePerson(${person.id})">🗑️</button>
                    </td>
                </tr>
            `;
        });
        
        html += `
                    </tbody>
                </table>
            </div>
        `;
        
        content.innerHTML = html;
    } catch (error) {
        content.innerHTML = '<div class="error">Ошибка загрузки данных</div>';
    }
}

// Показать форму добавления человека
function showAddPersonForm() {
    document.getElementById('modalTitle').textContent = 'Добавить человека';
    document.getElementById('modalBody').innerHTML = `
        <form id="personForm" onsubmit="savePerson(event)">
            <div class="form-group">
                <label>Имя</label>
                <input type="text" id="personName" class="form-control" required>
            </div>
            <div class="form-group">
                <label>Категория</label>
                <input type="text" id="personCategory" class="form-control">
            </div>
            <div class="form-group">
                <label>Описание</label>
                <textarea id="personDescription" class="form-control" rows="3"></textarea>
            </div>
            <div class="form-group">
                <label>Фото</label>
                <input type="file" id="personPhoto" class="form-control" accept="image/*">
            </div>
            <div class="form-group">
                <label>
                    <input type="checkbox" id="personActive" checked> Активен
                </label>
            </div>
            <button type="submit" class="btn-submit">Сохранить</button>
        </form>
    `;
    document.getElementById('editModal').style.display = 'block';
}

// Сохранение человека
async function savePerson(event) {
    event.preventDefault();
    
    const formData = new FormData();
    formData.append('name', document.getElementById('personName').value);
    formData.append('category', document.getElementById('personCategory').value);
    formData.append('description', document.getElementById('personDescription').value);
    formData.append('is_active', document.getElementById('personActive').checked);
    
    const photoFile = document.getElementById('personPhoto').files[0];
    if (photoFile) {
        formData.append('photo', photoFile);
    }
    
    try {
        const response = await fetch('/api/admin/people', {
            method: 'POST',
            body: formData
        });
        
        const data = await response.json();
        
        if (data.success) {
            closeModal();
            loadPeople();
        } else {
            alert('Ошибка сохранения');
        }
    } catch (error) {
        console.error('Ошибка:', error);
        alert('Ошибка сервера');
    }
}

// Редактирование человека
async function editPerson(id) {
    try {
        const response = await fetch(`/api/admin/people/${id}`);
        const person = await response.json();
        
        document.getElementById('modalTitle').textContent = 'Редактировать человека';
        document.getElementById('modalBody').innerHTML = `
            <form id="personForm" onsubmit="updatePerson(event, ${id})">
                <div class="form-group">
                    <label>Имя</label>
                    <input type="text" id="personName" class="form-control" value="${person.name}" required>
                </div>
                <div class="form-group">
                    <label>Категория</label>
                    <input type="text" id="personCategory" class="form-control" value="${person.category || ''}">
                </div>
                <div class="form-group">
                    <label>Описание</label>
                    <textarea id="personDescription" class="form-control" rows="3">${person.description || ''}</textarea>
                </div>
                <div class="form-group">
                    <label>Новое фото (оставьте пустым, чтобы не менять)</label>
                    <input type="file" id="personPhoto" class="form-control" accept="image/*">
                </div>
                <div class="form-group">
                    <label>
                        <input type="checkbox" id="personActive" ${person.is_active ? 'checked' : ''}> Активен
                    </label>
                </div>
                <button type="submit" class="btn-submit">Сохранить</button>
            </form>
        `;
        document.getElementById('editModal').style.display = 'block';
    } catch (error) {
        console.error('Ошибка:', error);
    }
}

// Обновление человека
async function updatePerson(event, id) {
    event.preventDefault();
    
    const formData = new FormData();
    formData.append('name', document.getElementById('personName').value);
    formData.append('category', document.getElementById('personCategory').value);
    formData.append('description', document.getElementById('personDescription').value);
    formData.append('is_active', document.getElementById('personActive').checked);
    
    const photoFile = document.getElementById('personPhoto').files[0];
    if (photoFile) {
        formData.append('photo', photoFile);
    }
    
    try {
        const response = await fetch(`/api/admin/people/${id}`, {
            method: 'PUT',
            body: formData
        });
        
        const data = await response.json();
        
        if (data.success) {
            closeModal();
            loadPeople();
        } else {
            alert('Ошибка сохранения');
        }
    } catch (error) {
        console.error('Ошибка:', error);
        alert('Ошибка сервера');
    }
}

// Удаление человека
async function deletePerson(id) {
    if (!confirm('Вы уверены, что хотите удалить этого человека?')) return;
    
    try {
        const response = await fetch(`/api/admin/people/${id}`, {
            method: 'DELETE'
        });
        
        const data = await response.json();
        
        if (data.success) {
            loadPeople();
        } else {
            alert('Ошибка удаления');
        }
    } catch (error) {
        console.error('Ошибка:', error);
        alert('Ошибка сервера');
    }
}

// Закрыть модальное окно
function closeModal() {
    document.getElementById('editModal').style.display = 'none';
}