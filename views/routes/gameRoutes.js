const express = require("express");
const User = require("../models/User");
const Game = require("../models/game");
const router = express.Router();

// All games
router.get("/", async (req, res) => {
  const games = await Game.find();
  res.render("games", { games });
});

// Add to cart
router.post("/add/:id", async (req, res) => {
  if (!req.session.user) return res.redirect("/login");

  const user = await User.findById(req.session.user._id);
  const game = await Game.findById(req.params.id);

  if (user.cart[0] === "none") user.cart = [];

  user.cart.push(game);
  await user.save();

  res.redirect("/games");
});

// Cart page
router.get("/cart", async (req, res) => {
  const user = await User.findById(req.session.user._id);
  const cart = user.cart[0] === "none" ? [] : user.cart;

  res.render("cart", { cart });
});

// Buy games
router.post("/buy", async (req, res) => {
  const user = await User.findById(req.session.user._id);

  if (user.library[0] === "none") user.library = [];
  if (user.cart[0] !== "none") {
    user.library.push(...user.cart);
    user.cart = ["none"];
  }

  await user.save();
  res.redirect("/library");
});

// Library
router.get("/library", async (req, res) => {
  const user = await User.findById(req.session.user._id);
  const library = user.library[0] === "none" ? [] : user.library;

  res.render("library", { games: library });
});

module.exports = router;
