require('dotenv').config();
const express = require('express');
const session = require('express-session');
const multer = require('multer');
const path = require('path');
const bcrypt = require('bcrypt');
const db = require('./database');
const auth = require('./middleware/auth');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = process.env.PORT || 3000;

// Настройка multer для загрузки файлов
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        if (file.fieldname === 'photo') {
            cb(null, 'public/uploads/photos/');
        } else if (file.fieldname === 'video') {
            cb(null, 'public/uploads/videos/');
        }
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({ 
    storage: storage,
    limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
    fileFilter: (req, file, cb) => {
        if (file.fieldname === 'photo') {
            if (!file.originalname.match(/\.(jpg|jpeg|png|gif)$/)) {
                return cb(new Error('Только изображения!'), false);
            }
        } else if (file.fieldname === 'video') {
            if (!file.originalname.match(/\.(mp4|webm|ogg)$/)) {
                return cb(new Error('Только видео!'), false);
            }
        }
        cb(null, true);
    }
});

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));
app.use(session({
    secret: process.env.SESSION_SECRET || 'your-secret-key',
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false, maxAge: 24 * 60 * 60 * 1000 } // 24 часа
}));

// Настройка шаблонизатора
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Middleware для передачи данных пользователя в шаблоны
app.use((req, res, next) => {
    res.locals.user = req.session.user || null;
    res.locals.currentPath = req.path;
    next();
});

// ==================== ПУБЛИЧНЫЕ МАРШРУТЫ ====================

// Главная страница
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'index.html'));
});

// Регистрация
app.post('/api/register', async (req, res) => {
    try {
        const { username, email, password, fullName, phone } = req.body;
        
        // Проверка существования пользователя
        const existingUser = await db.findUserByEmail(email);
        if (existingUser) {
            return res.status(400).json({ error: 'Пользователь с таким email уже существует' });
        }
        
        const user = await db.createUser(username, email, password, fullName, phone);
        
        // Автоматический вход после регистрации
        req.session.user = {
            id: user.id,
            username: user.username,
            email: user.email
        };
        
        res.json({ success: true, user });
    } catch (error) {
        console.error('Ошибка регистрации:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// Вход
app.post('/api/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await db.validateUser(email, password);
        
        if (!user) {
            return res.status(401).json({ error: 'Неверный email или пароль' });
        }
        
        req.session.user = {
            id: user.id,
            username: user.username,
            email: user.email,
            fullName: user.full_name
        };
        
        res.json({ success: true, user: req.session.user });
    } catch (error) {
        console.error('Ошибка входа:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// Выход
app.post('/api/logout', (req, res) => {
    req.session.destroy();
    res.json({ success: true });
});

// Страница с людьми
app.get('/people', async (req, res) => {
    try {
        const people = await db.getAllPeople(true);
        res.render('people', { people });
    } catch (error) {
        console.error('Ошибка загрузки людей:', error);
        res.status(500).send('Ошибка сервера');
    }
});

// API для получения списка людей
app.get('/api/people', async (req, res) => {
    try {
        const people = await db.getAllPeople(true);
        res.json(people);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Страница с видео для конкретного человека
app.get('/videos/:personId', async (req, res) => {
    try {
        const person = await db.getPersonById(req.params.personId);
        if (!person) {
            return res.status(404).send('Человек не найден');
        }
        
        const videos = await db.getVideosByPerson(req.params.personId, true);
        res.render('videos', { person, videos });
    } catch (error) {
        console.error('Ошибка загрузки видео:', error);
        res.status(500).send('Ошибка сервера');
    }
});

// API для получения видео
app.get('/api/videos/:personId', async (req, res) => {
    try {
        const videos = await db.getVideosByPerson(req.params.personId, true);
        res.json(videos);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Увеличение счетчика просмотров видео
app.post('/api/videos/:videoId/view', async (req, res) => {
    try {
        await db.updateVideoViews(req.params.videoId);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Страница чат-бота
app.get('/chat', (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'chat.html'));
});

// API для чат-бота
app.post('/api/chat', async (req, res) => {
    try {
        const { message, sessionId } = req.body;
        const userId = req.session.user?.id || null;
        const currentSessionId = sessionId || uuidv4();
        
        // Простой ИИ-бот (можно заменить на более сложный)
        const botResponse = generateBotResponse(message);
        const intent = detectIntent(message);
        const sentiment = detectSentiment(message);
        
        // Сохраняем сообщение
        await db.saveChatMessage(currentSessionId, userId, message, botResponse, intent, sentiment);
        
        // Получаем историю и сохраняем диалог
        const conversation = await db.getConversationHistory(currentSessionId);
        let messages = [];
        
        if (conversation && conversation.messages) {
            messages = conversation.messages;
        }
        
        messages.push({ role: 'user', content: message, timestamp: new Date() });
        messages.push({ role: 'bot', content: botResponse, timestamp: new Date() });
        
        // Ограничиваем историю последними 20 сообщениями
        if (messages.length > 20) {
            messages = messages.slice(-20);
        }
        
        await db.saveConversation(currentSessionId, userId, messages);
        
        res.json({
            response: botResponse,
            sessionId: currentSessionId,
            intent,
            sentiment
        });
        
    } catch (error) {
        console.error('Ошибка чата:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// Простая функция для генерации ответов бота
function generateBotResponse(message) {
    const responses = [
        "Спасибо за ваше сообщение! Мы обязательно рассмотрим его.",
        "Интересная мысль! Расскажите подробнее.",
        "Я передал ваше пожелание администрации.",
        "Отлично! Есть что-то еще, чем вы хотели бы поделиться?",
        "Мы ценим ваше мнение!",
        "Спасибо за обратную связь. Это поможет нам стать лучше.",
        "Ваше пожелание записано!",
        "Хороший день, чтобы поделиться идеями! Что еще?",
        "Я внимательно слушаю...",
        "Замечательно! Продолжайте в том же духе."
    ];
    
    // Анализ ключевых слов
    const lowerMsg = message.toLowerCase();
    
    if (lowerMsg.includes('привет') || lowerMsg.includes('здравствуй')) {
        return "Привет! Чем я могу вам помочь?";
    } else if (lowerMsg.includes('помощь') || lowerMsg.includes('help')) {
        return "Я здесь, чтобы помочь! Вы можете поделиться своими пожеланиями, идеями или задать вопросы о сайте.";
    } else if (lowerMsg.includes('спасибо')) {
        return "Пожалуйста! Рад помочь!";
    } else if (lowerMsg.includes('пока') || lowerMsg.includes('до свидания')) {
        return "До свидания! Буду рад снова помочь!";
    }
    
    return responses[Math.floor(Math.random() * responses.length)];
}

function detectIntent(message) {
    const lowerMsg = message.toLowerCase();
    if (lowerMsg.includes('вопрос')) return 'question';
    if (lowerMsg.includes('пожелание') || lowerMsg.includes('хотел')) return 'wish';
    if (lowerMsg.includes('проблем') || lowerMsg.includes('ошибк')) return 'problem';
    if (lowerMsg.includes('предлож')) return 'suggestion';
    if (lowerMsg.includes('спасиб')) return 'gratitude';
    return 'general';
}

function detectSentiment(message) {
    const positiveWords = ['хорош', 'отличн', 'замечательн', 'спасиб', '👍', '❤️', 'крут'];
    const negativeWords = ['плох', 'ужасн', 'не работ', 'ошибк', 'проблем', '👎'];
    
    const lowerMsg = message.toLowerCase();
    
    for (let word of positiveWords) {
        if (lowerMsg.includes(word)) return 'positive';
    }
    
    for (let word of negativeWords) {
        if (lowerMsg.includes(word)) return 'negative';
    }
    
    return 'neutral';
}

// API для получения истории чата
app.get('/api/chat/history/:sessionId', async (req, res) => {
    try {
        const conversation = await db.getConversationHistory(req.params.sessionId);
        res.json(conversation || { messages: [] });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ==================== АДМИН-ПАНЕЛЬ ====================

// Страница входа в админку
app.get('/admin/login', (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'login.html'));
});

// Вход в админку
app.post('/admin/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        const admin = await db.validateAdmin(username, password);
        
        if (!admin) {
            return res.status(401).json({ error: 'Неверный логин или пароль' });
        }
        
        req.session.admin = {
            id: admin.id,
            username: admin.username,
            email: admin.email,
            role: admin.role
        };
        
        res.json({ success: true });
    } catch (error) {
        console.error('Ошибка входа в админку:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// Middleware для проверки админа
app.use('/edit', auth.requireAdmin);

// Главная страница админки
app.get('/edit', (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'admin.html'));
});

// API для получения статистики
app.get('/api/admin/stats', async (req, res) => {
    try {
        const stats = await db.getDashboardStats();
        res.json(stats);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Управление людьми (CRUD)
app.get('/api/admin/people', async (req, res) => {
    try {
        const people = await db.getAllPeople(false); // включая неактивных
        res.json(people);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/admin/people', upload.single('photo'), async (req, res) => {
    try {
        const person = {
            name: req.body.name,
            description: req.body.description,
            category: req.body.category,
            photo_url: req.file ? `/uploads/photos/${req.file.filename}` : null,
            is_active: req.body.is_active === 'true'
        };
        
        const result = await db.createPerson(person);
        res.json({ success: true, id: result.id });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.put('/api/admin/people/:id', upload.single('photo'), async (req, res) => {
    try {
        const person = {
            name: req.body.name,
            description: req.body.description,
            category: req.body.category,
            is_active: req.body.is_active === 'true'
        };
        
        if (req.file) {
            person.photo_url = `/uploads/photos/${req.file.filename}`;
        }
        
        await db.updatePerson(req.params.id, person);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.delete('/api/admin/people/:id', async (req, res) => {
    try {
        await db.deletePerson(req.params.id);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Управление видео
app.get('/api/admin/videos', async (req, res) => {
    try {
        const videos = await db.getAllVideos();
        res.json(videos);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/admin/videos', upload.fields([
    { name: 'video', maxCount: 1 },
    { name: 'thumbnail', maxCount: 1 }
]), async (req, res) => {
    try {
        const video = {
            person_id: req.body.person_id,
            title: req.body.title,
            description: req.body.description,
            video_url: req.files['video'] ? `/uploads/videos/${req.files['video'][0].filename}` : null,
            thumbnail_url: req.files['thumbnail'] ? `/uploads/videos/${req.files['thumbnail'][0].filename}` : null,
            duration: req.body.duration || 0,
            is_active: req.body.is_active === 'true'
        };
        
        const result = await db.createVideo(video);
        res.json({ success: true, id: result.id });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Управление пользователями
app.get('/api/admin/users', async (req, res) => {
    try {
        const users = await new Promise((resolve, reject) => {
            db.db.all('SELECT id, username, email, full_name, phone, role, created_at, last_login FROM users ORDER BY created_at DESC', [], (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });
        res.json(users);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Управление диалогами чата
app.get('/api/admin/conversations', async (req, res) => {
    try {
        const conversations = await db.getAllConversations();
        res.json(conversations);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Управление настройками
app.get('/api/admin/settings', async (req, res) => {
    try {
        const settings = await db.getAllSettings();
        res.json(settings);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/admin/settings', async (req, res) => {
    try {
        const { key, value, description } = req.body;
        await db.setSetting(key, value, description);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Выход из админки
app.post('/api/admin/logout', (req, res) => {
    req.session.admin = null;
    res.json({ success: true });
});

// Запуск сервера
app.listen(PORT, () => {
    console.log(`🚀 Сервер запущен на http://localhost:${PORT}`);
    console.log(`📊 Админ-панель: http://localhost:${PORT}/edit`);
    console.log(`👤 Логин админа: admin / admin123`);
});
