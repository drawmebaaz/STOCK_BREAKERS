# StockBreakers — Full Build Guide

## Tech Stack
- **Frontend**: React (Vite) + Tailwind + Zustand + Recharts
- **Backend**: Node/Express + MongoDB + JWT + Socket.io
- **ML Service**: FastAPI + NumPy/Pandas + Historical Bootstrap Monte Carlo

## Setup Order
```
1. Start MongoDB
2. Start ML service  (port 8000)
3. Start Node server (port 5000)
4. Start React client (port 5173)
```

## Quick Start
```bash
# 1. ML Service
cd ml-service
pip install fastapi uvicorn numpy pandas
uvicorn main:app --reload --port 8000

# 2. Server
cd server
npm install
npm run dev

# 3. Client
cd client
npm install
npm run dev
```

## Environment Variables

### server/.env
```
PORT=5000
MONGO_URI=mongodb://localhost:27017/stockbreakers
JWT_SECRET=your_super_secret_key_here
ML_SERVICE_URL=http://localhost:8000
CLIENT_URL=http://localhost:5173
```

### client/.env
```
VITE_API_URL=http://localhost:5000/api
VITE_SOCKET_URL=http://localhost:5000
```
