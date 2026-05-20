import { useState, useEffect, useRef } from "react"
import axios from "axios"
import { State, City } from "country-state-city"
import {
  AreaChart, Area, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from "recharts"
 
// ─────────────────────────────────────────────────────────────
// DUMMY DATA  —  swap these with real axios API calls later
// ─────────────────────────────────────────────────────────────
 

 
const DUMMY_FORECAST = [
  { day: "Mon", date: "Today",  aqi: 142, pm25: 68.4, temp: 32, humidity: 72 },
  { day: "Tue", date: "Jun 24", aqi: 158, pm25: 79.2, temp: 34, humidity: 68 },
  { day: "Wed", date: "Jun 25", aqi: 171, pm25: 85.1, temp: 33, humidity: 74 },
  { day: "Thu", date: "Jun 26", aqi: 134, pm25: 62.3, temp: 30, humidity: 80 },
  { day: "Fri", date: "Jun 27", aqi: 88,  pm25: 41.2, temp: 28, humidity: 76 },
  { day: "Sat", date: "Jun 28", aqi: 62,  pm25: 28.7, temp: 27, humidity: 70 },
  { day: "Sun", date: "Jun 29", aqi: 44,  pm25: 18.4, temp: 26, humidity: 65 },
]
 
const DUMMY_WEATHER = {
  temperature: 32.4,
  humidity: 72,
  windSpeed: 12.4,
  visibility: 6.2,
  pressure: 1010,
  precipitation: 0,
}
 
const DUMMY_POLLUTANTS = {
  pm25: 68.4, pm10: 124,  no: 8.2,  no2: 38.2,
  nox: 46.4,  nh3: 22.1,  co: 1.42, so2: 15.7,
  o3: 82.3,   benzene: 3.4, toluene: 12.8, xylene: 6.1,
}
 
const HEALTH_TIPS = [
  {
    icon: "😷",
    title: "Wear a Mask",
    desc: "N95 or KN95 masks are strongly recommended when going outdoors, especially near high-traffic areas.",
    level: "High Risk",
    levelColor: "text-red-400",
    levelBg: "bg-red-400/10 border-red-400/20",
  },
  {
    icon: "🫁",
    title: "Asthma Patients",
    desc: "Avoid strenuous outdoor activities today. Keep your inhaler accessible and readily available.",
    level: "Warning",
    levelColor: "text-orange-400",
    levelBg: "bg-orange-400/10 border-orange-400/20",
  },
  {
    icon: "🏃",
    title: "Outdoor Exercise",
    desc: "Limit outdoor workouts. Exercise indoors or step out only before 7 AM when levels are lower.",
    level: "Caution",
    levelColor: "text-amber-400",
    levelBg: "bg-amber-400/10 border-amber-400/20",
  },
  {
    icon: "👶",
    title: "Children & Elderly",
    desc: "Keep children and elderly people indoors. Sensitive groups must minimize all outdoor exposure.",
    level: "High Risk",
    levelColor: "text-red-400",
    levelBg: "bg-red-400/10 border-red-400/20",
  },
  {
    icon: "🌿",
    title: "Use Air Purifiers",
    desc: "Run indoor air purifiers on high. Keep windows and doors shut between 10 AM and 6 PM.",
    level: "Advised",
    levelColor: "text-emerald-400",
    levelBg: "bg-emerald-400/10 border-emerald-400/20",
  },
  {
    icon: "💧",
    title: "Stay Hydrated",
    desc: "Drink plenty of water. Pollution exposure stresses your respiratory system — hydration helps.",
    level: "General",
    levelColor: "text-sky-400",
    levelBg: "bg-sky-400/10 border-sky-400/20",
  },
]
 
const LOADING_MESSAGES = [
  "Fetching geolocation data…",
  "Pulling real-time weather…",
  "Loading air pollution readings…",
  "Preparing ML model input features…",
  "Running AQI prediction engine…",
  "Building your 7-day forecast…",
]
 
const AQI_SCALE = [
  { range: "0–50",    label: "Good",          color: "#22c55e" },
  { range: "51–100",  label: "Moderate",       color: "#eab308" },
  { range: "101–150", label: "Sensitive",      color: "#f97316" },
  { range: "151–200", label: "Unhealthy",      color: "#ef4444" },
  { range: "201–300", label: "Very Unhealthy", color: "#a855f7" },
  { range: "300+",    label: "Hazardous",      color: "#dc2626" },
]
 
// ─────────────────────────────────────────────────────────────
// HELPER — map AQI number to colour + label
// ─────────────────────────────────────────────────────────────
 
function getAqiMeta(aqi) {
  if (aqi <= 50)  return { color: "#22c55e", label: "Good",                 short: "Good"      }
  if (aqi <= 100) return { color: "#eab308", label: "Moderate",             short: "Moderate"  }
  if (aqi <= 150) return { color: "#f97316", label: "Unhealthy for Groups", short: "Sensitive" }
  if (aqi <= 200) return { color: "#ef4444", label: "Unhealthy",            short: "Unhealthy" }
  if (aqi <= 300) return { color: "#a855f7", label: "Very Unhealthy",       short: "Very Bad"  }
  return                 { color: "#dc2626", label: "Hazardous",            short: "Hazardous" }
}
 
// ─────────────────────────────────────────────────────────────
// TINY SHARED ATOMS
// ─────────────────────────────────────────────────────────────
 
function LiveDot() {
  return (
    <span className="relative flex h-2 w-2 shrink-0">
      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
      <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
    </span>
  )
}
 
// Left-bar heading used throughout the dashboard
function SectionHeading({ children }) {
  return (
    <h3 className="flex items-center gap-3 text-base font-bold text-white">
      <span className="w-0.75 h-5 rounded-full bg-linear-to-b from-cyan-400 to-blue-600 shrink-0" />
      {children}
    </h3>
  )
}
 
// Consistent glass card shell
function GlassCard({ children, className = "", accent = false }) {
  return (
    <div
      className={`relative rounded-2xl border border-white/[0.07] bg-white/3 backdrop-blur-xl overflow-hidden ${className}`}
    >
      {accent && (
        <div className="absolute top-0 left-0 right-0 h-px bg-linear-to-r from-transparent via-cyan-500/40 to-transparent" />
      )}
      {children}
    </div>
  )
}
 
// ─────────────────────────────────────────────────────────────
// NAVBAR
// ─────────────────────────────────────────────────────────────
 
function Navbar() {
  return (
    <nav className="sticky top-0 z-50 border-b border-white/6 bg-[#030712]/80 backdrop-blur-2xl">
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        <span className="font-black text-xl tracking-tight" style={{ fontFamily: "'Syne', sans-serif" }}>
          <span className="text-white">AQI</span>
          <span className="text-cyan-400">Vision</span>
        </span>
        <div className="flex items-center gap-2 text-xs text-slate-400 border border-white/[0.07] bg-white/3 px-4 py-2 rounded-full">
          <LiveDot />
          Live Prediction · India
        </div>
      </div>
    </nav>
  )
}
 
// ─────────────────────────────────────────────────────────────
// HERO
// ─────────────────────────────────────────────────────────────
 
function HeroSection({ onScrollToPredict }) {
  return (
    <section className="relative min-h-[88vh] flex flex-col items-center justify-center text-center px-6 overflow-hidden">
 
      {/* Blurred gradient orbs — purely decorative */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-32 -left-20 w-130 h-130 rounded-full bg-cyan-500/[0.07] blur-[120px]" />
        <div className="absolute top-1/3 -right-32 w-150 h-150 rounded-full bg-violet-500/6 blur-[140px]" />
        <div className="absolute -bottom-20 left-1/3 w-100 h-100 rounded-full bg-blue-500/5 blur-[100px]" />
      </div>
 
      <div className="relative z-10 flex flex-col items-center gap-7 max-w-4xl">
        <span className="text-xs font-semibold tracking-[2px] uppercase text-cyan-400 border border-cyan-400/25 bg-cyan-400/6 px-5 py-2 rounded-full">
          ✦ AI · Machine Learning · Real-Time Environmental Data
        </span>
 
        <h1
          className="font-black tracking-tighter leading-[0.9]"
          style={{ fontSize: "clamp(52px, 8vw, 96px)", fontFamily: "'Syne', sans-serif" }}
        >
          <span className="block text-white">AI Air Quality</span>
          <span className="block bg-linear-to-r from-cyan-400 via-blue-400 to-violet-500 bg-clip-text text-transparent">
            Forecasting
          </span>
        </h1>
 
        <p className="text-slate-400 text-lg font-light max-w-lg leading-relaxed">
          Predict future pollution levels for any Indian city using machine learning
          and real-time weather data. Get a full 7-day AQI outlook in seconds.
        </p>
 
        <div className="flex gap-4 mt-1 flex-wrap justify-center">
          <button
            onClick={onScrollToPredict}
            className="bg-cyan-500 hover:bg-cyan-400 text-[#030712] font-bold px-8 py-4 rounded-xl text-sm tracking-wide transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_0_40px_rgba(6,182,212,0.4)]"
          >
            Predict AQI Now
          </button>
          <button
            onClick={() => document.getElementById("dashboard")?.scrollIntoView({ behavior: "smooth" })}
            className="border border-white/10 hover:border-white/20 text-slate-300 font-semibold px-8 py-4 rounded-xl text-sm transition-all duration-200 hover:bg-white/4"
          >
            View Dashboard ↓
          </button>
        </div>
      </div>
    </section>
  )
}
 
// ─────────────────────────────────────────────────────────────
// PREDICT CARD
// ─────────────────────────────────────────────────────────────
 
function PredictCard({ onPredict, isLoading }) {
  const [selState, setSelState] = useState("")
  const [selCity, setSelCity]   = useState("")
 
  const states = State.getStatesOfCountry("IN")
  const selectedStateObj = states.find(
  (s) => s.name === selState
)

const cities = selectedStateObj
  ? City.getCitiesOfState("IN", selectedStateObj.isoCode)
  : []
 
  function handleStateChange(e) {
    setSelState(e.target.value)
    setSelCity("") // reset city whenever state changes
  }
 
  const selectBase = `
    w-full bg-white/[0.04] border border-white/[0.08] text-white rounded-xl
    px-4 py-3.5 text-sm outline-none appearance-none cursor-pointer
    focus:border-cyan-500/50 focus:ring-2 focus:ring-cyan-500/10
    hover:border-white/[0.14] transition-all duration-150
  `
 
  return (
    <div className="max-w-2xl mx-auto px-6">
      <GlassCard accent className="p-8">
        <h2 className="text-xl font-bold text-white mb-1" style={{ fontFamily: "'Syne', sans-serif" }}>
          Select Your Location
        </h2>
        <p className="text-slate-500 text-sm mb-8">
          Choose state and city — we automatically fetch weather, pollution data and run the ML model.
        </p>
 
        <div className="grid grid-cols-2 gap-4 mb-6">
          {/* State */}
          <div className="space-y-2">
            <label className="text-[11px] font-semibold uppercase tracking-widest text-slate-500">State</label>
            <div className="relative">
              <select value={selState} onChange={handleStateChange} className={selectBase}>
                <option value="" className="bg-[#0a1628]">Select state…</option>
                {states.map((state) => (
                 <option
                key={state.isoCode}
            value={state.name}
            className="bg-[#0a1628] text-white"
               >
                {state.name}
              </option>
              ))}
              </select>
              <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 text-xs">▾</span>
            </div>
          </div>
 
          {/* City */}
          <div className="space-y-2">
            <label className="text-[11px] font-semibold uppercase tracking-widest text-slate-500">City</label>
            <div className="relative">
              <select
                value={selCity}
                onChange={e => setSelCity(e.target.value)}
                disabled={!selState}
                className={`${selectBase} disabled:opacity-40 disabled:cursor-not-allowed`}
              >
                <option value="" className="bg-[#0a1628]">Select city…</option>
                {cities.map((city) => (
                 <option
                   key={city.name}
                   value={city.name}
                   className="bg-[#0a1628] text-white"
                 >
                   {city.name}
                 </option>
                ))}
              </select>
              <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 text-xs">▾</span>
            </div>
          </div>
        </div>
 
        <button
          onClick={() => selState && selCity && onPredict(selState, selCity)}
          disabled={!selState || !selCity || isLoading}
          className="
            w-full bg-linear-to-r from-cyan-500 to-blue-600
            hover:from-cyan-400 hover:to-blue-500
            disabled:opacity-40 disabled:cursor-not-allowed
            text-white font-bold text-sm py-4 rounded-xl tracking-wide
            transition-all duration-200 hover:shadow-[0_0_48px_rgba(6,182,212,0.35)]
            hover:-translate-y-0.5 flex items-center justify-center gap-2.5
          "
        >
          {isLoading ? (
            <>
              <span className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
              Analyzing data…
            </>
          ) : (
            "✦ Generate AI Forecast"
          )}
        </button>
      </GlassCard>
    </div>
  )
}
 
// ─────────────────────────────────────────────────────────────
// LOADING OVERLAY
// ─────────────────────────────────────────────────────────────
 
function LoadingOverlay({ message }) {
  return (
    <div className="fixed inset-0 z-100 bg-[#030712]/95 backdrop-blur-lg flex flex-col items-center justify-center gap-6">
      <div className="relative h-16 w-16">
        <div className="h-16 w-16 rounded-full border-2 border-white/10 border-t-cyan-400 animate-spin" />
        <div
          className="absolute inset-2 rounded-full border-2 border-white/5 border-b-blue-500 animate-spin"
          style={{ animationDirection: "reverse", animationDuration: "0.6s" }}
        />
      </div>
      <div className="text-center space-y-1">
        <p className="text-slate-200 text-base">{message}</p>
        <p className="text-slate-600 text-xs">Powered by ML Prediction Engine</p>
      </div>
    </div>
  )
}
 
// ─────────────────────────────────────────────────────────────
// AQI CIRCULAR GAUGE
// ─────────────────────────────────────────────────────────────
 
function AqiGauge({ aqi }) {
  aqi = Number(aqi) || 0
  const meta   = getAqiMeta(aqi)
  const radius = 70
  const stroke = 10
  const size   = (radius + stroke) * 2   // 160px
  const circ   = 2 * Math.PI * radius
  const offset = circ - Math.min(aqi / 300, 1) * circ
 
  return (
    <GlassCard accent className="p-8 flex flex-col items-center justify-center text-center">
      {/* Soft colour glow behind the ring */}
      <div
        className="absolute inset-0 opacity-[0.08] blur-[70px] pointer-events-none"
        style={{ background: `radial-gradient(circle at 50% 40%, ${meta.color}, transparent 65%)` }}
      />
 
      {/* SVG ring — rotated so the start is at the top */}
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: "rotate(-90deg)" }}>
          {/* Grey track */}
          <circle
            cx={size / 2} cy={size / 2} r={radius}
            fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={stroke}
          />
          {/* Coloured progress */}
          <circle
            cx={size / 2} cy={size / 2} r={radius}
            fill="none" stroke={meta.color} strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={circ}
            strokeDashoffset={offset}
            style={{ transition: "stroke-dashoffset 1.2s ease, stroke 0.4s ease" }}
          />
        </svg>
 
        {/* Number in the centre — absolutely positioned inside the SVG wrapper */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span
            className="font-black leading-none"
            style={{ fontSize: 46, color: meta.color, fontFamily: "'Syne', sans-serif" }}
          >
            {aqi}
          </span>
          <span className="text-[10px] text-slate-500 uppercase tracking-widest mt-1">AQI Index</span>
        </div>
      </div>
 
      {/* Label + description */}
      <p className="font-bold text-lg mt-5" style={{ color: meta.color, fontFamily: "'Syne', sans-serif" }}>
        {meta.label}
      </p>
      <p className="text-slate-500 text-xs mt-1 max-w-50 leading-relaxed">
        Air quality may affect sensitive groups. Take necessary precautions.
      </p>
 
      {/* Mini gradient bar */}
      <div className="w-full mt-6">
        <div
          className="h-1.5 rounded-full"
          style={{ background: "linear-gradient(90deg,#22c55e 0%,#eab308 30%,#f97316 55%,#ef4444 72%,#a855f7 100%)" }}
        />
        <div className="flex justify-between text-[9px] text-slate-600 mt-1">
          <span>Good</span><span>Moderate</span><span>Unhealthy</span><span>Hazardous</span>
        </div>
      </div>
    </GlassCard>
  )
}
 
// ─────────────────────────────────────────────────────────────
// POLLUTANT STATS GRID
// ─────────────────────────────────────────────────────────────
 
function PollutantsGrid({ data }) {
const items = [
  { label: "PM2.5", value: data.pm25, unit: "µg/m³", pct: Math.min((data.pm25 / 250) * 100, 100), color: "#f97316" },
  { label: "PM10",  value: data.pm10, unit: "µg/m³", pct: Math.min((data.pm10 / 430) * 100, 100), color: "#eab308" },
  { label: "NO₂",   value: data.no2,  unit: "µg/m³", pct: Math.min((data.no2  / 200) * 100, 100), color: "#38bdf8" },
  { label: "CO",    value: data.co,   unit: "mg/m³", pct: Math.min((data.co   / 10)  * 100, 100), color: "#22c55e" },
  { label: "SO₂",   value: data.so2,  unit: "µg/m³", pct: Math.min((data.so2  / 350) * 100, 100), color: "#a78bfa" },
  { label: "O₃",    value: data.o3,   unit: "µg/m³", pct: Math.min((data.o3   / 180) * 100, 100), color: "#818cf8" },
]
 
  return (
    <GlassCard className="p-7">
      <SectionHeading>Current Pollutant Levels</SectionHeading>
      <div className="grid grid-cols-2 gap-3 mt-5">
        {items.map(item => (
          <div
            key={item.label}
            className="bg-white/2.5 border border-white/5 rounded-xl p-4 hover:border-white/10 transition-colors"
          >
            <p className="text-[10px] uppercase tracking-widest text-slate-500 mb-2">{item.label}</p>
            <p className="font-black text-2xl text-white leading-none" style={{ fontFamily: "'Syne', sans-serif" }}>
              {item.value}
              <span className="text-slate-600 text-xs font-normal ml-1">{item.unit}</span>
            </p>
            <div className="mt-3 h-0.5 rounded-full bg-white/6">
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{ width: `${item.pct}%`, backgroundColor: item.color }}
              />
            </div>
          </div>
        ))}
      </div>
    </GlassCard>
  )
}
 
// ─────────────────────────────────────────────────────────────
// 7-DAY FORECAST STRIP
// ─────────────────────────────────────────────────────────────
 
function ForecastStrip({ forecast, selectedDay, onSelect }) {
  return (
    <div className="grid grid-cols-7 gap-3">
      {forecast.map((day, i) => {
        const meta     = getAqiMeta(day.aqi)
        const isActive = selectedDay === i
 
        return (
          <button
            key={day.day}
            onClick={() => onSelect(i)}
            className={`
              relative flex flex-col items-center pt-8 pb-4 px-2 rounded-2xl border
              transition-all duration-200 cursor-pointer hover:-translate-y-1 w-full
              ${isActive
                ? "border-cyan-500/40 bg-cyan-500/6 shadow-[0_0_28px_rgba(6,182,212,0.1)]"
                : "border-white/6 bg-white/2 hover:border-white/12 hover:bg-white/4"
              }
            `}
          >
            {i === 0 && (
              <span className="absolute top-2 left-1/2 -translate-x-1/2 text-[8px] font-bold text-cyan-400 bg-cyan-500/15 border border-cyan-500/30 px-2 py-0.5 rounded-full whitespace-nowrap">
                TODAY
              </span>
            )}
 
            <p className="text-[10px] text-slate-500 mb-2">{day.day}</p>
 
            <p
              className="font-black text-3xl leading-none"
              style={{ color: meta.color, fontFamily: "'Syne', sans-serif" }}
            >
              {day.aqi}
            </p>
 
            <p className="text-[9px] font-bold mt-2" style={{ color: meta.color }}>
              {meta.short}
            </p>
 
            <div className="w-full mt-3 h-0.5 rounded-full bg-white/6">
              <div
                className="h-full rounded-full"
                style={{ width: `${Math.round((day.aqi / 300) * 100)}%`, backgroundColor: meta.color }}
              />
            </div>
          </button>
        )
      })}
    </div>
  )
}
 
// ─────────────────────────────────────────────────────────────
// TREND CHARTS (Recharts, 3 tabs)
// ─────────────────────────────────────────────────────────────
 
function DarkTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-[#0a1628] border border-white/10 rounded-xl px-4 py-3 text-xs shadow-2xl">
      <p className="text-slate-400 font-semibold mb-2">{label}</p>
      {payload.map(p => (
        <p key={p.dataKey} style={{ color: p.color }} className="font-bold py-0.5">
          {p.name}: {p.value}
        </p>
      ))}
    </div>
  )
}
 
function TrendCharts({ forecast }) {
  const [activeTab, setActiveTab] = useState("aqi")
 
  const tabs = [
    { id: "aqi",     label: "AQI Forecast"    },
    { id: "pm25",    label: "PM2.5 Trend"     },
    { id: "weather", label: "Temp & Humidity"  },
  ]
 
  return (
    <GlassCard className="p-7">
      <SectionHeading>Trend Analytics</SectionHeading>
 
      <div className="flex gap-2 mt-5 mb-7 flex-wrap">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={`
              text-xs font-semibold px-4 py-2 rounded-full border transition-all duration-150
              ${activeTab === t.id
                ? "bg-cyan-500/10 border-cyan-500/40 text-cyan-400"
                : "border-white/[0.07] text-slate-500 hover:text-slate-300 hover:border-white/[0.14]"
              }
            `}
          >
            {t.label}
          </button>
        ))}
      </div>
 
      <div className="h-56">
        <ResponsiveContainer width="100%" height="100%">
          {activeTab === "aqi" ? (
            <AreaChart data={forecast} margin={{ left: -20, right: 10 }}>
              <defs>
                <linearGradient id="aqiGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#f97316" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#f97316" stopOpacity={0}    />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
              <XAxis dataKey="day"  tick={{ fill: "#64748b", fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis              tick={{ fill: "#64748b", fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip content={<DarkTooltip />} />
              <Area
                type="monotone" dataKey="aqi" name="AQI"
                stroke="#f97316" strokeWidth={2.5} fill="url(#aqiGrad)"
                dot={{ fill: "#f97316", r: 4, strokeWidth: 0 }}
                activeDot={{ r: 6, fill: "#f97316" }}
              />
            </AreaChart>
          ) : activeTab === "pm25" ? (
            <AreaChart data={forecast} margin={{ left: -20, right: 10 }}>
              <defs>
                <linearGradient id="pmGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#a78bfa" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#a78bfa" stopOpacity={0}    />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
              <XAxis dataKey="day"  tick={{ fill: "#64748b", fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis              tick={{ fill: "#64748b", fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip content={<DarkTooltip />} />
              <Area
                type="monotone" dataKey="pm25" name="PM2.5 (µg/m³)"
                stroke="#a78bfa" strokeWidth={2.5} fill="url(#pmGrad)"
                dot={{ fill: "#a78bfa", r: 4, strokeWidth: 0 }}
                activeDot={{ r: 6 }}
              />
            </AreaChart>
          ) : (
            <LineChart data={forecast} margin={{ left: -20, right: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
              <XAxis dataKey="day"  tick={{ fill: "#64748b", fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis              tick={{ fill: "#64748b", fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip content={<DarkTooltip />} />
              <Legend wrapperStyle={{ fontSize: "11px", color: "#64748b", paddingTop: "12px" }} />
              <Line type="monotone" dataKey="temp"     name="Temperature (°C)" stroke="#f97316" strokeWidth={2.5} dot={{ r: 4, fill: "#f97316",  strokeWidth: 0 }} />
              <Line type="monotone" dataKey="humidity" name="Humidity (%)"      stroke="#38bdf8" strokeWidth={2.5} dot={{ r: 4, fill: "#38bdf8",  strokeWidth: 0 }} />
            </LineChart>
          )}
        </ResponsiveContainer>
      </div>
    </GlassCard>
  )
}
 
// ─────────────────────────────────────────────────────────────
// WEATHER CARD
// ─────────────────────────────────────────────────────────────
 
function WeatherCard({ weather }) {
  const rows = [
    { label: "🌡 Temperature",    value: `${weather.temperature}°C`,    badge: "High",    badgeCls: "text-orange-400 bg-orange-400/10"   },
    { label: "💧 Humidity",       value: `${weather.humidity}%`,         badge: "Humid",   badgeCls: "text-blue-400 bg-blue-400/10"       },
    { label: "💨 Wind Speed",     value: `${weather.windSpeed} km/h`,    badge: "Light",   badgeCls: "text-emerald-400 bg-emerald-400/10" },
    { label: "🌫 Visibility",     value: `${weather.visibility} km`,     badge: "Reduced", badgeCls: "text-amber-400 bg-amber-400/10"     },
    { label: "🌧 Precipitation",  value: `${weather.precipitation} mm`,  badge: "Clear",   badgeCls: "text-emerald-400 bg-emerald-400/10" },
    { label: "📊 Pressure",       value: `${weather.pressure} hPa`,      badge: "Normal",  badgeCls: "text-slate-400 bg-slate-400/10"     },
  ]
 
  return (
    <GlassCard className="p-7">
      <SectionHeading>Weather Conditions</SectionHeading>
      <div className="mt-5 space-y-0">
        {rows.map(r => (
          <div key={r.label} className="flex items-center justify-between py-2.5 border-b border-white/4 last:border-b-0">
            <span className="text-slate-400 text-sm">{r.label}</span>
            <div className="flex items-center gap-2.5">
              <span className="font-semibold text-sm text-white">{r.value}</span>
              <span className={`text-[10px] font-semibold px-2.5 py-0.5 rounded-full ${r.badgeCls}`}>
                {r.badge}
              </span>
            </div>
          </div>
        ))}
      </div>
    </GlassCard>
  )
}
 
// ─────────────────────────────────────────────────────────────
// POLLUTANT DETAIL CARD
// ─────────────────────────────────────────────────────────────
 
function PollutantDetailCard({ data }) {
  const rows = [
    { label: "NO",      value: `${data.no} µg/m³`,       badge: "Safe",     badgeCls: "text-emerald-400 bg-emerald-400/10" },
    { label: "NO₂",     value: `${data.no2} µg/m³`,      badge: "Moderate", badgeCls: "text-amber-400 bg-amber-400/10"     },
    { label: "NOx",     value: `${data.nox} µg/m³`,      badge: "Moderate", badgeCls: "text-amber-400 bg-amber-400/10"     },
    { label: "NH₃",     value: `${data.nh3} µg/m³`,      badge: "Normal",   badgeCls: "text-emerald-400 bg-emerald-400/10" },
    { label: "Benzene", value: `${data.benzene} µg/m³`,   badge: "High",     badgeCls: "text-red-400 bg-red-400/10"         },
    { label: "Toluene", value: `${data.toluene} µg/m³`,   badge: "Moderate", badgeCls: "text-amber-400 bg-amber-400/10"     },
  ]
 
  return (
    <GlassCard className="p-7">
      <SectionHeading>Detailed Pollutants</SectionHeading>
      <div className="mt-5 space-y-0">
        {rows.map(r => (
          <div key={r.label} className="flex items-center justify-between py-2.5 border-b border-white/4 last:border-b-0">
            <span className="text-slate-400 text-sm">{r.label}</span>
            <div className="flex items-center gap-2.5">
              <span className="font-semibold text-sm text-white">{r.value}</span>
              <span className={`text-[10px] font-semibold px-2.5 py-0.5 rounded-full ${r.badgeCls}`}>
                {r.badge}
              </span>
            </div>
          </div>
        ))}
      </div>
    </GlassCard>
  )
}
 
// ─────────────────────────────────────────────────────────────
// HEALTH RECOMMENDATION CARDS
// ─────────────────────────────────────────────────────────────
function HealthRecommendations({ aqi }) {
  const tips = aqi <= 50 ? [
    { icon: "✅", title: "Air Quality Good", desc: "Enjoy outdoor activities freely. Air quality poses little or no risk today.", level: "Safe", levelColor: "text-emerald-400", levelBg: "bg-emerald-400/10 border-emerald-400/20" },
    { icon: "🏃", title: "Exercise Freely", desc: "Great day for outdoor workouts, jogging, or cycling. No restrictions needed.", level: "Safe", levelColor: "text-emerald-400", levelBg: "bg-emerald-400/10 border-emerald-400/20" },
    { icon: "👶", title: "Children & Elderly", desc: "Safe for all groups including children and elderly. Normal outdoor activities fine.", level: "Safe", levelColor: "text-emerald-400", levelBg: "bg-emerald-400/10 border-emerald-400/20" },
  ] : aqi <= 100 ? [
    { icon: "😐", title: "Moderate Air Quality", desc: "Unusually sensitive people should consider reducing prolonged outdoor exertion.", level: "Moderate", levelColor: "text-yellow-400", levelBg: "bg-yellow-400/10 border-yellow-400/20" },
    { icon: "🏃", title: "Outdoor Exercise", desc: "Mostly fine for outdoor activities. Sensitive individuals may want shorter sessions.", level: "Caution", levelColor: "text-amber-400", levelBg: "bg-amber-400/10 border-amber-400/20" },
    { icon: "💧", title: "Stay Hydrated", desc: "Drink plenty of water. Mild pollution exposure stresses your respiratory system.", level: "General", levelColor: "text-sky-400", levelBg: "bg-sky-400/10 border-sky-400/20" },
  ] : aqi <= 150 ? [
    { icon: "😷", title: "Wear a Mask", desc: "Sensitive groups should wear masks outdoors, especially near traffic-heavy areas.", level: "Warning", levelColor: "text-orange-400", levelBg: "bg-orange-400/10 border-orange-400/20" },
    { icon: "🫁", title: "Asthma Patients", desc: "Reduce outdoor time. Keep your inhaler accessible at all times.", level: "Warning", levelColor: "text-orange-400", levelBg: "bg-orange-400/10 border-orange-400/20" },
    { icon: "🏃", title: "Limit Outdoor Exercise", desc: "Exercise indoors or go out only before 7 AM when pollution levels are lower.", level: "Caution", levelColor: "text-amber-400", levelBg: "bg-amber-400/10 border-amber-400/20" },
    { icon: "👶", title: "Children & Elderly", desc: "Minimize outdoor exposure for sensitive groups. Prefer indoor activities.", level: "High Risk", levelColor: "text-red-400", levelBg: "bg-red-400/10 border-red-400/20" },
    { icon: "🌿", title: "Use Air Purifiers", desc: "Run air purifiers indoors. Keep windows shut between 10 AM and 6 PM.", level: "Advised", levelColor: "text-emerald-400", levelBg: "bg-emerald-400/10 border-emerald-400/20" },
  ] : [
    { icon: "😷", title: "Wear N95 Mask", desc: "N95 or KN95 masks are strongly recommended for all outdoor activity.", level: "High Risk", levelColor: "text-red-400", levelBg: "bg-red-400/10 border-red-400/20" },
    { icon: "🫁", title: "Asthma Patients", desc: "Stay indoors entirely. Keep emergency medication ready and accessible.", level: "High Risk", levelColor: "text-red-400", levelBg: "bg-red-400/10 border-red-400/20" },
    { icon: "🏃", title: "No Outdoor Exercise", desc: "Avoid all outdoor physical activity. Exercise only in well-ventilated indoor spaces.", level: "High Risk", levelColor: "text-red-400", levelBg: "bg-red-400/10 border-red-400/20" },
    { icon: "👶", title: "Children & Elderly", desc: "Keep all sensitive groups strictly indoors. Hazardous conditions outside.", level: "High Risk", levelColor: "text-red-400", levelBg: "bg-red-400/10 border-red-400/20" },
    { icon: "🌿", title: "Use Air Purifiers", desc: "Run all purifiers on maximum. Seal windows and doors completely.", level: "Critical", levelColor: "text-red-400", levelBg: "bg-red-400/10 border-red-400/20" },
    { icon: "🏥", title: "Seek Medical Help", desc: "If experiencing chest pain, shortness of breath, or dizziness — seek medical help immediately.", level: "Critical", levelColor: "text-red-400", levelBg: "bg-red-400/10 border-red-400/20" },
  ]

  return (
    <div>
      <SectionHeading>Health Recommendations</SectionHeading>
      <div className="grid grid-cols-3 gap-4 mt-5">
        {tips.map(tip => (
          <GlassCard key={tip.title} className="p-5 hover:border-white/12 transition-colors duration-150 cursor-default">
            <div className="text-3xl mb-4">{tip.icon}</div>
            <h4 className="font-bold text-sm text-white mb-2">{tip.title}</h4>
            <p className="text-slate-500 text-xs leading-relaxed">{tip.desc}</p>
            <span className={`inline-block mt-4 text-[10px] font-bold tracking-wide uppercase px-3 py-1 rounded-full border ${tip.levelBg} ${tip.levelColor}`}>
              {tip.level}
            </span>
          </GlassCard>
        ))}
      </div>
    </div>
  )
}
 
// ─────────────────────────────────────────────────────────────
// AQI SCALE REFERENCE
// ─────────────────────────────────────────────────────────────
 
function AqiScaleBar({ currentAqi }) {
  // Keep the marker dot visible even at extremes
  const markerPct = Math.min(Math.max((currentAqi / 300) * 100, 1), 97)
 
  return (
    <GlassCard className="p-7">
      <SectionHeading>AQI Scale Reference</SectionHeading>
      <p className="text-slate-500 text-xs mt-2">
        Current AQI: <span className="text-orange-400 font-bold">{currentAqi}</span> — Unhealthy for Sensitive Groups
      </p>
 
      {/* Gradient bar */}
      <div className="relative mt-6">
        <div
          className="h-3 rounded-full"
          style={{ background: "linear-gradient(90deg,#22c55e 0%,#eab308 28%,#f97316 50%,#ef4444 68%,#a855f7 84%,#dc2626 100%)" }}
        />
        {/* Marker dot with orange glow */}
        <div
          className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-5 h-5 bg-white rounded-full border-[3px] border-orange-400 transition-all"
          style={{ left: `${markerPct}%`, boxShadow: "0 0 16px rgba(249,115,22,0.7)" }}
        />
      </div>
 
      {/* Scale tick labels */}
      <div className="flex justify-between text-[9px] text-slate-600 mt-2 px-0.5">
        <span>0</span><span>50</span><span>100</span><span>150</span><span>200</span><span>300+</span>
      </div>
 
      {/* Legend tiles */}
      <div className="grid grid-cols-6 gap-3 mt-7">
        {AQI_SCALE.map(s => (
          <div key={s.label} className="text-center">
            <div
              className="w-3.5 h-3.5 rounded-full mx-auto mb-2"
              style={{ backgroundColor: s.color, boxShadow: `0 0 10px ${s.color}55` }}
            />
            <p className="font-bold text-xs" style={{ color: s.color }}>{s.range}</p>
            <p className="text-[9px] text-slate-600 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>
    </GlassCard>
  )
}
 
// ─────────────────────────────────────────────────────────────
// FOOTER
// ─────────────────────────────────────────────────────────────
 
function Footer() {
  return (
    <footer className="border-t border-white/6 mt-20 py-12">
      <div className="max-w-7xl mx-auto px-6">
        <div className="grid grid-cols-3 gap-12 mb-10">
          <div>
            <span className="font-black text-lg block mb-3" style={{ fontFamily: "'Syne', sans-serif" }}>
              <span className="text-white">AQI</span>
              <span className="text-cyan-400">Vision</span>
            </span>
            <p className="text-slate-600 text-sm leading-relaxed">
              AI-powered air quality forecasting for Indian cities. Built as an engineering
              minor project using MERN, Flask, and machine learning.
            </p>
          </div>
          <div>
            <h4 className="text-[10px] font-bold uppercase tracking-widest text-slate-600 mb-4">Tech Stack</h4>
            <ul className="space-y-2 text-slate-600 text-sm">
              {["React.js + Vite", "Node.js + Express", "Python Flask ML", "Tailwind CSS", "Recharts"].map(t => (
                <li key={t}>{t}</li>
              ))}
            </ul>
          </div>
          <div>
            <h4 className="text-[10px] font-bold uppercase tracking-widest text-slate-600 mb-4">Data Sources</h4>
            <ul className="space-y-2 text-slate-600 text-sm">
              {["OpenWeather API", "Air Pollution API", "Geocoding API", "CPCB Data", "RandomForest ML Model"].map(t => (
                <li key={t}>{t}</li>
              ))}
            </ul>
          </div>
        </div>
 
        <div className="border-t border-white/5 pt-6 flex justify-between items-center flex-wrap gap-4">
          <p className="text-slate-700 text-xs">© 2025 AQIVision · Engineering Minor Project · AIML Department</p>
          <div className="flex gap-2 flex-wrap">
            {["Team AQIVision", "MERN Stack", "Flask ML"].map(t => (
              <span key={t} className="text-[10px] text-slate-600 border border-white/6 bg-white/2 px-3 py-1 rounded-full">
                {t}
              </span>
            ))}
          </div>
        </div>
      </div>
    </footer>
  )
}
 
// ─────────────────────────────────────────────────────────────
// ROOT APP
// ─────────────────────────────────────────────────────────────
 
export default function App() {
  // Core state
  const [isLoading,    setIsLoading]    = useState(false)
  const [loadingMsg,   setLoadingMsg]   = useState(LOADING_MESSAGES[0])
  const [hasPredicted, setHasPredicted] = useState(false)   // true = show dashboard in demo mode
  const [city,  setCity]   = useState("Mumbai")
  const [state, setState]  = useState("Maharashtra")
  const [predictedAqi, setPredictedAqi] = useState(null)
  const [selectedDay, setSelectedDay]   = useState(0)
 
  // In the real version these would come from useState + axios response
  const [forecast, setForecast] = useState(DUMMY_FORECAST)
  const [weather, setWeather] = useState(DUMMY_WEATHER)
  const [pollutants, setPollutants] = useState(DUMMY_POLLUTANTS)
  const [currentAqi, setCurrentAqi] = useState(142)
 
  const predictRef = useRef(null)
 
  // Cycle loading messages while the fake (or real) API call is running
  useEffect(() => {
    if (!isLoading) return
    let i = 0
    const id = setInterval(() => {
      i++
      setLoadingMsg(LOADING_MESSAGES[i % LOADING_MESSAGES.length])
    }, 900)
    return () => clearInterval(id)
  }, [isLoading])
 
  // Triggered by PredictCard — simulates the backend round-trip
  // Replace the setTimeout with: const res = await axios.post('/api/predict', { state, city })
  async function handlePredict(selState, selCity) {

  try {

    setIsLoading(true)

    setState(selState)
    setCity(selCity)
    setSelectedDay(0)

    // CALL NODE BACKEND
    const res = await axios.post(
      "http://localhost:5000/predict",
      {
        state: selState,
        city: selCity,
      }
    )

    console.log("FULL RESPONSE:", res.data)

    // GET AQI
    const predictedAQI = Number(res.data.predicted_aqi)
  
    setWeather(res.data.weather)

    setPollutants(res.data.pollutants)
      if (isNaN(predictedAQI)) {
       alert("Invalid AQI received")
      return
        }

    // UPDATE AQI
    setCurrentAqi(predictedAQI)
    setPredictedAqi(predictedAQI)

    // UPDATE FORECAST
const formattedForecast = res.data.forecast.map((item) => {

  const dateObj = new Date(item.date)

  return {
    ...item,

    day: dateObj.toLocaleDateString("en-US", {
      weekday: "short"
    }),

    date: dateObj.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric"
    })
  }
})

setForecast(formattedForecast)

    setHasPredicted(true)

    document
      .getElementById("dashboard")
      ?.scrollIntoView({ behavior: "smooth" })

  } catch (err) {

    console.log(err)

    alert("Prediction failed")

  } finally {

    setIsLoading(false)

  }
}
  return (
    <div
      className="min-h-screen text-white"
      style={{ backgroundColor: "#030712", fontFamily: "'DM Sans', sans-serif" }}
    >
      {isLoading && <LoadingOverlay message={loadingMsg} />}
 
      <Navbar />
 
      <HeroSection
        onScrollToPredict={() => predictRef.current?.scrollIntoView({ behavior: "smooth" })}
      />
 
      {/* Predict card */}
      <div ref={predictRef} className="pb-16">
        <PredictCard onPredict={handlePredict} isLoading={isLoading} />
      </div>
 
      {/* Dashboard — only shown after first prediction (or in demo mode) */}
      {hasPredicted && (
        <section id="dashboard" className="max-w-7xl mx-auto px-6 pb-8 space-y-7">
 
          {/* Header row */}
          <div className="flex items-start justify-between flex-wrap gap-4">
            <div>
              <h2
                className="text-4xl font-black tracking-tight"
                style={{ fontFamily: "'Syne', sans-serif" }}
              >
                {city}, <span className="text-cyan-400">{state}</span>
              </h2>
              <p className="text-slate-500 text-sm mt-1.5">
                7-Day AQI Forecast · ML Model v2.4 · Updated just now
              </p>
            </div>
            <div className="flex items-center gap-2 text-xs text-emerald-400 bg-emerald-500/[0.07] border border-emerald-500/20 px-4 py-2 rounded-full">
              <LiveDot />
              Live prediction active
            </div>
          </div>
 
          {/* Row 1 — Gauge left, pollutant grid right */}
          <div className="grid gap-5" style={{ gridTemplateColumns: "260px 1fr" }}>
            <AqiGauge aqi={currentAqi} />
            <PollutantsGrid data={pollutants} />
          </div>
 
          {/* Row 2 — 7-day forecast strip */}
          <div className="space-y-4">
            <SectionHeading>7-Day AQI Forecast</SectionHeading>
            <ForecastStrip
              forecast={forecast}
              selectedDay={selectedDay}
              onSelect={setSelectedDay}
            />
          </div>
 
          {/* Row 3 — Trend charts */}
          <TrendCharts forecast={forecast} />
 
          {/* Row 4 — Weather + Pollutant detail side by side */}
          <div className="grid grid-cols-2 gap-5">
            <WeatherCard weather={weather} />
            <PollutantDetailCard data={pollutants} />
          </div>
 
          {/* Row 5 — Health recommendations */}
          <HealthRecommendations aqi={currentAqi} />
 
          {/* Row 6 — AQI scale reference */}
          <AqiScaleBar currentAqi={currentAqi} />
 
        </section>
      )}
 
      <Footer />
    </div>
  )
}