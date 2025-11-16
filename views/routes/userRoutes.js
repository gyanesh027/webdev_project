const express = require("express");
const router = express.Router();
const bcrypt = require("bcrypt");
const User = require("../../models/User");

// Signup page
router.get("/signup", (req, res) => {
  res.render("signup");
});

// Signup POST
router.post("/signup", async (req, res) => {
  try {
    const { username, password } = req.body;

    // Check if username exists
    const existingUser = await User.findOne({ username });
    if (existingUser) return res.send("Username already taken");

    const hashedPassword = await bcrypt.hash(password, 10);

    await User.create({ username, password: hashedPassword });

    res.redirect("/login");
  } catch (err) {
    console.log(err);
    res.send("Error signing up");
  }
});

// Login page
router.get("/login", (req, res) => {
  res.render("login");
});

// Login POST
router.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body;

    const user = await User.findOne({ username });
    if (!user) return res.send("User not found");

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.send("Wrong password");

    req.session.user = user; // store user session
    res.redirect("/dashboard");
  } catch (err) {
    console.log(err);
    res.send("Error logging in");
  }
});

module.exports = router;
