const express = require("express");
const pool = require("../db");
const { auth } = require("../middleware/auth");
const { asyncH } = require("../lib/helpers");

const router = express.Router();

const ROLES = ["manufacturer", "distributor", "pharmacist", "customer"];

// /api/directory?role=distributor  -> partner accounts for selection
router.get(
  "/",
  auth,
  asyncH(async (req, res) => {
    const role = req.query.role;
    if (!ROLES.includes(role)) {
      return res.status(400).json({ message: "Unknown role" });
    }
    const { rows } = await pool.query(
      `SELECT id, name, email, role, org_name, address, phone
         FROM users WHERE role = $1 ORDER BY name ASC`,
      [role]
    );
    res.json({ users: rows });
  })
);

module.exports = router;
