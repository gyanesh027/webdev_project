const mongoose = require("mongoose");

const GameSchema = new mongoose.Schema({
  title: String,
  price: Number,
  image: String,
  description: String
});

module.exports = mongoose.model("Game", GameSchema);
