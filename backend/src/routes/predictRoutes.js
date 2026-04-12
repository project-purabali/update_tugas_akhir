const express = require("express");
const router = express.Router();
const predictController = require("../controllers/predictController");

// Endpoint untuk menerima gambar dan melakukan prediksi
router.post("/", predictController.handlePrediction);

module.exports = router; 