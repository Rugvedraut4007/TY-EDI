# MedSure — application

This folder contains the MedSure application:

- **`src/`** — React frontend (Tailwind CSS)
- **`server/`** — Node.js + Express + PostgreSQL backend

## Run it

Full step-by-step instructions (database setup, seeding, demo accounts and a suggested walkthrough) are in
the README **one level up**, at [`../README.md`](../README.md).

Quick version:

```bash
# 1. backend
cd server
cp .env.example .env      # then set your PostgreSQL password
npm install
npm run seed              # creates tables + demo data
npm start                 # http://localhost:5000

# 2. frontend (second terminal)
cd ..
npm install
npm start                 # http://localhost:3000
```

Demo logins are printed by `npm run seed` (`admin@medsure.in` / `Admin@123`, and
`manufacturer@medsure.in`, `distributor@medsure.in`, `pharmacist@medsure.in`, `customer@medsure.in`
all with `Password@123`).
