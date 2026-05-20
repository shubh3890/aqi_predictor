

# from flask import Flask, request, jsonify
# from flask_cors import CORS
# import joblib
# from datetime import datetime, timedelta
# import numpy as np

# app = Flask(__name__)
# CORS(app)

# model    = joblib.load("best_model.pkl")
# scaler   = joblib.load("scaler.pkl")
# le_state = joblib.load("label_encoder_state.pkl")
# le_area  = joblib.load("label_encoder_area.pkl")
# le_poll  = joblib.load("label_encoder_pollutant.pkl")

# def safe_encode(le, value):
#     if value in le.classes_:
#         return le.transform([value])[0]
#     print(f"WARNING: '{value}' not found in encoder. Using 0.")
#     return 0

# @app.route("/")
# def home():
#     return "AQI ML Service Running"

# @app.route("/predict", methods=["POST"])
# def predict():
#     try:
#         data      = request.json
#         state     = data["state"]
#         city      = data["city"]
#         aqi_lag_1 = float(data["aqi_lag_1"])  # today's PM2.5 from OpenWeather

#         state_enc = safe_encode(le_state, state)
#         area_enc  = safe_encode(le_area,  city)
#         poll_enc  = safe_encode(le_poll,  list(le_poll.classes_)[0])

#         forecast   = []
#         lag_1      = aqi_lag_1
#         lag_7      = aqi_lag_1 - 10
#         lag_30     = aqi_lag_1 - 15
#         roll_7     = aqi_lag_1 - 5
#         roll_30    = aqi_lag_1 - 8
#         std_7      = 5.0
#         trend      = 0.0

#         for i in range(7):
#             day = datetime.now() + timedelta(days=i)

#             month = day.month
#             if month in [12, 1, 2]:   season = 0
#             elif month in [3, 4, 5]:  season = 1
#             elif month in [6, 7, 8]:  season = 2
#             else:                     season = 3

#             features = [[
#     day.year,                        # year
#     month,                           # month
#     day.weekday(),                   # day_of_week
#     day.timetuple().tm_yday,         # day_of_year
#     (month - 1) // 3 + 1,           # quarter
#     int(day.weekday() >= 5),         # is_weekend
#     season,                          # season
#     state_enc,                       # state_enc
#     area_enc,                        # area_enc
#     poll_enc,                        # poll_enc
#     lag_1,                           # aqi_lag_1
#     lag_7,                           # aqi_lag_7
#     lag_30,                          # aqi_lag_30
#     roll_7,                          # aqi_roll_7d
#     roll_30,                         # aqi_roll_30d
#     std_7,                           # aqi_std_7d
#     trend                            # aqi_trend
# ]]
#             scaled     = scaler.transform(features)
#             prediction = float(np.clip(model.predict(scaled)[0], 0, 500))
#             prediction = round(prediction, 1)

#             forecast.append({
#                 "date": day.strftime("%Y-%m-%d"),
#                 "aqi":  round(prediction),
#                 "pm25": round(lag_1, 1),
#             })

#             # Roll lags forward for next iteration
#             lag_30  = lag_7
#             lag_7   = lag_1
#             lag_1   = prediction
#             roll_30 = round((roll_30 * 29 + prediction) / 30, 2)
#             roll_7  = round((roll_7  *  6 + prediction) /  7, 2)
#             std_7   = round(abs(prediction - roll_7), 2)
#             trend   = round(prediction - lag_7, 2)

#         return jsonify({
#             "success":       True,
#             "predicted_aqi": forecast[0]["aqi"],
#             "forecast":      forecast
#         })

#     except Exception as e:
#         import traceback
#         traceback.print_exc()
#         return jsonify({"success": False, "error": str(e)}), 500

# if __name__ == "__main__":
#     app.run(port=5001, debug=True)
"""
Flask ML Service — AQI Prediction
Fixed: correct 17-feature vector matching training pipeline
"""
 
from flask import Flask, request, jsonify
from flask_cors import CORS
import joblib
from datetime import datetime, timedelta
import numpy as np
import pandas as pd
import os
 
app = Flask(__name__)
CORS(app)
 
# ── Load artifacts ──────────────────────────────────────────
model    = joblib.load("best_model.pkl")
scaler   = joblib.load("scaler.pkl")
le_state = joblib.load("label_encoder_state.pkl")
le_area  = joblib.load("label_encoder_area.pkl")
le_poll  = joblib.load("label_encoder_pollutant.pkl")
 
# ── Load CSV for real historical lags ──────────────────────
# This gives us real lag_7, lag_30 values instead of fake offsets
CSV_PATH = "aqi.csv"
df_hist = None
if os.path.exists(CSV_PATH):
    try:
        df_hist = pd.read_csv(CSV_PATH)
        df_hist["date"]  = pd.to_datetime(df_hist["date"], dayfirst=True, errors="coerce")
        df_hist["state"] = df_hist["state"].astype(str).str.strip().str.title()
        df_hist["area"]  = df_hist["area"].astype(str).str.strip().str.title()
        df_hist = df_hist[(df_hist["aqi_value"] >= 0) & (df_hist["aqi_value"] <= 500)]
        df_hist.dropna(subset=["date","aqi_value","state","area"], inplace=True)
        df_hist.sort_values(["area","date"], inplace=True)
        print(f"✅ Loaded CSV: {len(df_hist)} rows")
    except Exception as e:
        print(f"⚠️  CSV load failed: {e}")
        df_hist = None
else:
    print("⚠️  aqi.csv not found — will use API-based lags only")
 
 
def safe_encode(le, value):
    val_title = str(value).strip().title()
    if val_title in le.classes_:
        return int(le.transform([val_title])[0])
    # Try case-insensitive match
    for cls in le.classes_:
        if cls.lower() == val_title.lower():
            return int(le.transform([cls])[0])
    print(f"WARNING: '{value}' not in encoder classes. Using 0.")
    return 0
 
 
def get_historical_lags(state: str, city: str, current_aqi: float):
    """
    Pull real lag values from CSV history for this state/city.
    Falls back to current_aqi-based estimates if no data found.
    """
    if df_hist is None:
        return current_aqi, current_aqi, current_aqi, current_aqi, current_aqi, 5.0, 0.0, 1
 
    state_t = state.strip().title()
    city_t  = city.strip().title()
 
    subset = df_hist[
        (df_hist["state"] == state_t) &
        (df_hist["area"]  == city_t)
    ].tail(60)
 
    if subset.empty:
        # Try partial match on area
        subset = df_hist[
            df_hist["area"].str.contains(city_t, case=False, na=False)
        ].tail(60)
 
    if subset.empty:
        print(f"⚠️  No CSV history for {city}, {state}. Using current AQI as base.")
        hist = [current_aqi] * 30
    else:
        hist = list(subset["aqi_value"].values)
        print(f"✅ Found {len(hist)} historical rows for {city}, {state}")
 
    # Compute real lag features
    lag1  = float(hist[-1])  if len(hist) >= 1  else current_aqi
    lag7  = float(hist[-7])  if len(hist) >= 7  else float(hist[0])
    lag30 = float(hist[-30]) if len(hist) >= 30 else float(hist[0])
    roll7 = float(np.mean(hist[-7:]))
    roll30= float(np.mean(hist[-30:] if len(hist) >= 30 else hist))
    std7  = float(np.std(hist[-7:])) if len(hist) >= 2 else 5.0
    trend = float(np.polyfit(range(min(7, len(hist))), hist[-7:], 1)[0]) if len(hist) >= 2 else 0.0
 
    # monitoring stations from CSV
    mon = 1
    if df_hist is not None and not subset.empty:
        col = "number_of_monitoring_stations" if "number_of_monitoring_stations" in subset.columns else None
        if col:
            mon = int(subset[col].fillna(1).iloc[-1])
 
    return lag1, lag7, lag30, roll7, roll30, std7, trend, mon
 
 
def season_of(month):
    return {12:0,1:0,2:0, 3:1,4:1,5:1, 6:2,7:2,8:2, 9:3,10:3,11:3}[month]
 
 
@app.route("/")
def home():
    return "AQI ML Service Running ✅"
 
 
@app.route("/predict", methods=["POST"])
def predict():
    try:
        data      = request.json
        state     = data["state"]
        city      = data["city"]
        aqi_lag_1 = float(data["aqi_lag_1"])   # current PM2.5-based AQI from OpenWeather
 
        # ── Encode labels ──────────────────────────────────
        state_enc = safe_encode(le_state, state)
        area_enc  = safe_encode(le_area,  city)
 
        # Use first pollutant class as default (same as training fallback)
        default_poll = list(le_poll.classes_)[0]
        poll_enc     = safe_encode(le_poll, default_poll)
 
        # ── Get REAL historical lags from CSV ──────────────
        lag1, lag7, lag30, roll7, roll30, std7, trend, monitoring = get_historical_lags(
            state, city, aqi_lag_1
        )
 
        # Override lag1 with today's live reading from OpenWeather
        # (more accurate than last CSV entry which may be months old)
        lag1 = aqi_lag_1
 
        # ── 7-day rolling forecast ─────────────────────────
        forecast  = []
        hist_aqis = [lag1]   # build up as we predict
 
        for i in range(7):
            day = datetime.now() + timedelta(days=i)
            m   = day.month
 
            # Recompute lags from rolling history
            h = [lag30] * 30 + [lag7] + [lag1]   # seed with CSV values
            h += hist_aqis                          # append live predictions so far
 
            cur_lag1  = float(h[-1])
            cur_lag7  = float(h[-7])  if len(h) >= 7  else float(h[0])
            cur_lag30 = float(h[-30]) if len(h) >= 30 else float(h[0])
            cur_roll7 = float(np.mean(h[-7:]))
            cur_roll30= float(np.mean(h[-30:] if len(h) >= 30 else h))
            cur_std7  = float(np.std(h[-7:])) if len(h) >= 2 else std7
            cur_trend = float(np.polyfit(range(min(7,len(h))), h[-7:], 1)[0]) if len(h) >= 2 else trend
 
            # EXACT 17 features matching training pipeline:
            # year, month, day_of_week, day_of_year, quarter, is_weekend, season,
            # state_enc, area_enc, poll_enc, monitoring_stations,
            # aqi_lag_1, aqi_lag_7, aqi_lag_30, aqi_roll_7d, aqi_roll_30d, aqi_std_7d, aqi_trend
            features = [[
                day.year,                          # 1. year
                m,                                 # 2. month
                day.weekday(),                     # 3. day_of_week
                day.timetuple().tm_yday,           # 4. day_of_year
                (m - 1) // 3 + 1,                 # 5. quarter
                int(day.weekday() >= 5),           # 6. is_weekend
                season_of(m),                      # 7. season
                state_enc,                         # 8. state_enc
                area_enc,                          # 9. area_enc
                poll_enc,                          # 10. poll_enc
                monitoring,                        # 11. monitoring_stations  ← was MISSING
                cur_lag1,                          # 12. aqi_lag_1
                cur_lag7,                          # 13. aqi_lag_7
                cur_lag30,                         # 14. aqi_lag_30
                cur_roll7,                         # 15. aqi_roll_7d
                cur_roll30,                        # 16. aqi_roll_30d
                cur_std7,                          # 17. aqi_std_7d
                # NOTE: aqi_trend was in training get_feature_cols but check your
                # actual scaler shape. If model was trained with 17 cols (no trend),
                # remove the line below. If trained with 18 (with trend), keep it.
                # cur_trend,
            ]]
 
            scaled     = scaler.transform(features)
            prediction = float(np.clip(model.predict(scaled)[0], 0, 500))
            prediction = round(prediction, 1)
 
            hist_aqis.append(prediction)
 
            forecast.append({
                "date": day.strftime("%Y-%m-%d"),
                "aqi":  round(prediction),
                "pm25": round(cur_lag1, 1),
            })
 
        return jsonify({
            "success":       True,
            "predicted_aqi": forecast[0]["aqi"],
            "forecast":      forecast
        })
 
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({"success": False, "error": str(e)}), 500
 
 
@app.route("/states", methods=["GET"])
def get_states():
    """Return available states from CSV for validation."""
    if df_hist is None:
        return jsonify({"states": []})
    states = sorted(df_hist["state"].dropna().unique().tolist())
    return jsonify({"states": states})
 
 
@app.route("/cities/<state>", methods=["GET"])
def get_cities(state):
    """Return available cities for a state from CSV."""
    if df_hist is None:
        return jsonify({"cities": []})
    cities = sorted(
        df_hist[df_hist["state"].str.lower() == state.lower()]["area"]
        .dropna().unique().tolist()
    )
    return jsonify({"cities": cities})
 
 
if __name__ == "__main__":
    app.run(port=5001, debug=True)
 