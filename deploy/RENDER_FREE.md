# Render Free Deployment

Use this when you want the full StockBreakers app on one Render URL.

## What This Deploys

- React frontend served by the Express server
- Express API and Socket.IO on the same domain
- FastAPI research service running privately inside the same Docker container
- MongoDB Atlas as the external database

## Steps

1. Create a free MongoDB Atlas cluster.
2. Add a database user and allow network access from Render.
3. Copy the Atlas connection string. It should look like:

```text
mongodb+srv://USER:PASSWORD@CLUSTER.mongodb.net/stockbreakers?retryWrites=true&w=majority
```

4. In Render, choose **New > Blueprint**.
5. Connect `drawmebaaz/STOCK_BREAKERS`.
6. Render will read `render.yaml`.
7. Paste the Atlas connection string into the private `MONGO_URI` field.
8. Deploy.

The expected app URL from the blueprint is:

```text
https://stockbreakers-paper-lab.onrender.com
```

If Render asks you to rename the service because the name is already taken, rename it and update `CLIENT_URL` and `CORS_ORIGINS` to match the new URL.

## Demo User

After the first successful deploy, seed the demo account from a trusted terminal:

```bash
cd server
MONGO_URI="your-atlas-connection-string" JWT_SECRET="use-the-render-secret-or-any-64-character-secret" npm run seed:demo
```

Demo login:

```text
Email: demo@stockbreakers.local
Password: DemoPass123!
```

Never commit the real `MONGO_URI` or `JWT_SECRET`.
