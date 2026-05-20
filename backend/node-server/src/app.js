
// require("dotenv").config()
// const express = require("express")
// const cors    = require("cors")
// const axios   = require("axios")
// const app     = express()

// app.use(cors())
// app.use(express.json())

// app.get("/", (req, res) => res.send("AQI Backend Running"))

// app.post("/predict", async (req, res) => {
//   try {
//     const { state, city } = req.body

//     // 1. COORDINATES
//     const geoRes = await axios.get(
//       `http://api.openweathermap.org/geo/1.0/direct?q=${city},${state},IN&limit=1&appid=${process.env.OPENWEATHER_API_KEY}`
//     )
//     if (!geoRes.data.length) throw new Error(`City not found: ${city}, ${state}`)
//     const { lat, lon } = geoRes.data[0]

//     // 2. CURRENT WEATHER
//     const [weatherRes, forecastRes, pollutionRes] = await Promise.all([
//       axios.get(`https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${process.env.OPENWEATHER_API_KEY}&units=metric`),
//       axios.get(`https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&appid=${process.env.OPENWEATHER_API_KEY}&units=metric`),
//       axios.get(`http://api.openweathermap.org/data/2.5/air_pollution?lat=${lat}&lon=${lon}&appid=${process.env.OPENWEATHER_API_KEY}`)
//     ])

//     // 3. BUILD DAILY WEATHER MAP  (keyed by "YYYY-MM-DD")
//     const dailyWeatherMap = {}
//     forecastRes.data.list.forEach(item => {
//       const date = item.dt_txt.split(" ")[0]
//       const time = item.dt_txt.split(" ")[1]
//       if (time === "12:00:00" && !dailyWeatherMap[date]) {
//         dailyWeatherMap[date] = {
//           temp:     item.main.temp,
//           humidity: item.main.humidity
//         }
//       }
//     })

//     // 4. CURRENT WEATHER OBJECT
//     const weather = {
//       temperature:   weatherRes.data.main.temp,
//       humidity:      weatherRes.data.main.humidity,
//       windSpeed:     weatherRes.data.wind.speed,
//       pressure:      weatherRes.data.main.pressure,
//       visibility:    weatherRes.data.visibility / 1000,
//       precipitation: 0
//     }

//     // 5. POLLUTANTS
//     const comp = pollutionRes.data.list[0].components
//     const pollutants = {
//       pm25: comp.pm2_5, pm10: comp.pm10,
//       no:   comp.no,    no2:  comp.no2,
//       nh3:  comp.nh3,   co:   comp.co,
//       so2:  comp.so2,   o3:   comp.o3,
//       nox:  (comp.no + comp.no2).toFixed(2),
//       benzene: 0, toluene: 0, xylene: 0
//     }

//     // 6. CALL FLASK FOR 7-DAY FORECAST
//     const flaskRes = await axios.post("http://127.0.0.1:5001/predict", {
//       state,
//       city,
//       aqi_lag_1: comp.pm2_5
//     })

//     if (!flaskRes.data.success) throw new Error(flaskRes.data.error)

//     // 7. ENRICH FORECAST WITH TEMP & HUMIDITY FROM OWM
//     const forecast = flaskRes.data.forecast.map(day => {
//       const w = dailyWeatherMap[day.date] || {}
//       return {
//         ...day,
//         temp:     w.temp     ?? weather.temperature,
//         humidity: w.humidity ?? weather.humidity
//       }
//     })

//     return res.json({
//       success:       true,
//       predicted_aqi: flaskRes.data.predicted_aqi,
//       weather,
//       pollutants,
//       forecast          // ← this is what the frontend needs
//     })

//   } catch (err) {
//     console.error(err.message)
//     return res.status(500).json({ success: false, error: err.message })
//   }
// })

// module.exports = app
require("dotenv").config()
const express = require("express")
const cors    = require("cors")
const axios   = require("axios")
 
const app  = express()
const PORT = process.env.PORT || 5000
 
app.use(cors())
app.use(express.json())
 
// ── Health check ────────────────────────────────────────────
app.get("/", (req, res) => res.send("AQI Backend Running ✅"))
 
// ── Main predict endpoint ────────────────────────────────────
app.post("/predict", async (req, res) => {
  try {
    const { state, city } = req.body
 
    if (!state || !city) {
      return res.status(400).json({ success: false, error: "state and city are required" })
    }
 
    const API_KEY = process.env.OPENWEATHER_API_KEY
    if (!API_KEY) {
      return res.status(500).json({ success: false, error: "OPENWEATHER_API_KEY not set in .env" })
    }
 
    // ── 1. Geocoding — get lat/lon ──────────────────────────
    const geoRes = await axios.get(
      `http://api.openweathermap.org/geo/1.0/direct`,
      {
        params: {
          q:     `${city},${state},IN`,
          limit: 1,
          appid: API_KEY,
        },
      }
    )
 
    if (!geoRes.data || geoRes.data.length === 0) {
      return res.status(404).json({
        success: false,
        error:   `City not found: "${city}, ${state}". Try a nearby major city.`,
      })
    }
 
    const { lat, lon, name: foundName } = geoRes.data[0]
    console.log(`📍 Geocoded "${city}, ${state}" → ${foundName} (${lat}, ${lon})`)
 
    // ── 2. Parallel OpenWeatherMap calls ────────────────────
    const [weatherRes, forecastRes, pollutionRes] = await Promise.all([
      // Current weather
      axios.get(`https://api.openweathermap.org/data/2.5/weather`, {
        params: { lat, lon, appid: API_KEY, units: "metric" },
      }),
      // 5-day / 3-hour forecast (for daily temp+humidity)
      axios.get(`https://api.openweathermap.org/data/2.5/forecast`, {
        params: { lat, lon, appid: API_KEY, units: "metric" },
      }),
      // Current air pollution
      axios.get(`http://api.openweathermap.org/data/2.5/air_pollution`, {
        params: { lat, lon, appid: API_KEY },
      }),
    ])
 
    // ── 3. Build daily weather map keyed by "YYYY-MM-DD" ───
    // OWM forecast gives 3-hour intervals; pick 12:00 UTC each day
    const dailyWeatherMap = {}
    forecastRes.data.list.forEach(item => {
      const [date, time] = item.dt_txt.split(" ")
      if (time === "12:00:00" && !dailyWeatherMap[date]) {
        dailyWeatherMap[date] = {
          temp:     item.main.temp,
          humidity: item.main.humidity,
        }
      }
    })
 
    // ── 4. Current weather object ───────────────────────────
    const w = weatherRes.data
    const weather = {
      temperature:   parseFloat(w.main.temp.toFixed(1)),
      humidity:      w.main.humidity,
      windSpeed:     parseFloat((w.wind.speed * 3.6).toFixed(1)), // m/s → km/h
      pressure:      w.main.pressure,
      visibility:    parseFloat(((w.visibility || 10000) / 1000).toFixed(1)),
      precipitation: w.rain?.["1h"] || w.snow?.["1h"] || 0,
    }
 
    // ── 5. Pollutant components from OWM ───────────────────
    const comp = pollutionRes.data.list[0].components
    const pollutants = {
      pm25:    parseFloat((comp.pm2_5 || 0).toFixed(1)),
      pm10:    parseFloat((comp.pm10  || 0).toFixed(1)),
      no:      parseFloat((comp.no   || 0).toFixed(1)),
      no2:     parseFloat((comp.no2  || 0).toFixed(1)),
      nh3:     parseFloat((comp.nh3  || 0).toFixed(1)),
      co:      parseFloat((comp.co   || 0).toFixed(1)),
      so2:     parseFloat((comp.so2  || 0).toFixed(1)),
      o3:      parseFloat((comp.o3   || 0).toFixed(1)),
      nox:     parseFloat(((comp.no || 0) + (comp.no2 || 0)).toFixed(1)),
      benzene: 0,   // not in OWM free tier
      toluene: 0,
      xylene:  0,
    }
 
    // Use PM2.5 as the lag-1 seed for the ML model
    // (real-time reading — most reliable single pollutant signal)
    const pm25_now = comp.pm2_5 || 50
 
    // ── 6. Call Flask ML service ────────────────────────────
    let flaskRes
    try {
      flaskRes = await axios.post(
        "http://127.0.0.1:5001/predict",
        { state, city, aqi_lag_1: pm25_now },
        { timeout: 15000 }
      )
    } catch (flaskErr) {
      console.error("Flask error:", flaskErr.message)
      return res.status(502).json({
        success: false,
        error:   `ML service unreachable. Make sure Flask is running on port 5001. (${flaskErr.message})`,
      })
    }
 
    if (!flaskRes.data.success) {
      return res.status(500).json({ success: false, error: flaskRes.data.error })
    }
 
    // ── 7. Enrich forecast with real temp/humidity ──────────
    const forecast = flaskRes.data.forecast.map(day => {
      const dayWeather = dailyWeatherMap[day.date] || {}
      return {
        ...day,
        temp:     dayWeather.temp     ?? weather.temperature,
        humidity: dayWeather.humidity ?? weather.humidity,
      }
    })
 
    console.log(`✅ Forecast generated for ${city}, ${state}`)
 
    return res.json({
      success:       true,
      predicted_aqi: flaskRes.data.predicted_aqi,
      location:      { lat, lon, name: foundName },
      weather,
      pollutants,
      forecast,        // 7-day array with date, aqi, pm25, temp, humidity
    })
 
  } catch (err) {
    console.error("Unhandled error:", err.message)
    return res.status(500).json({ success: false, error: err.message })
  }
})
module.exports = app