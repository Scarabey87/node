module.exports = {
    // Проверка, авторизован ли пользователь
    requireAuth: (req, res, next) => {
        if (req.session.user) {
            next();
        } else {
            res.status(401).json({ error: 'Требуется авторизация' });
        }
    },
    
    // Проверка, является ли пользователь администратором
    requireAdmin: (req, res, next) => {
        if (req.session.admin) {
            next();
        } else {
            // Для API возвращаем JSON
            if (req.xhr || req.path.startsWith('/api/')) {
                res.status(401).json({ error: 'Требуется авторизация администратора' });
            } else {
                // Для страниц перенаправляем на логин
                res.redirect('/admin/login');
            }
        }
    },
    
    // Проверка прав суперадмина
    requireSuperAdmin: (req, res, next) => {
        if (req.session.admin && req.session.admin.role === 'superadmin') {
            next();
        } else {
            res.status(403).json({ error: 'Недостаточно прав' });
        }
    }
};
