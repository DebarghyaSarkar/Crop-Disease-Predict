# model_utils.py
import json
import torch
import torch.nn.functional as F
from torchvision import models, transforms
from PIL import Image

# Assumptions: ImageNet normalization, 224x224 input — change if yours differs
IMAGENET_MEAN = [0.485, 0.456, 0.406]
IMAGENET_STD  = [0.229, 0.224, 0.225]
INPUT_SIZE = 224

# Preprocessing transform (resize->center crop->to tensor->normalize)
transform = transforms.Compose([
    transforms.Resize(256),
    transforms.CenterCrop(INPUT_SIZE),
    transforms.ToTensor(),
    transforms.Normalize(IMAGENET_MEAN, IMAGENET_STD)
])

def load_labels(path):
    with open(path, "r", encoding="utf-8") as f:
        return [line.strip() for line in f if line.strip()]

def load_remedies(path):
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)

def build_model(num_classes, device, checkpoint_path):
    # Build MobileNetV2 with custom classifier (must match training)
    model = models.mobilenet_v2(pretrained=False)
    num_ftrs = model.classifier[1].in_features
    model.classifier[1] = torch.nn.Linear(num_ftrs, num_classes)
    # load weights
    state = torch.load(checkpoint_path, map_location=device)
    # if you saved state_dict only, this works:
    if isinstance(state, dict) and ("state_dict" in state) and not any(k.startswith("module.") for k in state):
        model.load_state_dict(state["state_dict"])
    else:
        try:
            model.load_state_dict(state)
        except Exception:
            # attempt to handle possible 'module.' prefixes (from DataParallel)
            new_state = {}
            for k,v in state.items():
                name = k.replace("module.", "") if k.startswith("module.") else k
                new_state[name] = v
            model.load_state_dict(new_state)
    model.to(device)
    model.eval()
    return model

def load_model(checkpoint_path, labels_path, remedies_path, device):
    labels = load_labels(labels_path)
    remedies = load_remedies(remedies_path)
    model = build_model(len(labels), device, checkpoint_path)
    return model, labels, remedies

def predict(model, pil_image, labels, device, topk=3):
    """Return top-1 label, confidence, and topk list of (label, prob)."""
    img_t = transform(pil_image).unsqueeze(0).to(device)   # shape 1x3xHxW
    with torch.no_grad():
        outputs = model(img_t)            # logits
        probs = F.softmax(outputs, dim=1) # convert to probabilities
        top_probs, top_idxs = probs.topk(topk, dim=1)
        top_probs = top_probs.cpu().numpy()[0]
        top_idxs = top_idxs.cpu().numpy()[0]
        top_labels = [labels[i] for i in top_idxs]
    return top_labels[0], float(top_probs[0]), list(zip(top_labels, top_probs.tolist()))
