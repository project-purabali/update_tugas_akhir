const classData = require("../data/classData");
const { spawn } = require("child_process");
const path = require("path");
const fs = require("fs");
const multer = require("multer");
const sharp = require("sharp");

// ================== PATH CONFIG ==================
const ROOT_DIR = path.resolve(__dirname, "../../../");
const PYTHON_SCRIPT = path.join(ROOT_DIR, "ml", "detect.py");
const UPLOAD_DIR = path.resolve(__dirname, "../../uploads");

// DEBUG
console.log("ROOT_DIR:", ROOT_DIR);
console.log("PYTHON_SCRIPT:", PYTHON_SCRIPT);
console.log("UPLOAD_DIR:", UPLOAD_DIR);

// ================== MULTER SETUP ==================
if (!fs.existsSync(UPLOAD_DIR)) {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, UPLOAD_DIR),
    filename: (req, file, cb) => {
        const unique = Date.now() + "-" + Math.round(Math.random() * 1e9);
        cb(null, unique + path.extname(file.originalname));
    }
});

const uploadAny = multer({
    storage,
    limits: { fileSize: 10 * 1024 * 1024 }
}).any();

// ================== HELPER: Mencocokkan nama kelas dengan key di classData ==================
function findClassKey(className) {
    const normalized = className.toLowerCase();
    for (const key in classData) {
        if (normalized.includes(key.toLowerCase()) || key.toLowerCase().includes(normalized)) {
            return key;
        }
    }
    return null;
}

// ================== HELPER: Escape HTML ==================
function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>]/g, function(m) {
        if (m === '&') return '&amp;';
        if (m === '<') return '&lt;';
        if (m === '>') return '&gt;';
        return m;
    });
}

// ================== MAIN FUNCTION ==================
exports.handlePrediction = (req, res) => {
    uploadAny(req, res, async (err) => {
        if (err) {
            return res.status(500).json({
                message: "Gagal upload gambar",
                error: err.message
            });
        }

        if (!req.files || req.files.length === 0) {
            return res.status(400).json({
                message: "Tidak ada gambar yang dikirim"
            });
        }

        req.file = req.files[0];

        const imagePath = req.file.path;
        const resizedPath = path.join(UPLOAD_DIR, "resized_" + req.file.filename);
        const outputPath = path.join(UPLOAD_DIR, "detected_" + req.file.filename);

        try {
            // ================== RESIZE ==================
            await sharp(imagePath)
                .resize({
                    width: 1280,
                    height: 1280,
                    fit: "inside",
                    withoutEnlargement: true
                })
                .jpeg({ quality: 80 })
                .toFile(resizedPath);

            console.log("Resize OK:", resizedPath);

            // ================== VALIDASI FILE ==================
            if (!fs.existsSync(PYTHON_SCRIPT)) {
                console.error("❌ detect.py tidak ditemukan:", PYTHON_SCRIPT);
                return res.status(500).json({
                    message: "detect.py tidak ditemukan",
                    path: PYTHON_SCRIPT
                });
            }

            // ================== RUN PYTHON ==================
            const py = spawn("python", [PYTHON_SCRIPT, resizedPath, outputPath]);

            let result = "";
            let error = "";

            py.stdout.on("data", (data) => {
                result += data.toString();
            });

            py.stderr.on("data", (data) => {
                error += data.toString();
                console.error("PYTHON ERROR:", data.toString());
            });

            py.on("close", (code) => {
                console.log("Python exit code:", code);

                // hapus file resize
                if (fs.existsSync(resizedPath)) {
                    fs.unlinkSync(resizedPath);
                }

                if (code !== 0) {
                    return res.status(500).json({
                        message: "Gagal menjalankan AI",
                        details: error
                    });
                }

                try {
                    const parsed = JSON.parse(result);

                    if (parsed.error) {
                        return res.status(500).json(parsed);
                    }

                    // ================== MEMBUAT DESKRIPSI RAPI DENGAN CARD ==================
                    const detections = parsed.selected_detections || [];
                    const lang = req.headers["accept-language"] === "en" ? "en" : "id";
                    let descriptionHtml = "";

                    if (detections.length === 0) {
                        descriptionHtml = `<div class="empty-state">
                            <div class="empty-state-icon">🔍</div>
                            <div class="empty-state-title">Tidak ada objek terdeteksi</div>
                            <div class="empty-state-description">Coba gunakan gambar lain dengan pencahayaan lebih baik.</div>
                        </div>`;
                    } else {
                        const items = [];
                        for (let i = 0; i < detections.length; i++) {
                            const det = detections[i];
                            const confidencePercent = (det.confidence * 100).toFixed(2);
                            const classKey = findClassKey(det.class_name);
                            
                            let deskripsiText = "";
                            let fungsiText = "";
                            
                            if (classKey && classData[classKey]) {
                                const dataClass = classData[classKey];
                                deskripsiText = dataClass.deskripsi[lang] || dataClass.deskripsi.id;
                                fungsiText = dataClass.fungsi[lang] || dataClass.fungsi.id;
                            } else {
                                deskripsiText = `Terdeteksi: ${det.class_name}`;
                                fungsiText = "Informasi tidak tersedia";
                            }
                            
                            const itemHtml = `
<div class="detection-card">
    <div class="detection-header">
        <div class="detection-number">${i+1}</div>
        <div class="detection-title">${escapeHtml(det.class_name)}</div>
    </div>
    <div class="detection-body">
        <div class="detection-description">
            <div class="icon">📜</div>
            <p>${escapeHtml(deskripsiText)}</p>
        </div>
        <div class="detection-function">
            <div class="icon">⚙️</div>
            <div>
                <strong>Fungsi:</strong>
                <p>${escapeHtml(fungsiText)}</p>
            </div>
<div class="detection-confidence">
    <div class="confidence-header">
        <span>🔬</span> 
        <span>Tingkat Kepercayaan : ${confidencePercent}%</span>
    </div>
    <div class="confidence-bar-container">
        <div class="confidence-bar" style="width: ${confidencePercent}%; background: linear-gradient(90deg, #40c057, #69db7c);"></div>
    </div>
</div>
    </div>
</div>`;
                            items.push(itemHtml);
                        }
                        descriptionHtml = items.join("");
                    }

                    // Simpan deskripsi dan label ke parsed
                    parsed.description = descriptionHtml;
                    parsed.bangunan_label = detections.map(d => d.class_name).join(", ");

                    // ================== RESPONSE ==================
                    return res.json({
                        success: true,
                        description: parsed.description,
                        bangunan_label: parsed.bangunan_label,
                        image: `/uploads/${path.basename(outputPath)}`,
                        rawData: parsed
                    });

                } catch (e) {
                    console.error("JSON ERROR:", result);
                    return res.status(500).json({
                        message: "Output Python tidak valid",
                        raw: result
                    });
                }
            });

        } catch (err) {
            console.error("PROCESS ERROR:", err);
            return res.status(500).json({
                message: "Gagal memproses gambar",
                error: err.message
            });
        }
    });
};