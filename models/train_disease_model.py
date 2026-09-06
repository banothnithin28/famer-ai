import os
import json
import pickle
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.preprocessing import LabelEncoder

def extract_image_features_simulated(green_ratio, brown_spot_ratio, yellow_ratio, dark_spot_count, texture_variance):
    """
    Features vector representation:
    [green_ratio, brown_spot_ratio, yellow_ratio, dark_spot_count, texture_variance]
    """
    return [green_ratio, brown_spot_ratio, yellow_ratio, dark_spot_count, texture_variance]

def train_and_save_disease_model():
    kb_path = os.path.join(os.path.dirname(__file__), 'disease_kb.json')
    model_output_path = os.path.join(os.path.dirname(__file__), 'disease_model.pkl')

    with open(kb_path, 'r') as f:
        kb_data = json.load(f)

    diseases = list(kb_data.keys())
    
    np.random.seed(42)
    X = []
    y = []

    # Generate synthetic training samples for feature space mapping
    for disease in diseases:
        for _ in range(100):
            if disease == "Healthy Leaf":
                g = np.random.uniform(0.65, 0.95)
                b = np.random.uniform(0.01, 0.08)
                y_val = np.random.uniform(0.01, 0.10)
                spots = np.random.randint(0, 2)
                tex = np.random.uniform(5, 20)
            elif disease == "Tomato Early Blight":
                g = np.random.uniform(0.30, 0.55)
                b = np.random.uniform(0.20, 0.45)
                y_val = np.random.uniform(0.15, 0.35)
                spots = np.random.randint(5, 18)
                tex = np.random.uniform(40, 90)
            elif disease == "Potato Late Blight":
                g = np.random.uniform(0.20, 0.45)
                b = np.random.uniform(0.35, 0.65)
                y_val = np.random.uniform(0.05, 0.20)
                spots = np.random.randint(8, 25)
                tex = np.random.uniform(50, 110)
            elif disease == "Rice Leaf Blast":
                g = np.random.uniform(0.40, 0.60)
                b = np.random.uniform(0.15, 0.35)
                y_val = np.random.uniform(0.10, 0.25)
                spots = np.random.randint(10, 30)
                tex = np.random.uniform(30, 75)
            elif disease == "Cotton Bacterial Blight":
                g = np.random.uniform(0.35, 0.58)
                b = np.random.uniform(0.25, 0.45)
                y_val = np.random.uniform(0.12, 0.30)
                spots = np.random.randint(12, 28)
                tex = np.random.uniform(45, 95)
            elif disease == "Corn Common Rust":
                g = np.random.uniform(0.38, 0.60)
                b = np.random.uniform(0.22, 0.48)
                y_val = np.random.uniform(0.08, 0.22)
                spots = np.random.randint(15, 35)
                tex = np.random.uniform(35, 80)

            X.append(extract_image_features_simulated(g, b, y_val, spots, tex))
            y.append(disease)

    le = LabelEncoder()
    y_encoded = le.fit_transform(y)

    clf = RandomForestClassifier(n_estimators=100, random_state=42)
    clf.fit(X, y_encoded)

    payload = {
        'model': clf,
        'label_encoder': le,
        'knowledge_base': kb_data
    }

    with open(model_output_path, 'wb') as f:
        pickle.dump(payload, f)

    print(f"✅ Leaf disease detection model successfully trained and saved to {model_output_path}")

if __name__ == '__main__':
    train_and_save_disease_model()
