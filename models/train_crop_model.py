import os
import pickle
import pandas as pd
import numpy as np
from sklearn.ensemble import RandomForestClassifier
from sklearn.preprocessing import LabelEncoder

def train_and_save_crop_model():
    dataset_path = os.path.join(os.path.dirname(__file__), '..', 'dataset', 'crop_data.csv')
    model_output_path = os.path.join(os.path.dirname(__file__), 'crop_model.pkl')

    df = pd.read_csv(dataset_path)

    encoders = {}
    categorical_cols = ['soil_type', 'season', 'water_availability', 'previous_crop', 'location']
    
    encoded_df = df.copy()
    for col in categorical_cols:
        le = LabelEncoder()
        encoded_df[col] = le.fit_transform(df[col].astype(str))
        encoders[col] = le

    target_encoder = LabelEncoder()
    encoded_df['recommended_crop'] = target_encoder.fit_transform(df['recommended_crop'])
    encoders['target'] = target_encoder

    feature_cols = categorical_cols + ['temperature', 'humidity', 'ph', 'rainfall']
    X = encoded_df[feature_cols]
    y = encoded_df['recommended_crop']

    clf = RandomForestClassifier(n_estimators=100, random_state=42)
    clf.fit(X, y)

    reasons = df.groupby('recommended_crop')['reason'].first().to_dict()

    payload = {
        'model': clf,
        'encoders': encoders,
        'feature_cols': feature_cols,
        'reasons': reasons,
        'raw_df': df
    }

    with open(model_output_path, 'wb') as f:
        pickle.dump(payload, f)
    
    print(f"✅ Crop recommendation model successfully trained and saved to {model_output_path}")

if __name__ == '__main__':
    train_and_save_crop_model()
