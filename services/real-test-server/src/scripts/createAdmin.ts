import dotenv from "dotenv";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import { User } from "../models/user.model";

dotenv.config();

const ADMIN = {
  name: "Admin",
  email: "admin@brand.com",
  password: "Admin@123",
};

const run = async () => {
  const uri = process.env.MONGODB_URI || "mongodb://localhost:27017/ecom";
  await mongoose.connect(uri);
  console.log("Connected to MongoDB");

  const existing = await User.findOne({ email: ADMIN.email });
  if (existing) {
    if (existing.role !== "admin") {
      existing.role = "admin";
      await existing.save();
      console.log(`Updated existing user "${ADMIN.email}" to admin role.`);
    } else {
      console.log(`Admin "${ADMIN.email}" already exists.`);
    }
    await mongoose.disconnect();
    return;
  }

  const hashed = await bcrypt.hash(ADMIN.password, 10);
  await User.create({
    name: ADMIN.name,
    email: ADMIN.email,
    password: hashed,
    isVerified: true,
    role: "admin",
  });

  console.log("Admin created:");
  console.log(`  Email:    ${ADMIN.email}`);
  console.log(`  Password: ${ADMIN.password}`);
  await mongoose.disconnect();
};

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
