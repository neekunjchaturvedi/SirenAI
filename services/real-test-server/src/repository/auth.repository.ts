import crypto from "crypto";
import bcrypt from "bcryptjs";
import { User, Otp, ResetPassword } from "../models";

// --- User Operations ---

export const findUserByEmail = async (email: string) => {
  return User.findOne({ email });
};

export const findUserById = async (id: string) => {
  return User.findById(id).select("-password");
};

export const createUser = async (data: {
  name: string;
  email: string;
  password: string;
}) => {
  const hashedPassword = await bcrypt.hash(data.password, 10);
  return User.create({
    name: data.name,
    email: data.email,
    password: hashedPassword,
    isVerified: false,
  });
};

export const verifyUserEmail = async (userId: string) => {
  return User.findByIdAndUpdate(
    userId,
    { isVerified: true },
    { new: true }
  );
};

export const updateUserPassword = async (userId: string, newPassword: string) => {
  const hashedPassword = await bcrypt.hash(newPassword, 10);
  return User.findByIdAndUpdate(userId, { password: hashedPassword });
};

export const validatePassword = async (plainPassword: string, hashedPassword: string) => {
  return bcrypt.compare(plainPassword, hashedPassword);
};

// --- OTP Operations ---

const generateOTPCode = () =>
  Math.floor(100000 + Math.random() * 900000).toString();

export const createOtp = async (userId: string, email: string) => {
  // Delete any existing OTPs for this email
  await Otp.deleteMany({ email });

  const otp = generateOTPCode();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

  await Otp.create({
    userId,
    email,
    otp,
    expiresAt,
  });

  return otp;
};

export const verifyOtp = async (email: string, otp: string) => {
  const otpRecord = await Otp.findOne({
    email,
    otp,
    expiresAt: { $gt: new Date() },
  });

  if (otpRecord) {
    await Otp.deleteMany({ email });
  }

  return otpRecord;
};

// --- Reset Password Operations ---

export const createResetToken = async (userId: string, email: string) => {
  // Delete any existing reset tokens
  await ResetPassword.deleteMany({ email });

  const resetToken = crypto.randomBytes(32).toString("hex");
  const hashedToken = crypto.createHash("sha256").update(resetToken).digest("hex");

  await ResetPassword.create({
    userId,
    email,
    token: hashedToken,
    expiresAt: new Date(Date.now() + 60 * 60 * 1000), // 1 hour
  });

  return resetToken;
};

export const findValidResetToken = async (token: string) => {
  const hashedToken = crypto.createHash("sha256").update(token).digest("hex");

  return ResetPassword.findOne({
    token: hashedToken,
    expiresAt: { $gt: new Date() },
  });
};

export const deleteResetTokens = async (email: string) => {
  return ResetPassword.deleteMany({ email });
};
