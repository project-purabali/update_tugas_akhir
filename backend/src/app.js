const express = require("express");
const path = require("path");
const predictRoutes = require("./routes/predictRoutes");

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Sajikan file statis dari folder frontend (opsional, jika backend yang serve frontend)
const frontendPath = path.join(__dirname, "../../frontend");
app.use(express.static(frontendPath));

// Sajikan folder uploads agar bisa diakses browser
app.use('/uploads', express.static(path.join(__dirname, "../uploads")));

app.use("/api/predict", predictRoutes);

module.exports = app;