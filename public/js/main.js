// Проверка авторизации при загрузке
document.addEventListener('DOMContentLoaded', () => {
    checkAuth();
    updateUserMenu();
});

// Проверка статуса авторизации
async function checkAuth() {
    try {
        const response = await fetch('/api/check-auth');
        const data = await response.json();
        window.userAuthenticated = data.authenticated;
        window.user = data.user;
        updateUserMenu();
    } catch (error) {
        console.error('Ошибка проверки авторизации:', error);
    }
}

// Обновление меню пользователя
function updateUserMenu() {
    const menu = document.getElementById('userMenu');
    if (!menu) return;

    if (window.userAuthenticated && window.user) {
        menu.innerHTML = `
            <span class="user-name">${window.user.fullName || window.user.username}</span>
            <button class="btn-logout" onclick="logout()">Выйти</button>
        `;
    } else {
        menu.innerHTML = `
            <button class="btn-login" onclick="showLoginForm()">Войти</button>
            <button class="btn-register" onclick="showRegisterForm()">Регистрация</button>
        `;
    }
}

// Показать форму входа
function showLoginForm() {
    const formDiv = document.getElementById('authForm');
    if (formDiv) {
        document.getElementById('formTitle').textContent = 'Вход';
        const form = document.getElementById('registerForm');
        form.onsubmit = (e) => handleLogin(e);
        
        // Скрываем лишние поля
        document.getElementById('fullName').parentElement.style.display = 'none';
        document.getElementById('phone').parentElement.style.display = 'none';
        
        // Меняем текст кнопки
        form.querySelector('button').textContent = 'Войти';
        
        // Меняем ссылку
        const link = form.nextElementSibling.querySelector('a');
        link.textContent = 'Зарегистрироваться';
        link.onclick = (e) => {
            e.preventDefault();
            showRegisterForm();
        };
    }
}

// Показать форму регистрации
function showRegisterForm() {
    const formDiv = document.getElementById('authForm');
    if (formDiv) {
        document.getElementById('formTitle').textContent = 'Регистрация';
        const form = document.getElementById('registerForm');
        form.onsubmit = (e) => handleRegister(e);
        
        // Показываем все поля
        document.getElementById('fullName').parentElement.style.display = 'block';
        document.getElementById('phone').parentElement.style.display = 'block';
        
        // Меняем текст кнопки
        form.querySelector('button').textContent = 'Зарегистрироваться';
        
        // Меняем ссылку
        const link = form.nextElementSibling.querySelector('a');
        link.textContent = 'Войти';
        link.onclick = (e) => {
            e.preventDefault();
            showLoginForm();
        };
    }
}

// Обработка регистрации
async function handleRegister(event) {
    event.preventDefault();
    
    const userData = {
        username: document.getElementById('username').value,
        email: document.getElementById('email').value,
        password: document.getElementById('password').value,
        fullName: document.getElementById('fullName').value,
        phone: document.getElementById('phone').value
    };
    
    try {
        const response = await fetch('/api/register', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(userData)
        });
        
        const data = await response.json();
        
        if (data.success) {
            alert('Регистрация успешна!');
            window.location.reload();
        } else {
            alert(data.error || 'Ошибка регистрации');
        }
    } catch (error) {
        console.error('Ошибка регистрации:', error);
        alert('Ошибка сервера');
    }
}

// Обработка входа
async function handleLogin(event) {
    event.preventDefault();
    
    const loginData = {
        email: document.getElementById('email').value,
        password: document.getElementById('password').value
    };
    
    try {
        const response = await fetch('/api/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(loginData)
        });
        
        const data = await response.json();
        
        if (data.success) {
            alert('Вход выполнен успешно!');
            window.location.reload();
        } else {
            alert(data.error || 'Ошибка входа');
        }
    } catch (error) {
        console.error('Ошибка входа:', error);
        alert('Ошибка сервера');
    }
}

// Выход
async function logout() {
    try {
        const response = await fetch('/api/logout', {
            method: 'POST'
        });
        
        const data = await response.json();
        
        if (data.success) {
            window.location.reload();
        }
    } catch (error) {
        console.error('Ошибка выхода:', error);
    }
}

// Выход из админки
async function logoutAdmin() {
    try {
        const response = await fetch('/api/admin/logout', {
            method: 'POST'
        });
        
        const data = await response.json();
        
        if (data.success) {
            window.location.href = '/';
        }
    } catch (error) {
        console.error('Ошибка выхода:', error);
    }
}