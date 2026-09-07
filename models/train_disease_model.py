import os
import json
import pickle
import numpy as np
from sklearn.ensemble import RandomForestClassifier
from sklearn.preprocessing import LabelEncoder

def train_and_save_disease_model():
    base_dir = os.path.dirname(__file__)
    kb_path = os.path.join(base_dir, 'disease_kb.json')
    model_output_path = os.path.join(base_dir, 'disease_model.pkl')

    with open(kb_path, 'r', encoding='utf-8') as f:
        kb_data = json.load(f)

    np.random.seed(42)
    X = []
    y = []

    # Features: [green_ratio, brown_spot_ratio, yellow_ratio, dark_spot_count, texture_variance]
    samples_per_class = 500

    for _ in range(samples_per_class):
        # 1. Healthy Leaf: High lush green, minimal brown/yellow, smooth texture
        g = np.random.uniform(0.68, 0.96)
        b = np.random.uniform(0.00, 0.04)
        y_val = np.random.uniform(0.00, 0.06)
        spots = np.random.randint(0, 3)
        tex = np.random.uniform(5, 22)
        X.append([g, b, y_val, spots, tex])
        y.append("Healthy Leaf")

        # 2. Tomato Early Blight: Distinct yellow chlorotic halos, dark concentric spots
        g = np.random.uniform(0.28, 0.48)
        b = np.random.uniform(0.18, 0.36)
        y_val = np.random.uniform(0.20, 0.44)  # High yellow halo
        spots = np.random.randint(8, 24)
        tex = np.random.uniform(48, 92)
        X.append([g, b, y_val, spots, tex])
        y.append("Tomato Early Blight")

        # 3. Potato Late Blight: Extensive dark/black water-soaked necrosis, low yellow
        g = np.random.uniform(0.14, 0.32)
        b = np.random.uniform(0.38, 0.68)      # Heavy dark brown necrosis
        y_val = np.random.uniform(0.02, 0.12)
        spots = np.random.randint(18, 45)
        tex = np.random.uniform(58, 115)
        X.append([g, b, y_val, spots, tex])
        y.append("Potato Late Blight")

        # 4. Rice Leaf Blast: Spindle diamond lesions, moderate green, lower spot density
        g = np.random.uniform(0.44, 0.64)
        b = np.random.uniform(0.10, 0.26)
        y_val = np.random.uniform(0.08, 0.20)
        spots = np.random.randint(6, 16)
        tex = np.random.uniform(28, 54)
        X.append([g, b, y_val, spots, tex])
        y.append("Rice Leaf Blast")

        # 5. Cotton Bacterial Blight: Angular vein-bound dark spots
        g = np.random.uniform(0.30, 0.50)
        b = np.random.uniform(0.24, 0.42)
        y_val = np.random.uniform(0.12, 0.25)
        spots = np.random.randint(12, 28)
        tex = np.random.uniform(42, 78)
        X.append([g, b, y_val, spots, tex])
        y.append("Cotton Bacterial Blight")

        # 6. Corn Common Rust: Cinnamon brown powdery pustules, high spot count
        g = np.random.uniform(0.34, 0.54)
        b = np.random.uniform(0.26, 0.48)
        y_val = np.random.uniform(0.05, 0.18)
        spots = np.random.randint(24, 58)      # Dense small pustules
        tex = np.random.uniform(34, 72)
        X.append([g, b, y_val, spots, tex])
        y.append("Corn Common Rust")

    le = LabelEncoder()
    y_encoded = le.fit_transform(y)

    clf = RandomForestClassifier(n_estimators=150, max_depth=12, random_state=42)
    clf.fit(X, y_encoded)

    payload = {
        'model': clf,
        'label_encoder': le,
        'knowledge_base': kb_data
    }

    with open(model_output_path, 'wb') as f:
        pickle.dump(payload, f)

    print(f"[OK] Trained RandomForestClassifier on {len(X)} samples across {len(le.classes_)} classes.")
    print(f"[OK] Saved to: {model_output_path}")

if __name__ == '__main__':
    train_and_save_disease_model()
