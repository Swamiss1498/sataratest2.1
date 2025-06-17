 // author : Siddheshwar Swami 
// Version : 2.1
// Date : 17/06/25

const express = require('express');
// const mysql = require('mysql2');
const { Pool } = require('pg');
const cors = require('cors');
const app = express();


app.use(cors({
    origin: '*', 
    credentials: true,
}));
const PORT = process.env.PORT || 5000; 

app.use(express.json());

require('dotenv').config();

// 
// ✅ Database connection using env variables
// const pool = mysql.createConnection({
//     host: process.env.DB_HOST,
//     user: process.env.DB_USER,
//     password: process.env.DB_PASSWORD,
//     database: process.env.DB_NAME
// });

// ✅ PostgreSQL Connection with Render (SSL required)
const pool = new Pool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: 5432,
  ssl: {
    rejectUnauthorized: false  // <== This line ensures SSL works with Render
  }
});
// const pool = new Pool({
//   host: process.env.DB_HOST,      // e.g., 'localhost'
//   user: process.env.DB_USER,      // e.g., 'postgres'
//   password: process.env.DB_PASSWORD,
//   database: process.env.DB_NAME,
//   port: 5432                      // PostgreSQL default port
// });

// pool.connect((err, client, release) => {
//   if (err) {
//     return console.error('Connection error', err.stack);
//   }
//   console.log('Connected to PostgreSQL');
//   release(); // release the client back to the pool
// });

// module.exports = pool;



pool.connect((err) => {
    if (err) {
        console.error('❌ Database connection failed:', err.message);
    } else {
        console.log('✅ Database connected successfully!');
    }
});

// ✅ Default route
app.get('/', (req, res) => {
    res.send('✅ RFID Race Logger Backend is running!');
});


   
app.post('/api/students', async (req, res) => {
    const { rollNo, name, age, weight, contact, gender, race, academy, studentRole } = req.body;

    if (!rollNo || !name || !age || !weight || !contact || !gender || !race || !academy ||
        (gender === "Male" && race === "100m" && !studentRole)) {
        return res.status(400).json({ error: "All fields including roll number and student role are required." });
    }

    // const query = `
    //     INSERT INTO students (rollNo, name, age, weight, contact, gender, race, academy, studentrole)
    //     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    //     RETURNING rollNo
    // `;

    const query = `
    INSERT INTO students ("rollNo", name, age, weight, contact, gender, race, academy, studentrole)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    RETURNING "rollNo"
`;


    try {
        const result = await pool.query(query, [
            rollNo, name, age, weight, contact, gender, race, academy, studentRole || null,
        ]);

        res.status(201).json({
            message: "Student added successfully!",
            rollNo: result.rows[0].rollNo
        });
    } catch (err) {
        console.error("Insert Error:", err.message);
        res.status(500).json({ error: "Failed to add student." });
    }
});




//MySql 
// app.get('/api/students', (req, res) => {
//     pool.query("SELECT * FROM students ORDER BY id DESC", (err, result) => {
//         if (err) return res.status(500).send("❌ DB error during SELECT");
//         res.json(result);
//     });
// });

app.get('/api/students', (req, res) => {
    pool.query("SELECT * FROM students ORDER BY id DESC", (err, result) => {
        if (err) {
            console.error("DB Error:", err);
            return res.status(500).send("❌ DB error during SELECT");
        }
        res.json(result.rows); // ✅ PostgreSQL returns data in `result.rows`
    });
});


// ✅ POST /api/rfid to handle RFID scans
// app.post('/api/rfid', (req, res) => {
//     console.log("📥 Incoming body:", req.body);
//     const { tag_id } = req.body;

//     if (!tag_id) {
//         return res.status(400).json({ error: "❌ tag_id is required in request body." });
//     }

//     const now = new Date();

//     pool.query(
//         "SELECT * FROM race_logs WHERE tag_id = ? ORDER BY id DESC LIMIT 1",
//         [tag_id],
//         (err, result) => {
//             if (err) return res.status(500).send("❌ DB error during SELECT");

//             if (!result.length || result[0].end_time) {
//                 // First scan or race ended — start new race
//                 pool.query(
//                     "INSERT INTO race_logs (tag_id, start_time) VALUES (?, ?)",
//                     [tag_id, now],
//                     (insertErr) => {
//                         if (insertErr) return res.status(500).send("❌ DB error during INSERT");
//                         res.send("✅ Start time saved");
//                     }
//                 );
//             } else {
//                 // Second scan — update end time
//                 const start = new Date(result[0].start_time);
//                 const duration = Math.round((now - start) / 1000); // in seconds

//                 pool.query(
//                     "UPDATE race_logs SET end_time = ?, duration_seconds = ? WHERE id = ?",
//                     [now, duration, result[0].id],
//                     (updateErr) => {
//                         if (updateErr) return res.status(500).send("❌ DB error during UPDATE");
//                         res.send("✅ End time updated");
//                     }
//                 );
//             }
//         }
//     );
// });



//postgresql code - author:- Siddheshwar Swami : 13/06/2025

app.post('/api/rfid', async (req, res) => {
    console.log("📥 Incoming body:", req.body);
    const { tag_id } = req.body;

    if (!tag_id) {
        return res.status(400).json({ error: "❌ tag_id is required in request body." });
    }

    const now = new Date();

    try {
        const selectResult = await pool.query(
            "SELECT * FROM race_logs WHERE tag_id = $1 ORDER BY id DESC LIMIT 1",
            [tag_id]
        );

        const latestLog = selectResult.rows[0];

        if (!latestLog || latestLog.end_time) {
            // First scan or previous race ended — start new race
            await pool.query(
                "INSERT INTO race_logs (tag_id, start_time) VALUES ($1, $2)",
                [tag_id, now]
            );
            return res.send("✅ Start time saved");
        } else {
            // Second scan — update end time
            const start = new Date(latestLog.start_time);
            const duration = Math.round((now - start) / 1000); // in seconds

            await pool.query(
                "UPDATE race_logs SET end_time = $1, duration_seconds = $2 WHERE id = $3",
                [now, duration, latestLog.id]
            );
            return res.send("✅ End time updated");
        }
    } catch (err) {
        console.error("❌ Error processing RFID:", err);
        return res.status(500).send("❌ Internal server error");
    }
});


// // ✅ GET /api/rfid to fetch all race logs
// app.get('/api/rfid', (req, res) => {
//     pool.query("SELECT * FROM race_logs ORDER BY id DESC", (err, result) => {
//         if (err) return res.status(500).send("❌ DB error during SELECT");
//         res.json(result);
//     });
// });

//author API : Siddheshwar Swami : 13/06/2025
app.get('/api/rfid', async (req, res) => {
    try {
        const result = await pool.query("SELECT * FROM race_logs ORDER BY id DESC");
        res.json(result.rows);
    } catch (err) {
        console.error("❌ DB error during SELECT:", err);
        res.status(500).send("❌ DB error during SELECT");
    }
});



// ✅ GET /api/rfid/{id} to fetch a single race log by ID
// app.get('/api/rfid/:id', (req, res) => {
//     const { id } = req.params;
//     pool.query("SELECT * FROM race_logs WHERE id = ?", [id], (err, result) => {
//         if (err) return res.status(500).send("❌ DB error during SELECT");
//         if (result.length === 0) {
//             return res.status(404).send("❌ Race log not found");
//         }
//         res.json(result[0]);
//     });
// });

//author API : Siddheshwar Swami : 13/06/2025

app.get('/api/rfid/:id', async (req, res) => {
    const { id } = req.params;

    try {
        const result = await pool.query("SELECT * FROM race_logs WHERE id = $1", [id]);

        if (result.rows.length === 0) {
            return res.status(404).send("❌ Race log not found");
        }

        res.json(result.rows[0]);
    } catch (err) {
        console.error("❌ DB error during SELECT:", err);
        res.status(500).send("❌ DB error during SELECT");
    }
});

// ✅ Start server
app.listen(PORT, () => console.log(`🚀 Server running at http://localhost:${PORT}`));
