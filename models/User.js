const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  cart: { type: Array, default: [] },
  library: { type: Array, default: [] },
});

module.exports = mongoose.model("User", userSchema);
