// testMongo.js
const mongoose = require("mongoose");

mongoose.connect("mongodb+srv://gyanesh:gyanesh0987654321@gamestore.ltsolaw.mongodb.net/?appName=gamestore")
  .then(() => {
    console.log("MongoDB connected");
    process.exit();
  })
  .catch(err => {
    console.log("Connection error:", err);
    process.exit();
  });
