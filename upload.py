#!/usr/bin/env python3
import os
import html
import urllib.parse
from http.server import HTTPServer, SimpleHTTPRequestHandler

class UploadHandler(SimpleHTTPRequestHandler):
    def do_GET(self):
        # Отображаем HTML-форму для загрузки
        if self.path == '/':
            self.send_response(200)
            self.send_header('Content-type', 'text/html; charset=utf-8')
            self.end_headers()
            
            html_form = '''
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="utf-8">
                <title>Загрузка файлов на сервер</title>
                <style>
                    body { font-family: Arial, sans-serif; margin: 40px; background: #f5f5f5; }
                    .container { max-width: 600px; margin: 0 auto; background: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
                    h1 { color: #333; }
                    input[type="file"] { margin: 15px 0; }
                    button { background: #4CAF50; color: white; padding: 10px 20px; border: none; border-radius: 5px; cursor: pointer; }
                    button:hover { background: #45a049; }
                    .message { margin-top: 20px; padding: 10px; border-radius: 5px; display: none; }
                    .success { background: #d4edda; color: #155724; border: 1px solid #c3e6cb; }
                    .error { background: #f8d7da; color: #721c24; border: 1px solid #f5c6cb; }
                    .file-list { margin-top: 20px; }
                    .file-list a { display: block; padding: 5px; color: #333; text-decoration: none; }
                    .file-list a:hover { background: #f0f0f0; }
                </style>
            </head>
            <body>
                <div class="container">
                    <h1>📁 Загрузка файлов на сервер</h1>
                    <form action="/upload" method="post" enctype="multipart/form-data" id="uploadForm">
                        <input type="file" name="file" id="fileInput" multiple required>
                        <br>
                        <button type="submit">⬆️ Загрузить</button>
                    </form>
                    <div id="message" class="message"></div>
                    <div class="file-list">
                        <h3>Файлы на сервере:</h3>
                        <div id="fileList"></div>
                    </div>
                </div>
                <script>
                    // Загрузка списка файлов
                    fetch('/files')
                        .then(res => res.json())
                        .then(files => {
                            const list = document.getElementById('fileList');
                            if (files.length === 0) {
                                list.innerHTML = '<p>Нет файлов</p>';
                            } else {
                                list.innerHTML = files.map(f => `<a href="/download/${f}" target="_blank">📄 ${f}</a>`).join('');
                            }
                        });
                    
                    // Отправка формы через fetch
                    document.getElementById('uploadForm').onsubmit = async (e) => {
                        e.preventDefault();
                        const formData = new FormData();
                        const files = document.getElementById('fileInput').files;
                        for (let i = 0; i < files.length; i++) {
                            formData.append('files', files[i]);
                        }
                        
                        const msg = document.getElementById('message');
                        msg.style.display = 'block';
                        msg.className = 'message';
                        msg.textContent = 'Загрузка...';
                        
                        try {
                            const res = await fetch('/upload', {
                                method: 'POST',
                                body: formData
                            });
                            const data = await res.json();
                            if (res.ok) {
                                msg.className = 'message success';
                                msg.textContent = data.message;
                                // Обновляем список файлов
                                location.reload();
                            } else {
                                throw new Error(data.error || 'Ошибка загрузки');
                            }
                        } catch (err) {
                            msg.className = 'message error';
                            msg.textContent = 'Ошибка: ' + err.message;
                        }
                    };
                </script>
            </body>
            </html>
            '''
            self.wfile.write(html_form.encode('utf-8'))
            return
        
        # API: список файлов
        if self.path == '/files':
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            files = [f for f in os.listdir('.') if os.path.isfile(f) and not f.startswith('upload_server')]
            import json
            self.wfile.write(json.dumps(files).encode())
            return
        
        # Скачивание файла
        if self.path.startswith('/download/'):
            filename = urllib.parse.unquote(self.path[10:])
            if os.path.isfile(filename):
                self.send_response(200)
                self.send_header('Content-type', 'application/octet-stream')
                self.send_header('Content-Disposition', f'attachment; filename="{filename}"')
                self.end_headers()
                with open(filename, 'rb') as f:
                    self.wfile.write(f.read())
            else:
                self.send_error(404, 'File not found')
            return
        
        # Обработка загрузки файлов
        if self.path == '/upload' and self.command == 'POST':
            content_length = int(self.headers.get('Content-Length', 0))
            content_type = self.headers.get('Content-Type', '')
            
            if not content_type.startswith('multipart/form-data'):
                self.send_error(400, 'Expected multipart/form-data')
                return
            
            # Простой парсинг multipart/form-data (только для файлов)
            boundary = content_type.split('boundary=')[1].encode()
            body = self.rfile.read(content_length)
            
            uploaded_files = []
            parts = body.split(b'--' + boundary)
            
            for part in parts:
                if part == b'--\r\n' or part == b'--' or part == b'':
                    continue
                
                # Ищем имя файла
                header_end = part.find(b'\r\n\r\n')
                if header_end == -1:
                    continue
                
                headers = part[:header_end].decode('utf-8', errors='ignore')
                file_data = part[header_end + 4:-2]  # Убираем \r\n в конце
                
                if 'filename="' not in headers:
                    continue
                
                # Извлекаем имя файла
                filename_start = headers.find('filename="') + 10
                filename_end = headers.find('"', filename_start)
                filename = headers[filename_start:filename_end]
                
                if filename:
                    # Сохраняем файл
                    with open(filename, 'wb') as f:
                        f.write(file_data)
                    uploaded_files.append(filename)
            
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            import json
            result = {'success': True, 'message': f'Загружено файлов: {len(uploaded_files)}', 'files': uploaded_files}
            self.wfile.write(json.dumps(result).encode())
            return
        
        # Для всего остального — стандартное поведение
        super().do_GET()

if __name__ == '__main__':
    port = 8000
    server = HTTPServer(('0.0.0.0', port), UploadHandler)
    print(f'🚀 Сервер запущен на http://0.0.0.0:{port}')
    print('📂 Перейдите на http://<IP-адрес_сервера>:8000 для загрузки файлов')
    print('⏹️  Нажмите Ctrl+C для остановки')
    
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print('\n👋 Сервер остановлен')
        server.server_close()
