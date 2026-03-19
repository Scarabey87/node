const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');
const path = require('path');

class Database {
    constructor() {
        this.db = new sqlite3.Database(path.join(__dirname, 'database.db'), (err) => {
            if (err) {
                console.error('Ошибка подключения к БД:', err);
            } else {
                console.log('Подключено к SQLite');
                this.init();
            }
        });
    }

    init() {
        // Таблица пользователей
        this.db.run(`
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT UNIQUE NOT NULL,
                email TEXT UNIQUE NOT NULL,
                password TEXT NOT NULL,
                full_name TEXT,
                phone TEXT,
                role TEXT DEFAULT 'user',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                last_login DATETIME
            )
        `);

        // Таблица людей (для страницы выбора)
        this.db.run(`
            CREATE TABLE IF NOT EXISTS people (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                photo_url TEXT,
                description TEXT,
                category TEXT,
                sort_order INTEGER DEFAULT 0,
                is_active BOOLEAN DEFAULT 1,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Таблица видео
        this.db.run(`
            CREATE TABLE IF NOT EXISTS videos (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                person_id INTEGER,
                title TEXT NOT NULL,
                video_url TEXT NOT NULL,
                thumbnail_url TEXT,
                duration INTEGER,
                views INTEGER DEFAULT 0,
                sort_order INTEGER DEFAULT 0,
                is_active BOOLEAN DEFAULT 1,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (person_id) REFERENCES people(id) ON DELETE CASCADE
            )
        `);

        // Таблица чат-диалогов
        this.db.run(`
            CREATE TABLE IF NOT EXISTS chat_messages (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                session_id TEXT NOT NULL,
                user_id INTEGER,
                user_message TEXT NOT NULL,
                bot_response TEXT NOT NULL,
                intent TEXT,
                sentiment TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
            )
        `);

        // Таблица для хранения диалогов полностью
        this.db.run(`
            CREATE TABLE IF NOT EXISTS conversations (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                session_id TEXT NOT NULL,
                user_id INTEGER,
                messages TEXT, -- JSON массив сообщений
                summary TEXT,
                user_feedback TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Таблица настроек сайта
        this.db.run(`
            CREATE TABLE IF NOT EXISTS settings (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                key TEXT UNIQUE NOT NULL,
                value TEXT,
                description TEXT,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Таблица для админов
        this.db.run(`
            CREATE TABLE IF NOT EXISTS admins (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT UNIQUE NOT NULL,
                password TEXT NOT NULL,
                email TEXT UNIQUE NOT NULL,
                full_name TEXT,
                role TEXT DEFAULT 'admin',
                last_login DATETIME,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Создание тестового админа
        this.createDefaultAdmin();
    }

    async createDefaultAdmin() {
        const hashedPassword = await bcrypt.hash('admin123', 10);
        this.db.run(`
            INSERT OR IGNORE INTO admins (username, password, email, full_name, role)
            VALUES (?, ?, ?, ?, ?)
        `, ['admin', hashedPassword, 'admin@example.com', 'Главный администратор', 'superadmin']);
    }

    // Методы для работы с пользователями
    async createUser(username, email, password, fullName, phone) {
        const hashedPassword = await bcrypt.hash(password, 10);
        return new Promise((resolve, reject) => {
            this.db.run(
                'INSERT INTO users (username, email, password, full_name, phone) VALUES (?, ?, ?, ?, ?)',
                [username, email, hashedPassword, fullName, phone],
                function(err) {
                    if (err) reject(err);
                    else resolve({ id: this.lastID, username, email });
                }
            );
        });
    }

    async findUserByEmail(email) {
        return new Promise((resolve, reject) => {
            this.db.get('SELECT * FROM users WHERE email = ?', [email], (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });
    }

    async validateUser(email, password) {
        const user = await this.findUserByEmail(email);
        if (!user) return null;
        
        const valid = await bcrypt.compare(password, user.password);
        return valid ? user : null;
    }

    // Методы для работы с людьми
    getAllPeople(activeOnly = true) {
        return new Promise((resolve, reject) => {
            let query = 'SELECT * FROM people';
            if (activeOnly) query += ' WHERE is_active = 1';
            query += ' ORDER BY sort_order, name';
            
            this.db.all(query, [], (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });
    }

    getPersonById(id) {
        return new Promise((resolve, reject) => {
            this.db.get('SELECT * FROM people WHERE id = ?', [id], (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });
    }

    createPerson(person) {
        return new Promise((resolve, reject) => {
            this.db.run(
                'INSERT INTO people (name, photo_url, description, category) VALUES (?, ?, ?, ?)',
                [person.name, person.photo_url, person.description, person.category],
                function(err) {
                    if (err) reject(err);
                    else resolve({ id: this.lastID, ...person });
                }
            );
        });
    }

    updatePerson(id, person) {
        return new Promise((resolve, reject) => {
            this.db.run(
                'UPDATE people SET name = ?, photo_url = ?, description = ?, category = ?, is_active = ? WHERE id = ?',
                [person.name, person.photo_url, person.description, person.category, person.is_active, id],
                function(err) {
                    if (err) reject(err);
                    else resolve({ id, ...person });
                }
            );
        });
    }

    deletePerson(id) {
        return new Promise((resolve, reject) => {
            this.db.run('DELETE FROM people WHERE id = ?', [id], function(err) {
                if (err) reject(err);
                else resolve({ deleted: true });
            });
        });
    }

    // Методы для работы с видео
    getVideosByPerson(personId, activeOnly = true) {
        return new Promise((resolve, reject) => {
            let query = 'SELECT * FROM videos WHERE person_id = ?';
            if (activeOnly) query += ' AND is_active = 1';
            query += ' ORDER BY sort_order, created_at DESC';
            
            this.db.all(query, [personId], (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });
    }

    getAllVideos() {
        return new Promise((resolve, reject) => {
            this.db.all('SELECT v.*, p.name as person_name FROM videos v LEFT JOIN people p ON v.person_id = p.id ORDER BY v.created_at DESC', [], (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });
    }

    createVideo(video) {
        return new Promise((resolve, reject) => {
            this.db.run(
                'INSERT INTO videos (person_id, title, video_url, thumbnail_url, duration) VALUES (?, ?, ?, ?, ?)',
                [video.person_id, video.title, video.video_url, video.thumbnail_url, video.duration],
                function(err) {
                    if (err) reject(err);
                    else resolve({ id: this.lastID, ...video });
                }
            );
        });
    }

    updateVideoViews(id) {
        return new Promise((resolve, reject) => {
            this.db.run('UPDATE videos SET views = views + 1 WHERE id = ?', [id], function(err) {
                if (err) reject(err);
                else resolve({ updated: true });
            });
        });
    }

    // Методы для чат-бота
    async saveChatMessage(sessionId, userId, userMessage, botResponse, intent = null, sentiment = null) {
        return new Promise((resolve, reject) => {
            this.db.run(
                'INSERT INTO chat_messages (session_id, user_id, user_message, bot_response, intent, sentiment) VALUES (?, ?, ?, ?, ?, ?)',
                [sessionId, userId, userMessage, botResponse, intent, sentiment],
                function(err) {
                    if (err) reject(err);
                    else resolve({ id: this.lastID });
                }
            );
        });
    }

    async saveConversation(sessionId, userId, messages, summary = null) {
        const messagesJson = JSON.stringify(messages);
        return new Promise((resolve, reject) => {
            this.db.run(
                `INSERT INTO conversations (session_id, user_id, messages, summary) 
                 VALUES (?, ?, ?, ?)
                 ON CONFLICT(session_id) DO UPDATE SET 
                 messages = ?, updated_at = CURRENT_TIMESTAMP`,
                [sessionId, userId, messagesJson, summary, messagesJson],
                function(err) {
                    if (err) reject(err);
                    else resolve({ id: this.lastID });
                }
            );
        });
    }

    getConversationHistory(sessionId) {
        return new Promise((resolve, reject) => {
            this.db.get('SELECT * FROM conversations WHERE session_id = ?', [sessionId], (err, row) => {
                if (err) reject(err);
                else {
                    if (row && row.messages) {
                        row.messages = JSON.parse(row.messages);
                    }
                    resolve(row);
                }
            });
        });
    }

    getAllConversations(limit = 100) {
        return new Promise((resolve, reject) => {
            this.db.all('SELECT * FROM conversations ORDER BY updated_at DESC LIMIT ?', [limit], (err, rows) => {
                if (err) reject(err);
                else {
                    rows.forEach(row => {
                        if (row.messages) {
                            try {
                                row.messages = JSON.parse(row.messages);
                            } catch (e) {
                                row.messages = [];
                            }
                        }
                    });
                    resolve(rows);
                }
            });
        });
    }

    // Методы для админов
    async createAdmin(username, password, email, fullName) {
        const hashedPassword = await bcrypt.hash(password, 10);
        return new Promise((resolve, reject) => {
            this.db.run(
                'INSERT INTO admins (username, password, email, full_name) VALUES (?, ?, ?, ?)',
                [username, hashedPassword, email, fullName],
                function(err) {
                    if (err) reject(err);
                    else resolve({ id: this.lastID, username, email });
                }
            );
        });
    }

    async validateAdmin(username, password) {
        return new Promise((resolve, reject) => {
            this.db.get('SELECT * FROM admins WHERE username = ?', [username], async (err, admin) => {
                if (err) reject(err);
                if (!admin) resolve(null);
                else {
                    const valid = await bcrypt.compare(password, admin.password);
                    if (valid) {
                        // Обновляем время последнего входа
                        this.db.run('UPDATE admins SET last_login = CURRENT_TIMESTAMP WHERE id = ?', [admin.id]);
                        resolve(admin);
                    } else {
                        resolve(null);
                    }
                }
            });
        });
    }

    // Методы для настроек
    getSetting(key) {
        return new Promise((resolve, reject) => {
            this.db.get('SELECT value FROM settings WHERE key = ?', [key], (err, row) => {
                if (err) reject(err);
                else resolve(row ? row.value : null);
            });
        });
    }

    setSetting(key, value, description = '') {
        return new Promise((resolve, reject) => {
            this.db.run(
                `INSERT INTO settings (key, value, description) VALUES (?, ?, ?)
                 ON CONFLICT(key) DO UPDATE SET value = ?, updated_at = CURRENT_TIMESTAMP`,
                [key, value, description, value],
                function(err) {
                    if (err) reject(err);
                    else resolve({ key, value });
                }
            );
        });
    }

    getAllSettings() {
        return new Promise((resolve, reject) => {
            this.db.all('SELECT * FROM settings ORDER BY key', [], (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });
    }

    // Статистика для админки
    getDashboardStats() {
        return new Promise((resolve, reject) => {
            const stats = {};
            
            this.db.get('SELECT COUNT(*) as count FROM users', [], (err, row) => {
                stats.users = row.count;
                
                this.db.get('SELECT COUNT(*) as count FROM people WHERE is_active = 1', [], (err, row) => {
                    stats.activePeople = row.count;
                    
                    this.db.get('SELECT COUNT(*) as count FROM videos WHERE is_active = 1', [], (err, row) => {
                        stats.activeVideos = row.count;
                        
                        this.db.get('SELECT COUNT(*) as count FROM chat_messages', [], (err, row) => {
                            stats.totalMessages = row.count;
                            
                            this.db.get('SELECT COUNT(DISTINCT session_id) as count FROM conversations', [], (err, row) => {
                                stats.totalConversations = row.count;
                                
                                this.db.get('SELECT COUNT(*) as count FROM users WHERE created_at > datetime("now", "-7 days")', [], (err, row) => {
                                    stats.newUsersThisWeek = row.count;
                                    resolve(stats);
                                });
                            });
                        });
                    });
                });
            });
        });
    }

    close() {
        this.db.close();
    }
}

module.exports = new Database();
