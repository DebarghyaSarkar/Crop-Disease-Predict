# app.py
import io, os
from flask import Flask, request, render_template, jsonify
from PIL import Image
import torch

from model_utils import load_model, predict

app = Flask(__name__)

# Paths (adjust if you moved model files)
MODEL_DIR = os.path.join(os.path.dirname(__file__), "model")
CHECKPOINT_PATH = os.path.join(MODEL_DIR, "newplant_model_final.pth")
LABELS_PATH = os.path.join(MODEL_DIR, "labels.txt")
REMEDIES_PATH = os.path.join(MODEL_DIR, "remedies.json")

device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
print("Using device:", device)

# Load model and metadata once at startup
model, labels, remedies = load_model(CHECKPOINT_PATH, LABELS_PATH, REMEDIES_PATH, device)

@app.route("/")
def index():
    return render_template("index.html")

@app.route("/predict", methods=["POST"])
def predict_route():
    if "file" not in request.files:
        return jsonify({"error": "no file part"}), 400
    file = request.files["file"]
    if file.filename == "":
        return jsonify({"error": "empty filename"}), 400
    try:
        img_bytes = file.read()
        pil_img = Image.open(io.BytesIO(img_bytes)).convert("RGB")
        top_label, confidence, topk = predict(model, pil_img, labels, device, topk=5)
        remedy = remedies.get(top_label, None)
        response = {
            "label": top_label,
            "confidence": confidence,
            "remedies": remedy,
            "topk": [{"label": l, "confidence": float(c)} for l,c in topk]
        }
        return jsonify(response)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)
