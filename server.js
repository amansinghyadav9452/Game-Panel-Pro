require("dotenv").config();

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");

const connectDB = require("./config/database");
const createAdmin = require("./services/createAdmin");
const authRoutes = require("./routes/auth");
const dashboardRoutes = require("./routes/dashboard");
const publicRoutes = require("./routes/public");
const connectRoutes = require("./routes/connect");
const errorHandler = require("./middleware/errorHandler");

const app = express();

connectDB().then(() => {

    createAdmin();

});

app.use(express.json());
app.use(express.urlencoded({extended: true}));
app.use(cors());
app.use(helmet());
app.use(morgan("dev"));
app.use(authRoutes);
app.use(dashboardRoutes);
app.use(publicRoutes);
app.use(connectRoutes);
app.use(errorHandler);

app.get("/", (req, res) => {
    res.send("GAME PANEL Backend Running 🚀");
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
});