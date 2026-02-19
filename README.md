# Theru Fleet Admin Panel

Admin dashboard for Theru Fleet Ad Network.

## Setup

### Backend
```bash
cd backend
cp .env.example .env
# Edit .env with your credentials
pip install -r requirements.txt
uvicorn server:app --host 0.0.0.0 --port 8001
```

### Frontend
```bash
cd frontend
cp .env.example .env
npm install
npm start
```

## Features
- Dashboard with real-time stats
- Device management
- Campaign management with video upload
- Client management
- Analytics with CSV export
