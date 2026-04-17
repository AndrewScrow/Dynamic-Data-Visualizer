const express = require('express');
const cors = require('cors');
const multer = require('multer');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3000;

// Налаштування
app.use(cors());
app.use(express.json());

// Перевіряємо, чи існує папка uploads, якщо ні — створюємо
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir);
}

// Налаштування збереження файлів (Multer)
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/');
    },
    filename: (req, file, cb) => {
        // Додаємо дату до імені файлу, щоб уникнути дублікатів
        cb(null, Date.now() + '-' + file.originalname);
    }
});
const upload = multer({ storage: storage });

// Шлях до нашої "бази даних" (файл history.json)
const DB_FILE = path.join(__dirname, 'history.json');

// Допоміжна функція для читання історії
const getHistory = () => {
    if (!fs.existsSync(DB_FILE)) return [];
    const data = fs.readFileSync(DB_FILE);
    return JSON.parse(data);
};

// --- ROUTES (Маршрути) ---

// 1. Отримати історію завантажень
app.get('/api/history', (req, res) => {
    const history = getHistory();
    res.json(history);
});

// 2. Завантажити файл
app.post('/api/upload', upload.single('csvFile'), (req, res) => {
    if (!req.file) {
        return res.status(400).send('Файл не завантажено');
    }

    // Створюємо запис про файл
    const newRecord = {
        id: Date.now(),
        originalName: req.file.originalname,
        filename: req.file.filename,
        size: req.file.size,
        uploadDate: new Date().toLocaleString()
    };

    // Зберігаємо в history.json
    const history = getHistory();
    history.push(newRecord);
    fs.writeFileSync(DB_FILE, JSON.stringify(history, null, 2));

    console.log(`Файл завантажено: ${newRecord.originalName}`);
    res.json(newRecord);
});

// Запуск сервера
app.listen(PORT, () => {
    console.log(`Сервер працює на http://localhost:${PORT}`);
});