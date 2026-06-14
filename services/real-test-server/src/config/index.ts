import dotenv from "dotenv";
if (process.env.NODE_ENV === "production") {
  const cfg = `./.env.${process.env.NODE_ENV}`;
  dotenv.config({ path: cfg });
} else {
  dotenv.config();
}

export default {
  NODE_ENV: process.env.NODE_ENV,
  GOOGLE_CLIENT_ID: process.env.CLIENT_ID,
  GOOGLE_CLIENT_SECRET: process.env.CLIENT_SECRET,
  FRONTEND_URL: process.env.FRONTEND_URL,
  GITHUB_CLIENT_ID: process.env.GITHUB_CLIENT_ID,
  GITHUB_CLIENT_SECRET: process.env.GITHUB_CLIENT_SECRET,
  NOTIFICATION_GRPC_URL: process.env.NOTIFICATION_GRPC_URL,
  MONGO_URI: process.env.MONGO_URI,
  DODO_PAYMENTS_API_KEY: process.env.DODO_API_KEY,
  DODO_PRODUCT_PRO: process.env.DODO_PRODUCT_PRO,
  DODO_PRODUCT_SEAT: process.env.DODO_PRODUCT_SEAT,
  DODO_PRODUCT_TEAM: process.env.DODO_PRODUCT_TEAM,
  WEBHOOK_SECRET: process.env.WEBHOOK_SECRET,
  BACKEND_URL: process.env.BACKEND_URL,
};
