const express = require("express");
const bcrypt = require("bcryptjs");
const pool = require("../db");
const { sign, auth } = require("../middleware/auth");
const { asyncH } = require("../lib/helpers");

const router = express.Router();

const PUBLIC_ROLES = ["manufacturer", "distributor", "pharmacist", "customer"];

// Register (admin accounts are seeded, never self-registered)
router.post(
  "/register",
  asyncH(async (req, res) => {
    const { name, email, password, role, phone, address, org_name, license_no } = req.body;

    if (!name || !email || !password || !role) {
      return res.status(400).json({ message: "Name, email, password and role are required" });
    }
    if (!PUBLIC_ROLES.includes(role)) {
      return res.status(400).json({ message: "Invalid account type" });
    }
    if (password.length < 6) {
      return res.status(400).json({ message: "Password must be at least 6 characters" });
    }

    const existing = await pool.query("SELECT id FROM users WHERE email = $1", [email.toLowerCase()]);
    if (existing.rows.length) {
      return res.status(400).json({ message: "Email already registered" });
    }

    const hashed = await bcrypt.hash(password, 10);
    const result = await pool.query(
      `INSERT INTO users (name, email, password, role, phone, address, org_name, license_no)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       RETURNING id, name, email, role, org_name`,
      [name, email.toLowerCase(), hashed, role, phone || null, address || null, org_name || null, license_no || null]
    );

    const user = result.rows[0];
    res.status(201).json({ message: "Registration successful", token: sign(user), user });
  })
);

// Login
router.post(
  "/login",
  asyncH(async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required" });
    }

    const result = await pool.query("SELECT * FROM users WHERE email = $1", [email.toLowerCase()]);
    if (!result.rows.length) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    const user = result.rows[0];
    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    res.json({
      message: "Login successful",
      token: sign(user),
      user: { id: user.id, name: user.name, email: user.email, role: user.role, org_name: user.org_name },
    });
  })
);

// Current session
router.get(
  "/me",
  auth,
  asyncH(async (req, res) => {
    const { rows } = await pool.query(
      "SELECT id, name, email, role, phone, address, org_name, license_no FROM users WHERE id = $1",
      [req.user.id]
    );
    if (!rows.length) return res.status(404).json({ message: "User not found" });
    res.json({ user: rows[0] });
  })
);

module.exports = router;
