# Xenon Auth

Xenon Auth is a Baryonic Authentication system that turns TOTP outputs into a 3-word code array.

## Project Structure

- backend: FastAPI + core TOTP and word mapping utilities
- frontend: React + Vite web client
- mobile: Expo React Native app for iOS/Android

## Mobile (Expo)

1. Open a terminal in mobile.
2. Install dependencies:
	npm install
3. Start Expo:
	npm run start
4. Scan the QR in Expo Go on your phone.

## Backend

1. Open terminal in backend.
2. Install deps:
	pip install -r requirements.txt
3. Run API:
	uvicorn app.main:app --reload

## Web Frontend

1. Open terminal in frontend.
2. Install deps:
	npm install
3. Run:
	npm run dev
