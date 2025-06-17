// author : Siddheshwar Swami
// Version : 2.1
// Date : 17/06/25

import express from "express";
import cors from "cors";
import pkg from "pg";
import dotenv from "dotenv";

dotenv.config();

const { Pool } = pkg;
const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors({ origin: "*", credentials: true }));
app.use(express.json());

const pool = new Pool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: 5432,
  ssl: {
    rejectUnauthorized: false,
  },
});

pool.connect((err) => {
  if (err) {
    console.error("❌ Database connection failed:", err.message);
  } else {
    console.log("✅ Database connected successfully!");
  }
});

// ✅ Health check
app.get("/", (req, res) => {
  res.send("✅ RFID Race Logger Backend is running!");
});

// ✅ Add new student
app.post("/api/students", async (req, res) => {
  const {
    rollNo,
    name,
    age,
    weight,
    contact,
    gender,
    race,
    academy,
    studentRole,
  } = req.body;

  if (
    !rollNo ||
    !name ||
    !age ||
    !weight ||
    !contact ||
    !gender ||
    !race ||
    !academy ||
    (gender === "Male" && race === "100m" && !studentRole)
  ) {
    return res.status(400).json({
      error: "All fields including roll number and student role are required.",
    });
  }

  const query = `
    INSERT INTO students ("rollNo", name, age, weight, contact, gender, race, academy, studentrole)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    RETURNING "rollNo"
  `;

  try {
    const result = await pool.query(query, [
      rollNo,
      name,
      age,
      weight,
      contact,
      gender,
      race,
      academy,
      studentRole || null,
    ]);

    res.status(201).json({
      message: "✅ Student added successfully!",
      rollNo: result.rows[0].rollNo,
    });
  } catch (err) {
    console.error("❌ Insert Error:", err);
    res.status(500).json({ error: err.message });
  }
});

// ✅ Get all students
app.get("/api/students", async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM students ORDER BY id DESC");
    res.json(result.rows);
  } catch (err) {
    console.error("❌ DB Error:", err);
    res.status(500).send("❌ DB error during SELECT");
  }
});

// ✅ Handle RFID scan
app.post("/api/rfid", async (req, res) => {
  console.log("📥 Incoming body:", req.body);
  const { tag_id } = req.body;

  if (!tag_id) {
    return res
      .status(400)
      .json({ error: "❌ tag_id is required in request body." });
  }

  const now = new Date();

  try {
    const selectResult = await pool.query(
      "SELECT * FROM race_logs WHERE tag_id = $1 ORDER BY id DESC LIMIT 1",
      [tag_id]
    );

    const latestLog = selectResult.rows[0];

    if (!latestLog || latestLog.end_time) {
      await pool.query(
        "INSERT INTO race_logs (tag_id, start_time) VALUES ($1, $2)",
        [tag_id, now]
      );
      return res.send("✅ Start time saved");
    } else {
      const start = new Date(latestLog.start_time);
      const duration = Math.round((now - start) / 1000);

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

// ✅ Get all race logs
app.get("/api/rfid", async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM race_logs ORDER BY id DESC");
    res.json(result.rows);
  } catch (err) {
    console.error("❌ DB error during SELECT:", err);
    res.status(500).send("❌ DB error during SELECT");
  }
});

// ✅ Get single race log by ID
app.get("/api/rfid/:id", async (req, res) => {
  const { id } = req.params;

  try {
    const result = await pool.query("SELECT * FROM race_logs WHERE id = $1", [
      id,
    ]);

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
app.listen(PORT, () =>
  console.log(`🚀 Server running at http://localhost:${PORT}`)
);
