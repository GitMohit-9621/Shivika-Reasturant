const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');
const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Database connection
// const pool = mysql.createPool({
//     host: '127.0.0.1',
//     user: 'root',
//     password: 'mohit@9621',
//     database: 'restaurant_booking',
//     waitForConnections: true,
//     connectionLimit: 10,
//     queueLimit: 0
// });







const pool = mysql.createPool({
    host: process.env.DB_HOST || '127.0.0.1',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || 'mohit@9621',
    database: process.env.DB_NAME || 'restaurant_booking',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    charset: 'utf8mb4' // Support for a wider range of characters
  });



const promisePool = pool.promise();

// Create tables if not exist
async function initializeDatabase() {
    await promisePool.execute(`
        CREATE TABLE IF NOT EXISTS tables (
            id INT PRIMARY KEY AUTO_INCREMENT,
            table_number INT NOT NULL UNIQUE,
            capacity INT NOT NULL,
            status ENUM('available', 'reserved', 'occupied') DEFAULT 'available'
        )
    `);

    await promisePool.execute(`
        CREATE TABLE IF NOT EXISTS bookings (
            id INT PRIMARY KEY AUTO_INCREMENT,
            name VARCHAR(255) NOT NULL,
            email VARCHAR(255) NOT NULL,
            phone VARCHAR(20) NOT NULL,
            date DATE NOT NULL,
            time TIME NOT NULL,
            guests INT NOT NULL,
            table_id INT,
            special_requests TEXT,
            status ENUM('confirmed', 'cancelled', 'completed') DEFAULT 'confirmed',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (table_id) REFERENCES tables(id)
        )
    `);
}

initializeDatabase();

// Routes
app.post('/api/bookings', async (req, res) => {
    try {
        const { name, email, phone, date, time, guests, specialRequests } = req.body;
        
        const [result] = await promisePool.execute(
            'INSERT INTO bookings (name, email, phone, date, time, guests, special_requests) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [name, email, phone, date, time, guests, specialRequests]
        );
        
        res.status(201).json({ 
            message: 'Booking created successfully',
            bookingId: result.insertId 
        });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

app.get('/api/bookings', async (req, res) => {
    try {
        const [rows] = await promisePool.execute('SELECT * FROM bookings');
        res.json(rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/tables', async (req, res) => {
    try {
        const [rows] = await promisePool.execute('SELECT * FROM tables');
        res.json(rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.put('/api/bookings/:id', async (req, res) => {
    try {
        const { name, email, phone, date, time, guests, specialRequests, status } = req.body;
        
        await promisePool.execute(
            `UPDATE bookings 
             SET name=?, email=?, phone=?, date=?, time=?, guests=?, 
                 special_requests=?, status=?
             WHERE id=?`,
            [name, email, phone, date, time, guests, specialRequests, status, req.params.id]
        );
        
        res.json({ message: 'Booking updated successfully' });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

app.delete('/api/bookings/:id', async (req, res) => {
    try {
        await promisePool.execute(
            'UPDATE bookings SET status="cancelled" WHERE id=?',
            [req.params.id]
        );
        res.json({ message: 'Booking cancelled successfully' });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Table management
app.put('/api/tables/:id/status', async (req, res) => {
    try {
        const { status } = req.body;
        await promisePool.execute(
            'UPDATE tables SET status=? WHERE id=?',
            [status, req.params.id]
        );
        res.json({ message: 'Table status updated successfully' });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Check table availability
app.get('/api/availability', async (req, res) => {
    try {
        const { date, time, guests } = req.query;
        const [rows] = await promisePool.execute(
            `SELECT t.* FROM tables t
             LEFT JOIN bookings b ON t.id = b.table_id 
             AND b.date = ? AND b.time = ?
             WHERE t.capacity >= ? AND t.status = 'available'
             AND b.id IS NULL`,
            [date, time, guests]
        );
        res.json(rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

const PORT = process.env.PORT || 3003;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});