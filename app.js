const http = require("http");
const url = require("url");
const fs = require("fs");
const path = require("path");
const ejs = require("ejs");
const { MongoClient } = require("mongodb");
const querystring = require("querystring");

// MongoDB setup
const uri = "mongodb+srv://user:pass@gamestore.ltsolaw.mongodb.net/?appName=gamestore";
const client = new MongoClient(uri);
let usersCollection;
const publicPath = path.join(__dirname, "public");


async function connectDB() {
  await client.connect();
  const db = client.db("gameStore");
  usersCollection = db.collection("users");
}

// Recalculate price based on cart + coupon
async function recalcPrice(username) {
  const user = await usersCollection.findOne({ username });
  const cart = user.cart || [];
  let totalPrice = cart.reduce((sum, item) => sum + parseFloat(item.price), 0);
  let finalPrice = totalPrice;

  if (user.coupon === "SAVE10") finalPrice *= 0.9;
  else if (user.coupon === "SAVE20") finalPrice *= 0.8;
  else if (user.coupon === "SAVE50") finalPrice *= 0.5;

  await usersCollection.updateOne({ username }, { $set: { price: finalPrice } });
  return finalPrice;
}

// Render EJS
function renderEJS(res, fileName, data = {}) {
  const filePath = path.join(__dirname, "views", fileName);
  ejs.renderFile(filePath, data, (err, str) => {
    if (err) {
      res.writeHead(500, { "Content-Type": "text/plain" });
      res.end("EJS Render Error: " + err.message);
    } else {
      res.writeHead(200, { "Content-Type": "text/html" });
      res.end(str);
    }
  });
}

// Serve static files
function serveStatic(res, filePath) {
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { "Content-Type": "text/plain" });
      res.end("404 Not Found");
      return;
    }
    let contentType = "text/html";
    if (filePath.endsWith(".css")) contentType = "text/css";
    else if (filePath.endsWith(".js")) contentType = "application/javascript";
    else if (filePath.endsWith(".png")) contentType = "image/png";
    else if (filePath.endsWith(".jpg") || filePath.endsWith(".jpeg")) contentType = "image/jpeg";
    else if (filePath.endsWith(".ico")) contentType = "image/x-icon";
    res.writeHead(200, { "Content-Type": contentType });
    res.end(data);
  });
}

// Server
const server = http.createServer(async (req, res) => {
  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;

  // Get current user
  const username = fs.existsSync("currentUser.txt")
    ? fs.readFileSync("currentUser.txt", "utf-8").trim()
    : "Guest";

  // ---------------- GET ROUTES ----------------
  if (pathname.startsWith("/public/")) {
    const filePath = path.join(publicPath, pathname.replace("/public/", ""));
    if (fs.existsSync(filePath)) {
        serveStatic(res, filePath);
        return;
    }
}
  if (req.method === "GET") {
    try {
      // Home / index
      if (pathname === "/" || pathname === "/index.ejs") {
        const user = await usersCollection.findOne({ username }) || { cart: [], library: [], coupon: "", price: 0 };
        renderEJS(res, "index.ejs", {
          username,
          cart: user.cart,
          library: user.library,
          coupon: user.coupon,
          price: user.price
        });
        return;
      }

      // Login / Signup
      if (pathname === "/login") { renderEJS(res, "login.ejs"); return; }
      if (pathname === "/signup") { renderEJS(res, "signup.ejs"); return; }

      // Cart page
      if (pathname === "/cart") {
        const user = await usersCollection.findOne({ username }) || { cart: [], coupon: "", price: 0 };
        renderEJS(res, "cart.ejs", {
          username,
          cart: user.cart,
          coupon: user.coupon,
          price: user.price
        });
        return;
      }

      // Userdata JSON
      if (pathname === "/userdata") {
        const user = await usersCollection.findOne({ username });
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({
          username,
          cart: user?.cart || [],
          library: user?.library || [],
          coupon: user?.coupon || "",
          price: user?.price || 0
        }));
        return;
      }

      // Categories (example: action, adventure, etc.)
      const categories = ["action","adventure","horror","indie","multiplayer","puzzle","racing","rpg","shooter","sports","strategy","battleroyale"];
      if (categories.includes(pathname.slice(1))) {
        const category = pathname.slice(1); // remove leading /
        const user = await usersCollection.findOne({ username }) || { cart: [], coupon: "", price: 0 };
        const gamesData = fs.readFileSync(path.join(__dirname, "public", "games.json"), "utf-8");
        const allGames = JSON.parse(gamesData);
        const filteredGames = allGames.filter(game => game.category.toLowerCase() === category.toLowerCase());
        renderEJS(res, `${category}.ejs`, {
          username,
          cart: user.cart,
          coupon: user.coupon,
          price: user.price,
          games: filteredGames
        });
        return;
      }

      // ---------------- Direct static HTML pages ----------------
      if (pathname === "/lastofus2.html") {
        serveStatic(res, path.join(__dirname, "games", "lastofus2.html"));
        return;
      }

      // Serve other static files
      const staticFile = path.join(__dirname, "games", pathname);
      if (fs.existsSync(staticFile)) {
        serveStatic(res, staticFile);
        return;
      }

      // Not found
      res.writeHead(404, { "Content-Type": "text/plain" });
      res.end("404 Not Found");

    } catch (err) {
      res.writeHead(500, { "Content-Type": "text/plain" });
      res.end("Server Error: " + err.message);
    }
  }

  // ---------------- POST ROUTES ----------------
  if (req.method === "POST") {
    let body = "";
    req.on("data", chunk => body += chunk.toString());
    req.on("end", async () => {
      let data;
      try { data = JSON.parse(body); } catch { data = querystring.parse(body); }

      const username = data.username || (fs.existsSync("currentUser.txt") ? fs.readFileSync("currentUser.txt","utf-8").trim() : "Guest");
      const password = data.password;

      // Signup
      if (pathname === "/signup") {
        const existingUser = await usersCollection.findOne({ username });
        if (existingUser) {
          res.writeHead(200, { "Content-Type": "text/plain" });
          res.end("Username already exists");
        } else {
          await usersCollection.insertOne({ username, password, cart: [], library: [], coupon: "", price: 0 });
          fs.writeFileSync("currentUser.txt", username);
          res.writeHead(302, { "Location": "/" });
          res.end();
        }
        return;
      }

      // Login
      if (pathname === "/login") {
        const user = await usersCollection.findOne({ username, password });
        if (user) {
          fs.writeFileSync("currentUser.txt", username);
          res.writeHead(302, { "Location": "/" });
          res.end();
        } else {
          res.writeHead(200, { "Content-Type": "text/plain" });
          res.end("Invalid credentials");
        }
        return;
      }

      // ----------- Cart / Coupon POST ROUTES -----------

      // Add to Cart
      if (pathname === "/add-to-cart") {
        const { title, price, image } = data;
        if (!title || !price) {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ success: false, message: "Title and price required" }));
          return;
        }
        const user = await usersCollection.findOne({ username });
        if (user) {
          const newItem = { title, price: parseFloat(price), image: image || "" };
          const updatedCart = [...(user.cart || []), newItem];
          await usersCollection.updateOne({ username }, { $set: { cart: updatedCart } });
          const newTotal = await recalcPrice(username);
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ success: true, newTotal }));
        } else {
          res.writeHead(404, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ success: false, message: "User not found" }));
        }
        return;
      }

      // Remove item from cart
      if (pathname === "/remove-from-cart") {
        const title = data.title;
        const user = await usersCollection.findOne({ username });
        if (user) {
          const updatedCart = user.cart.filter(item => item.title !== title);
          await usersCollection.updateOne({ username }, { $set: { cart: updatedCart } });
          await recalcPrice(username);
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ success: true }));
        }
        return;
      }

      // Apply coupon
      if (pathname === "/apply-coupon") {
        const code = data.code;
        const validCoupons = ["SAVE10","SAVE20","SAVE50"];
        if (!validCoupons.includes(code)) {
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ success: false, message: "Invalid coupon" }));
          return;
        }
        await usersCollection.updateOne({ username }, { $set: { coupon: code } });
        const newTotal = await recalcPrice(username);
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: true, newTotal }));
        return;
      }

      // Remove coupon
      if (pathname === "/remove-coupon") {
        await usersCollection.updateOne({ username }, { $set: { coupon: "" } });
        const newTotal = await recalcPrice(username);
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: true, newTotal }));
        return;
      }

    });
  }

});

// Start server
async function startServer() {
  try {
    await connectDB();
    console.log("MongoDB connected");
    server.listen(3000, () => console.log("Server running at http://localhost:3000"));
  } catch (err) {
    console.error("Failed to connect to MongoDB", err);
  }
}

startServer();

