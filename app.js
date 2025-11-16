
// IMPORTS

const express = require("express");
const path = require("path");
const fs = require("fs");
const ejs = require("ejs");
const { MongoClient } = require("mongodb");
const querystring = require("querystring");


const app = express();
const PORT = 3000;

// Enable POST handlers
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files (same as before)
app.use("/public", express.static(path.join(__dirname, "public")));
app.use("/games", express.static(path.join(__dirname, "games")));

// ------------------------------------------
// MONGO DB
// ------------------------------------------
const uri = "mongodb+srv://gyanesh:gyanesh0987654321@gamestore.ltsolaw.mongodb.net/?appName=gamestore";
const client = new MongoClient(uri);

let usersCollection;

async function connectDB() {
    await client.connect();
    usersCollection = client.db("gameStore").collection("users");
    console.log("MongoDB connected");
}

connectDB();



//EJS rendering (works with Express)
function renderEJS(res, view, data = {}) {
    const filePath = path.join(__dirname, "views", view);
    ejs.renderFile(filePath, data, (err, html) => {
        if (err) return res.status(500).send("EJS Error: " + err.message);
        res.send(html);
    });
}

async function recalcPrice(username) {
    const user = await usersCollection.findOne({ username });
    const cart = user.cart || [];
    let total = cart.reduce((s, i) => s + parseFloat(i.price), 0);
    let final = total;

    if (user.coupon === "SAVE10") final *= 0.9;
    if (user.coupon === "SAVE20") final *= 0.8;
    if (user.coupon === "SAVE50") final *= 0.5;

    await usersCollection.updateOne({ username }, { $set: { price: final } });
    return final;
}

// Current logged in user
function getCurrentUser() {
    return fs.existsSync("currentUser.txt")
        ? fs.readFileSync("currentUser.txt", "utf8").trim()
        : "Guest";
}


// GET ROUTES


app.get("/index", async (req, res) => {
    const username = getCurrentUser();
    const user = await usersCollection.findOne({ username }) || {
        cart: [], library: [], coupon: "", price: 0
    };

    renderEJS(res, "index.ejs", { username, ...user });
});

app.get("/login", (req, res) => renderEJS(res, "login.ejs"));
app.get("/signup", (req, res) => renderEJS(res, "signup.ejs"));

app.get("/cart", async (req, res) => {
    const username = getCurrentUser();
    const user = await usersCollection.findOne({ username }) || {
        cart: [], coupon: "", price: 0
    };
    renderEJS(res, "cart.ejs", { username, ...user });
});

// Userdata
app.get("/userdata", async (req, res) => {
    const username = getCurrentUser();
    const user = await usersCollection.findOne({ username });

    res.json({
        username,
        cart: user?.cart || [],
        library: user?.library || [],
        coupon: user?.coupon || "",
        price: user?.price || 0
    });
});

// Categories
const categories = [
    "action","adventure","horror","indie","multiplayer",
    "puzzle","racing","rpg","shooter","sports","strategy","battleroyale"
];

categories.forEach(cat => {
    app.get("/" + cat, async (req, res) => {
        const username = getCurrentUser();
        const user = await usersCollection.findOne({ username }) || {
            cart: [], coupon: "", price: 0
        };

        const gamesData = JSON.parse(
            fs.readFileSync(path.join(__dirname, "public", "games.json"), "utf8")
        );

        const filtered = gamesData.filter(g => g.category.toLowerCase() === cat);

        renderEJS(res, `${cat}.ejs`, {
            username,
            ...user,
            games: filtered
        });
    });
});

// Serve static HTML from /games
app.get("/games/:file", (req, res) => {
    const file = path.join(__dirname, "games", req.params.file);
    if (fs.existsSync(file)) return res.sendFile(file);
    res.status(404).send("Not Found");
});

// POST ROUTES


// Signup
app.post("/signup", async (req, res) => {
    const { username, password } = req.body;

    if (await usersCollection.findOne({ username })) {
        return res.send("Username already exists");
    }

    await usersCollection.insertOne({
        username, password, cart: [], library: [], coupon: "", price: 0
    });

    fs.writeFileSync("currentUser.txt", username);
    res.redirect("/");
});

// Login
app.post("/login", async (req, res) => {
    const { username, password } = req.body;

    if (await usersCollection.findOne({ username, password })) {
        fs.writeFileSync("currentUser.txt", username);
        return res.redirect("/");
    }

    res.send("Invalid credentials");
});

// Add to cart
app.post("/add-to-cart", async (req, res) => {
    const username = getCurrentUser();
    const { title, price, image } = req.body;

    const user = await usersCollection.findOne({ username });
    const updated = [...user.cart, { title, price: parseFloat(price), image }];

    await usersCollection.updateOne({ username }, { $set: { cart: updated } });
    const newTotal = await recalcPrice(username);

    res.json({ success: true, newTotal });
});

// Remove cart item
app.post("/remove-from-cart", async (req, res) => {
    const username = getCurrentUser();
    const { title } = req.body;

    const user = await usersCollection.findOne({ username });
    const updated = user.cart.filter(i => i.title !== title);

    await usersCollection.updateOne({ username }, { $set: { cart: updated } });
    await recalcPrice(username);

    res.json({ success: true });
});

// Apply coupon
app.post("/apply-coupon", async (req, res) => {
    const username = getCurrentUser();
    const { code } = req.body;

    const valid = ["SAVE10", "SAVE20", "SAVE50"];
    if (!valid.includes(code)) {
        return res.json({ success: false, message: "Invalid coupon" });
    }

    await usersCollection.updateOne({ username }, { $set: { coupon: code } });
    const newTotal = await recalcPrice(username);

    res.json({ success: true, newTotal });
});

// Remove coupon
app.post("/remove-coupon", async (req, res) => {
    const username = getCurrentUser();
    await usersCollection.updateOne({ username }, { $set: { coupon: "" } });

    const newTotal = await recalcPrice(username);
    res.json({ success: true, newTotal });
});

// ------------------------------------------
// 404
// ------------------------------------------
app.use((req, res) => res.status(404).send("404 Not Found"));

// ------------------------------------------
// START SERVER
// ------------------------------------------
app.listen(PORT, () =>
    console.log(`Server running on http://localhost:${PORT}`)
);

