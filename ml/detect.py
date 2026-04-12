import sys
import json
import os
import cv2
from ultralytics import YOLO
import numpy as np
from collections import defaultdict 

# Konfigurasi model - pastikan last.pt berada di folder yang sama atau beri path absolut
# model_path = 'ml/best.pt'   # atau bisa menggunakan path lengkap: os.path.join(os.path.dirname(__file__), 'last.pt')
model_path = os.path.join(os.path.dirname(__file__), 'best.pt')


def calculate_area(bbox):
    """Hitung area bounding box"""
    x1, y1, x2, y2 = bbox
    return (x2 - x1) * (y2 - y1)

def letterbox_image(img, target_size=640):
    """
    Menambahkan padding hitam untuk menjaga aspek rasio tanpa distorsi
    Wajib untuk YOLO v5/v8 agar koordinat akurat!
    """
    h, w = img.shape[:2]
    
    # Hitung faktor skala
    scale = min(target_size / w, target_size / h)
    new_w = int(w * scale)
    new_h = int(h * scale)
    
    # Resize gambar dengan menjaga aspek rasio
    resized = cv2.resize(img, (new_w, new_h), interpolation=cv2.INTER_LINEAR)
    
    # Buat canvas baru berwarna hitam
    canvas = np.full((target_size, target_size, 3), 0, dtype=np.uint8)
    
    # Hitung padding (untuk penempatan di tengah)
    pad_x = (target_size - new_w) // 2
    pad_y = (target_size - new_h) // 2
    
    # Letakkan gambar di tengah canvas
    canvas[pad_y:pad_y+new_h, pad_x:pad_x+new_w] = resized
    
    return canvas, scale, (pad_x, pad_y)

def convert_bbox_to_original(bbox_letterbox, scale, pad_x, pad_y, original_shape):
    """
    Konversi bounding box dari koordinat letterbox ke koordinat gambar asli
    """
    x1, y1, x2, y2 = bbox_letterbox
    
    # 1. Kurangi padding
    x1 = x1 - pad_x
    y1 = y1 - pad_y
    x2 = x2 - pad_x
    y2 = y2 - pad_y
    
    # 2. Scale kembali ke ukuran asli
    x1 = x1 / scale
    y1 = y1 / scale
    x2 = x2 / scale
    y2 = y2 / scale
    
    # 3. Konversi ke integer dan pastikan dalam batas
    x1 = int(max(0, min(x1, original_shape[1])))
    y1 = int(max(0, min(y1, original_shape[0])))
    x2 = int(max(0, min(x2, original_shape[1])))
    y2 = int(max(0, min(y2, original_shape[0])))
    
    # Pastikan x2 > x1 dan y2 > y1
    x1, x2 = min(x1, x2), max(x1, x2)
    y1, y2 = min(y1, y2), max(y1, y2)
    
    return [x1, y1, x2, y2]

def detect_image(image_path, output_path=None):
    """
    Fungsi utama untuk deteksi gambar menggunakan YOLO
    """
    # Cek apakah model file ada
    if not os.path.exists(model_path):
        return {"error": f"File model '{model_path}' tidak ditemukan.", "success": False}

    try:
        # Load Model YOLO
        model = YOLO(model_path)

        # Baca gambar asli
        img = cv2.imread(image_path)
        if img is None:
            return {"error": "Gagal membaca gambar. Pastikan path benar dan format didukung.", "success": False}
        
        original_height, original_width = img.shape[:2]
        print(f"Original image size: {original_width}x{original_height}", file=sys.stderr)

        # --- LANGKAH KRITIS: Letterbox processing untuk akurasi koordinat ---
        img_letterbox, scale, (pad_x, pad_y) = letterbox_image(img, target_size=640)
        print(f"Letterbox scale: {scale}, pad_x: {pad_x}, pad_y: {pad_y}", file=sys.stderr)

        # Lakukan Prediksi pada gambar yang sudah di-letterbox
        results = model.predict(
            img_letterbox,  # Gunakan gambar letterbox
            conf=0.25, 
            iou=0.45,
            save=False, 
            verbose=False
        )
        
        detected_objects = []
        
        # Buat salinan gambar asli untuk menggambar bounding box
        img_with_boxes = img.copy()
        
        # Warna untuk bounding box (satu warna per class)
        colors = [
            (0, 255, 0),      # Hijau
            (255, 0, 0),      # Biru  
            (0, 0, 255),      # Merah
            (255, 255, 0),    # Cyan
            (255, 0, 255),    # Magenta
            (0, 255, 255)     # Kuning
        ]
        
        # Proses setiap hasil deteksi
        for result in results:
            if hasattr(result, 'boxes') and result.boxes is not None:
                for box in result.boxes:
                    class_id = int(box.cls[0])
                    class_name = model.names[class_id]
                    
                    # Koreksi typo nama kelas (jika diperlukan)
                    class_name_corrections = {
                        "Pelingah Pengapit Candi Agung": "Pelinggih Pengapit Candi Agung",
                        "Pelingah": "Pelinggih",
                        "Candi Prasada": "Candi Prasada",
                        "Padmasana": "Padmasana",
                        "Beji Tunggal": "Beji Tunggal",
                        "Beji": "Beji",
                        "Bangunan Pemujaan Bhatara Siwa": "Bangunan Pemujaan Bhatara Siwa"
                    }
                    
                    if class_name in class_name_corrections:
                        class_name = class_name_corrections[class_name]
                    
                    confidence = float(box.conf[0])
                    
                    print(f"DEBUG: Detected - ID: {class_id}, Name: '{class_name}', Confidence: {confidence:.2f}", file=sys.stderr)
                    
                    # Ambil koordinat bounding box (dalam koordinat letterbox)
                    bbox_letterbox = box.xyxy[0].tolist()
                    
                    # Konversi ke koordinat gambar asli
                    bbox_original = convert_bbox_to_original(
                        bbox_letterbox, scale, pad_x, pad_y, (original_height, original_width)
                    )
                    
                    x1, y1, x2, y2 = bbox_original
                    
                    # Hitung area bounding box
                    area = calculate_area([x1, y1, x2, y2])
                    
                    # Simpan informasi deteksi
                    detected_objects.append({
                        "class_name": class_name,
                        "confidence": confidence,
                        "bbox": [x1, y1, x2, y2],
                        "area": area,
                        "class_id": class_id
                    })
                    
                    # Gambar bounding box pada gambar asli
                    color = colors[class_id % len(colors)]
                    thickness = 3
                    
                    cv2.rectangle(img_with_boxes, (x1, y1), (x2, y2), color, thickness)
                    
                    # Label dengan confidence
                    label = f"{class_name}: {confidence:.2f}"
                    (text_width, text_height), baseline = cv2.getTextSize(
                        label, cv2.FONT_HERSHEY_SIMPLEX, 0.7, 2
                    )
                    
                    # Atur posisi label agar tidak keluar gambar
                    if y1 - text_height - 10 < 0:
                        y_label = y1 + text_height + 10
                    else:
                        y_label = y1 - 10
                    
                    if x1 + text_width > original_width:
                        x_label = original_width - text_width - 10
                    else:
                        x_label = x1
                    
                    # Kotak background label
                    cv2.rectangle(
                        img_with_boxes, 
                        (x_label, y_label - text_height - 5), 
                        (x_label + text_width, y_label + 5), 
                        color, 
                        -1  # Fill
                    )
                    
                    # Teks label
                    cv2.putText(
                        img_with_boxes,
                        label,
                        (x_label, y_label),
                        cv2.FONT_HERSHEY_SIMPLEX,
                        0.7,
                        (255, 255, 255),  # Putih
                        2,
                        cv2.LINE_AA
                    )

        # --- LOGIKA PEMILIHAN OBJEK (MAKSIMAL 2) ---
        objects_by_class = defaultdict(list)
        for obj in detected_objects:
            objects_by_class[obj["class_name"]].append(obj)
        
        selected_objects = []
        
        # Aturan 1: Untuk setiap kelas, pilih objek dengan area terbesar
        for class_name, objects in objects_by_class.items():
            if len(objects) >= 3:
                largest_obj = max(objects, key=lambda x: x["area"])
                selected_objects.append(largest_obj)
            elif len(objects) == 2:
                best_obj = max(objects, key=lambda x: x["confidence"])
                selected_objects.append(best_obj)
            else:
                selected_objects.extend(objects)
        
        # Urutkan berdasarkan confidence (tertinggi ke terendah)
        selected_objects.sort(key=lambda x: x["confidence"], reverse=True)
        
        # Ambil maksimal 2 objek
        final_selected = selected_objects[:2]
        
        print(f"DEBUG: Total detections: {len(detected_objects)}", file=sys.stderr)
        print(f"DEBUG: Selected objects: {len(final_selected)}", file=sys.stderr)
        for i, obj in enumerate(final_selected):
            print(f"DEBUG: Selected {i+1}: {obj['class_name']} (conf: {obj['confidence']:.2f}, area: {obj['area']})", file=sys.stderr)
        
        # Simpan gambar dengan bounding box jika diperlukan
        if output_path and len(detected_objects) > 0:
            os.makedirs(os.path.dirname(output_path), exist_ok=True)
            success = cv2.imwrite(output_path, img_with_boxes)
            if not success:
                print(f"[WARNING] Gagal menyimpan gambar ke {output_path}", file=sys.stderr)
        
        # Format hasil untuk response
        result_data = {
            "detections": detected_objects,
            "selected_detections": final_selected,
            "image_size": [original_width, original_height],
            "total_detected": len(detected_objects),
            "selected_count": len(final_selected),
            "success": True
        }
        
        return result_data

    except Exception as e:
        import traceback
        error_details = traceback.format_exc()
        return {
            "error": str(e), 
            "traceback": error_details,
            "success": False
        }

if __name__ == "__main__":
    if len(sys.argv) > 2:
        img_path = sys.argv[1]
        output_img_path = sys.argv[2]
        result = detect_image(img_path, output_img_path)
        print(json.dumps(result))
    elif len(sys.argv) > 1:
        img_path = sys.argv[1]
        result = detect_image(img_path)
        print(json.dumps(result))
    else:
        error_result = {
            "error": "Tidak ada path gambar yang diberikan.",
            "success": False
        }
        print(json.dumps(error_result))