
const express = require("express");
const router = express.Router();

const {
  register,
  login,
  me,
} = require("../controller/auth.controller");

const  authenticateToken  = require("../middleware/auth.middleware");

router.post("/register", register);

router.post("/login", login);

router.get("/verify", authenticateToken, (req, res) => res.status(200).json({ user: req.user }));
router.get("/me", authenticateToken, me);

module.exports = router;
