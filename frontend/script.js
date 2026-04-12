const fileInput = document.getElementById('file-input');
const cameraInput = document.getElementById('camera-input');
const previewImage = document.getElementById('preview-image');
const processBtn = document.getElementById('process-btn');
const cameraBtn = document.getElementById('camera-btn');
const fileBtn = document.getElementById('file-btn');
const outputContainer = document.getElementById('output-container');
const resultImage = document.getElementById('result-image');
const resultText = document.getElementById('result-text');
const imageLoading = document.getElementById('image-loading');
const resultContent = document.querySelector('.result-content');
const imagePlaceholder = document.querySelector('.image-placeholder');
const container = document.querySelector('.container');

// ============================================
// MODAL ELEMENTS
// ============================================
const modal = document.getElementById('image-modal');
const modalImage = document.getElementById('modal-image');
const modalLoading = document.getElementById('modal-loading');
const closeModalBtns = document.querySelectorAll('#close-modal, #close-modal-2');
const downloadBtn = document.getElementById('download-btn');

// Variabel untuk zoom
let currentScale = 1;
const zoomStep = 0.2;

// ============================================
// GLOBAL VARIABLES FOR DETECTION DATA
// ============================================
let lastDetectionData = null; // Menyimpan data hasil deteksi terakhir
let currentImageFile = null; // Menyimpan file gambar terakhir

// ============================================
// TRANSLATIONS AND LANGUAGE MANAGEMENT
// ============================================
const translations = {
    id: {
        // Header
        appTitle: "Deteksi Pelinggih Batukaru",
        appSubtitle: "Sistem Deteksi Pelinggih Berbasis Citra",
        currentLanguage: "Indonesia",
        indonesianText: "Indonesia",
        englishText: "English",
        
        // Input Section
        inputTitle: "Input Gambar",
        imagePlaceholder: "Pilih gambar untuk memulai deteksi",
        cameraButton: "Kamera",
        fileButton: "Gambar",
        detectButton: "Deteksi Sekarang",
        
        // Output Section
        outputTitle: "Output Deteksi",
        resultLabel: "Hasil Deteksi:",
        analyzingText: "Sedang menganalisis gambar...",
        clickHint: "Klik gambar untuk memperbesar",
        descriptionLabel: "Keterangan:",
        descriptionPlaceholder: "Hasil deskripsi akan muncul di sini setelah proses deteksi selesai.",
        
        // Modal
        modalTitle: "Hasil Deteksi Detail",
        loadingImage: "Memuat gambar...",
        downloadButton: "Unduh Gambar",
        closeButton: "Tutup",
        
        // Footer
        footerText: "© 2026 Deteksi Pelinggih Batukaru | Data Primer Pura Luhur Batukaru",
        
        // Alerts and Messages
        noImageAlert: "Silakan pilih gambar terlebih dahulu!",
        invalidFileAlert: "Silakan pilih file gambar yang valid (JPEG, PNG, GIF, BMP, WebP)",
        cameraPrompt: "Di desktop, Anda dapat:\n1. OK: Menggunakan kamera webcam\n2. Cancel: Mengunggah file gambar\n\nKlik OK untuk menggunakan kamera, atau Cancel untuk mengunggah file.",
        noDownloadAlert: "Tidak ada gambar yang tersedia untuk diunduh.",
        loadingError: "Gagal memuat gambar. URL tidak valid.",
        serverError: "Terjadi kesalahan pada server",
        detectionComplete: "Deteksi Selesai",
        detectionFailed: "Deteksi Gagal",
        translateMessage: "Menerjemahkan hasil..."
    },
    en: {
        // Header
        appTitle: "Batukaru Shrine Detection",
        appSubtitle: "Image-Based Shrine Detection System",
        currentLanguage: "English",
        indonesianText: "Indonesia",
        englishText: "English",
        
        // Input Section
        inputTitle: "Image Input",
        imagePlaceholder: "Select an image to start detection",
        cameraButton: "Camera",
        fileButton: "Image",
        detectButton: "Detect Now",
        
        // Output Section
        outputTitle: "Detection Output",
        resultLabel: "Detection Result:",
        analyzingText: "Analyzing image...",
        clickHint: "Click image to enlarge",
        descriptionLabel: "Description:",
        descriptionPlaceholder: "Description result will appear here after the detection process is complete.",
        
        // Modal
        modalTitle: "Detailed Detection Result",
        loadingImage: "Loading image...",
        downloadButton: "Download Image",
        closeButton: "Close",
        
        // Footer
        footerText: "© 2026 Batukaru Shrine Detection | Primary Data of Pura Luhur Batukaru",
        
        // Alerts and Messages
        noImageAlert: "Please select an image first!",
        invalidFileAlert: "Please select a valid image file (JPEG, PNG, GIF, BMP, WebP)",
        cameraPrompt: "On desktop, you can:\n1. OK: Use webcam camera\n2. Cancel: Upload image file\n\nClick OK to use camera, or Cancel to upload file.",
        noDownloadAlert: "No image available for download.",
        loadingError: "Failed to load image. Invalid URL.",
        serverError: "An error occurred on the server",
        detectionComplete: "Detection Complete",
        detectionFailed: "Detection Failed",
        translateMessage: "Translating results..."
    }
};

let currentLang = localStorage.getItem('appLanguage') || 'id';
const languageSelector = document.querySelector('.language-selector');
const currentLanguage = document.getElementById('current-language');
const languageDropdown = document.getElementById('language-dropdown');

// Initialize language
function initLanguage() {
    // Update all elements with data-i18n attributes
    document.querySelectorAll('[data-i18n]').forEach(element => {
        const key = element.getAttribute('data-i18n');
        if (translations[currentLang][key]) {
            element.textContent = translations[currentLang][key];
        }
    });
    
    // Update language selector display
    const flag = currentLang === 'id' ? '' : '';
    const text = currentLang === 'id' ? 'Indonesia' : 'English';
    
    currentLanguage.innerHTML = `
        <span class="language-flag">${flag}</span>
        <span class="language-text">${text}</span>
        <span class="language-arrow">▼</span>
    `;
    
    // Set HTML lang attribute
    document.documentElement.lang = currentLang;
    
    // Update button texts
    updateButtonTexts();
    
    // Jika ada hasil deteksi sebelumnya, translate ulang
    if (lastDetectionData && outputContainer.style.display !== 'none') {
        translateExistingResults();
    }
}

// Fungsi untuk mentranslate hasil deteksi yang sudah ada
async function translateExistingResults() {
    if (!lastDetectionData || !currentImageFile) return;
    
    // Tampilkan pesan translating
    resultText.innerHTML = `<div class="loading-container"><span class="loading"></span><span class="loading-text">${translations[currentLang].translateMessage}</span></div>`;
    
    try {
        const formData = new FormData();
        formData.append('image', currentImageFile, currentImageFile.name);
        formData.append('source', 'translate');
        
        const response = await fetch('/api/predict', {
            method: 'POST',
            body: formData,
            headers: {
                'Accept-Language': currentLang
            }
        });
        
        const data = await response.json();
        
        if (response.ok) {
            // Simpan data deteksi terbaru
            lastDetectionData = data;
            
            // Tampilkan deskripsi dalam bahasa yang baru (Disederhanakan)
            let description = data.description || data.data?.description || data.message || 'Deskripsi tidak tersedia';
            resultText.innerHTML = description;
            
        } else {
            throw new Error(data.message || translations[currentLang].serverError);
        }
    } catch (error) {
        console.error('Translation error:', error);
        resultText.innerHTML = `<div class="error-message">${translations[currentLang].serverError}: ${error.message}</div>`;
    }
}

// Update all button texts based on current language
function updateButtonTexts() {
    // Camera button
    const cameraText = translations[currentLang].cameraButton;
    cameraBtn.querySelector('.btn-text').textContent = cameraText;
    
    // File button
    const fileText = translations[currentLang].fileButton;
    fileBtn.querySelector('.btn-text').textContent = fileText;
    
    // Process button
    if (processBtn.style.display !== 'none') {
        const detectText = translations[currentLang].detectButton;
        processBtn.querySelector('.btn-text').textContent = detectText;
    }
}

// Toggle language dropdown
currentLanguage.addEventListener('click', (e) => {
    e.stopPropagation();
    languageSelector.classList.toggle('active');
});

// Close dropdown when clicking outside
document.addEventListener('click', (e) => {
    if (!languageSelector.contains(e.target)) {
        languageSelector.classList.remove('active');
    }
});

// Handle language selection
languageDropdown.addEventListener('click', (e) => {
    const option = e.target.closest('.language-option');
    if (option) {
        const lang = option.getAttribute('data-lang');
        if (lang && lang !== currentLang) {
            currentLang = lang;
            localStorage.setItem('appLanguage', lang);
            initLanguage();
            languageSelector.classList.remove('active');
        }
    }
});

// ============================================
// FUNGSI UTAMA
// ============================================

// Fungsi untuk membuka kamera
function openCamera() {
    cameraInput.value = '';
    
    if (/Android|iPhone|iPad|iPod/i.test(navigator.userAgent)) {
        cameraInput.accept = "image/*";
        cameraInput.capture = "environment";
        cameraInput.click();
    } else {
        const useCamera = confirm(translations[currentLang].cameraPrompt);
        if (useCamera) {
            cameraInput.accept = "image/*";
            cameraInput.removeAttribute("capture");
            cameraInput.click();
        } else {
            openFileSelector();
        }
    }
}

// Fungsi untuk membuka pemilih file
function openFileSelector() {
    fileInput.click();
}

// Fungsi untuk menangani pemilihan file dari input file (upload gambar)
function handleFileSelect(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/bmp', 'image/webp'];
    
    if (!allowedTypes.includes(file.type.toLowerCase())) {
        alert(translations[currentLang].invalidFileAlert);
        event.target.value = '';
        return;
    }
    
    processSelectedFile(file, event.target.id);
}

// Fungsi untuk menangani pemilihan dari kamera
function handleCameraSelect(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    processSelectedFile(file, 'camera');
}

// Fungsi untuk memproses file yang dipilih
function processSelectedFile(file, source) {
    if (file && file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = function(e) {
            previewImage.src = e.target.result;
            previewImage.classList.add('active');
            imagePlaceholder.style.display = 'none';
            
            processBtn.style.display = 'flex';
            processBtn.disabled = false;
            
            // Update button text with current language
            const detectText = translations[currentLang].detectButton;
            processBtn.innerHTML = `<span class="btn-icon">🔍</span><span class="btn-text">${detectText}</span>`;
            
            hideOutputSection();
            
            resultText.innerHTML = `<span>${translations[currentLang].descriptionPlaceholder}</span>`;
            
            // Simpan file gambar saat ini
            currentImageFile = file;
        };
        reader.readAsDataURL(file);
        
        processBtn.file = file;
        processBtn.dataset.source = source;
        
        // Reset detection data
        lastDetectionData = null;
    }
}

// Fungsi untuk menyembunyikan output section
function hideOutputSection() {
    outputContainer.classList.remove('active');
    container.classList.remove('with-output');
    
    setTimeout(() => {
        outputContainer.style.display = 'none';
    }, 300);
}

// Fungsi untuk menampilkan output section
function showOutputSection() {
    outputContainer.style.display = 'block';
    
    void outputContainer.offsetWidth;
    
    outputContainer.classList.add('active');
    container.classList.add('with-output');
    
    if (window.innerWidth < 768) {
        outputContainer.scrollIntoView({ behavior: 'smooth' });
    }
}

// ============================================
// MODAL FUNGSIONALITAS
// ============================================

// Fungsi untuk membuka modal
function openModal(imageSrc) {
    if (!imageSrc || imageSrc === window.location.href) return;
    
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
    
    // Reset zoom
    currentScale = 1;
    modalImage.style.transform = `scale(${currentScale})`;
    modalImage.style.transformOrigin = 'center center';
    
    // Tampilkan loading
    modalLoading.style.display = 'flex';
    modalImage.classList.remove('active');
    modalImage.style.display = 'none';
    
    // Preload gambar
    const img = new Image();
    img.onload = function() {
        modalImage.src = imageSrc;
        modalImage.alt = translations[currentLang].modalTitle;
        modalLoading.style.display = 'none';
        modalImage.style.display = 'block';
        modalImage.classList.add('active');
        
        // Tambahkan event listener untuk zoom dengan mouse wheel
        modalImage.addEventListener('wheel', handleZoom);
    };
    
    img.onerror = function() {
        modalLoading.innerHTML = `<span style="color: #ff6b6b;">${translations[currentLang].loadingError}</span>`;
        setTimeout(() => {
            closeModal();
        }, 2000);
    };
    
    img.src = imageSrc;
}

// Fungsi untuk menutup modal
function closeModal() {
    modal.classList.remove('active');
    document.body.style.overflow = 'auto';
    
    // Hapus event listener zoom
    modalImage.removeEventListener('wheel', handleZoom);
    
    // Reset modal state
    modalImage.src = '';
    modalImage.classList.remove('active');
    modalImage.style.display = 'none';
    modalLoading.style.display = 'flex';
    modalLoading.innerHTML = `<span class="loading"></span><span>${translations[currentLang].loadingImage}</span>`;
}

// Fungsi untuk handle zoom dengan mouse wheel
function handleZoom(event) {
    event.preventDefault();
    
    if (event.deltaY < 0) {
        // Zoom in
        currentScale += zoomStep;
    } else {
        // Zoom out
        currentScale = Math.max(0.5, currentScale - zoomStep);
    }
    
    modalImage.style.transform = `scale(${currentScale})`;
    modalImage.style.transformOrigin = `${(event.offsetX / modalImage.offsetWidth) * 100}% ${(event.offsetY / modalImage.offsetHeight) * 100}%`;
}

// Fungsi untuk download gambar
function downloadImage() {
    const imageSrc = modalImage.src;
    if (!imageSrc || imageSrc === window.location.href) {
        alert(translations[currentLang].noDownloadAlert);
        return;
    }
    
    const link = document.createElement('a');
    link.href = imageSrc;
    link.download = `hasil_deteksi_${Date.now()}.jpg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// ============================================
// EVENT LISTENERS UTAMA
// ============================================

// Event listener untuk tombol kamera dan file
cameraBtn.addEventListener('click', openCamera);
fileBtn.addEventListener('click', openFileSelector);

// Event listener untuk input file
fileInput.addEventListener('change', handleFileSelect);
cameraInput.addEventListener('change', handleCameraSelect);

// Event listener untuk proses gambar
processBtn.addEventListener('click', async function() {
    const file = this.file;
    if (!file || !(file instanceof File)) {
        alert(translations[currentLang].noImageAlert);
        return;
    }
    
    processBtn.disabled = true;
    const detectText = translations[currentLang].detectButton;
    processBtn.innerHTML = `<span class="loading"></span><span class="btn-text">${detectText}</span>`;
    
    showOutputSection();
    
    // Tampilkan loading container dan sembunyikan gambar
    imageLoading.style.display = 'flex';
    resultImage.style.display = 'none';
    resultContent.style.background = '#f8f9fa';
    
    const analyzingText = translations[currentLang].analyzingText;
    resultText.innerHTML = `<div class="loading-container"><span class="loading"></span><span class="loading-text">${analyzingText}</span></div>`;
    
    try {
        const formData = new FormData();
        formData.append('image', file, file.name);
        
        const source = this.dataset.source || 'unknown';
        formData.append('source', source);
        
        const response = await fetch('/api/predict', {
            method: 'POST',
            body: formData,
            headers: {
                'Accept-Language': currentLang
            }
        });
        
        const data = await response.json();
        
        if (response.ok) {
            // Sembunyikan loading container dan tampilkan gambar
            imageLoading.style.display = 'none';
            resultImage.style.display = 'block';
            resultContent.style.background = '';
            
            // Gunakan gambar hasil deteksi jika ada, jika tidak gunakan preview
            const imageUrl = data.image || previewImage.src;
            resultImage.src = imageUrl;
            resultImage.alt = translations[currentLang].resultLabel;
            
            // Tambahkan class clickable untuk modal
            resultImage.classList.add('clickable-image');
            
            // Tambahkan event listener untuk klik gambar
            resultImage.addEventListener('click', function() {
                openModal(this.src);
            });
            
            // Simpan data deteksi untuk keperluan translation
            lastDetectionData = data;
            currentImageFile = file;
            
            // Tampilkan deskripsi dari server (Disederhanakan)
            let description = data.description || data.data?.description || data.message || 'Deskripsi tidak tersedia';
            resultText.innerHTML = description;
            
            const completeText = translations[currentLang].detectionComplete;
            processBtn.innerHTML = `<span class="btn-icon">✅</span><span class="btn-text">${completeText}</span>`;
            
        } else {
            throw new Error(data.message || translations[currentLang].serverError);
        }
        
    } catch (error) {
        console.error('Error:', error);
        imageLoading.style.display = 'none';
        resultImage.style.display = 'block';
        resultImage.src = '';
        resultImage.alt = translations[currentLang].loadingError;
        const errorText = translations[currentLang].detectionFailed;
        resultText.innerHTML = `<div class="error-message">${translations[currentLang].serverError}: ${error.message}</div>`;
        processBtn.innerHTML = `<span class="btn-icon">❌</span><span class="btn-text">${errorText}</span>`;
    } finally {
        setTimeout(() => {
            processBtn.disabled = false;
            const detectText = translations[currentLang].detectButton;
            processBtn.innerHTML = `<span class="btn-icon">🔍</span><span class="btn-text">${detectText}</span>`;
        }, 2000);
    }
});

// ============================================
// MODAL EVENT LISTENERS
// ============================================

// Klik tombol close modal
closeModalBtns.forEach(btn => {
    btn.addEventListener('click', closeModal);
});

// Klik di luar modal untuk menutup
modal.addEventListener('click', function(event) {
    if (event.target === modal) {
        closeModal();
    }
});

// Tombol download
downloadBtn.addEventListener('click', downloadImage);

// Tombol Escape untuk menutup modal
document.addEventListener('keydown', function(event) {
    if (event.key === 'Escape' && modal.classList.contains('active')) {
        closeModal();
    }
});

// ============================================
// INISIALISASI
// ============================================

// Inisialisasi state awal
processBtn.style.display = 'none';
imageLoading.style.display = 'flex';
resultImage.style.display = 'none';

// Inisialisasi bahasa
document.addEventListener('DOMContentLoaded', function() {
    initLanguage();
    
    // Tambahkan event listener untuk drag and drop
    const imageBox = document.querySelector('.image-box');
    
    imageBox.addEventListener('dragover', function(e) {
        e.preventDefault();
        this.style.borderColor = '#4263eb';
        this.style.backgroundColor = '#edf2ff';
    });
    
    imageBox.addEventListener('dragleave', function(e) {
        e.preventDefault();
        this.style.borderColor = '#adb5bd';
        this.style.backgroundColor = '#f1f3f5';
    });
    
    imageBox.addEventListener('drop', function(e) {
        e.preventDefault();
        this.style.borderColor = '#adb5bd';
        this.style.backgroundColor = '#f1f3f5';
        
        const file = e.dataTransfer.files[0];
        if (file && file.type.startsWith('image/')) {
            const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/bmp', 'image/webp'];
            if (allowedTypes.includes(file.type.toLowerCase())) {
                processSelectedFile(file, 'drag-drop');
            } else {
                alert(translations[currentLang].invalidFileAlert);
            }
        }
    });
    
    // Tambahkan event listener untuk klik gambar hasil deteksi (jika sudah ada)
    if (resultImage) {
        resultImage.addEventListener('click', function() {
            if (this.src && this.src !== window.location.href) {
                openModal(this.src);
            }
        });
    }
});