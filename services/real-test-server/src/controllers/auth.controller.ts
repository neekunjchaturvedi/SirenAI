import { Request, Response } from "express";
import { validationResult } from "express-validator";

import * as authRepo from "../repository/auth.repository";
import { generateToken } from "../utils/jwt";
import { sendNotificationEmail } from "../utils/grpc";
import { RegisterBody, LoginBody } from "../types";

// --- Controllers ---

export const register = async (
  req: Request<{}, {}, RegisterBody>,
  res: Response,
): Promise<void> => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
      return;
    }

    const { email, password, name } = req.body;

    const existingUser = await authRepo.findUserByEmail(email);
    if (existingUser) {
      res.status(400).json({ error: "User already exists" });
      return;
    }

    const user = await authRepo.createUser({ name, email, password });
    const otp = await authRepo.createOtp(user._id.toString(), email);

    // Send OTP email via notification service
    console.log(`OTP for ${email}: ${otp}`);
    try {
      await sendNotificationEmail(user._id.toString(), email, "OTP", {
        otp,
        name,
        expiryMinutes: 10,
      });
    } catch (emailError) {
      console.error("Failed to send OTP email:", emailError);
    }

    res.status(201).json({
      message: "Registration successful. Please check your email for the OTP.",
      userId: user._id,
      email: user.email,
    });
  } catch (error) {
    console.error("Registration error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const verifyOtp = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      res.status(400).json({ error: "Email and OTP are required" });
      return;
    }

    const user = await authRepo.findUserByEmail(email);
    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    if (user.isVerified) {
      res.status(400).json({ error: "User is already verified" });
      return;
    }

    const otpRecord = await authRepo.verifyOtp(email, otp);
    if (!otpRecord) {
      res.status(400).json({ error: "Invalid or expired OTP" });
      return;
    }

    await authRepo.verifyUserEmail(user._id.toString());

    const token = generateToken({ id: user._id.toString(), email: user.email, role: user.role });

    res.status(200).json({
      message: "Email verified successfully",
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        isVerified: true,
      },
      token,
    });
  } catch (error) {
    console.error("OTP Verification error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const resendOtp = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email } = req.body;

    if (!email) {
      res.status(400).json({ error: "Email is required" });
      return;
    }

    const user = await authRepo.findUserByEmail(email);
    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    if (user.isVerified) {
      res.status(400).json({ error: "User is already verified" });
      return;
    }

    const otp = await authRepo.createOtp(user._id.toString(), email);

    // Send OTP email via notification service
    console.log(`Resent OTP for ${email}: ${otp}`);
    try {
      await sendNotificationEmail(user._id.toString(), email, "OTP", {
        otp,
        name: user.name,
        expiryMinutes: 10,
      });
    } catch (emailError) {
      console.error("Failed to resend OTP email:", emailError);
    }

    res.status(200).json({ message: "OTP resent successfully" });
  } catch (error) {
    console.error("Resend OTP error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const login = async (
  req: Request<{}, {}, LoginBody>,
  res: Response,
): Promise<void> => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
      return;
    }

    const { email, password } = req.body;

    const user = await authRepo.findUserByEmail(email);
    if (!user) {
      res.status(401).json({ error: "Invalid credentials" });
      return;
    }

    if (!user.isVerified) {
      // Generate and send new OTP for unverified user
      const otp = await authRepo.createOtp(user._id.toString(), email);
      console.log(`OTP for unverified login ${email}: ${otp}`);
      try {
        await sendNotificationEmail(user._id.toString(), email, "OTP", {
          otp,
          name: user.name,
          expiryMinutes: 10,
        });
      } catch (emailError) {
        console.error("Failed to send OTP email:", emailError);
      }

      res.status(403).json({
        error: "Account not verified. Please verify your email.",
        isVerified: false,
        email: user.email,
      });
      return;
    }

    const isValidPassword = await authRepo.validatePassword(
      password,
      user.password,
    );
    if (!isValidPassword) {
      res.status(401).json({ error: "Invalid credentials" });
      return;
    }

    const token = generateToken({ id: user._id.toString(), email: user.email, role: user.role });

    res.status(200).json({
      message: "Login successful",
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        isVerified: user.isVerified,
        role: user.role,
      },
      token,
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const forgotPassword = async (req: Request, res: Response) => {
  try {
    const { email } = req.body;

    if (!email) {
      res.status(400).json({ error: "Email is required" });
      return;
    }

    const user = await authRepo.findUserByEmail(email);
    if (!user) {
      // Don't reveal if user exists
      res
        .status(200)
        .json({ message: "If that email exists, we have sent a reset link." });
      return;
    }

    const resetToken = await authRepo.createResetToken(
      user._id.toString(),
      email,
    );
    const resetLink = `${process.env.FRONTEND_URL}/auth/reset-password?token=${resetToken}`;

    // Send reset email via notification service
    console.log(`Reset link for ${email}: ${resetLink}`);
    try {
      await sendNotificationEmail(user._id.toString(), email, "RESET_PASSWORD", {
        link: resetLink,
        name: user.name,
      });
    } catch (emailError) {
      console.error("Failed to send reset email:", emailError);
    }

    res
      .status(200)
      .json({ message: "If that email exists, we have sent a reset link." });
  } catch (error) {
    console.error("Forgot Password Error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const resetPassword = async (req: Request, res: Response) => {
  try {
    const { token, newPassword } = req.body;

    if (!token || !newPassword) {
      res.status(400).json({ error: "Token and new password are required" });
      return;
    }

    if (newPassword.length < 6) {
      res.status(400).json({ error: "Password must be at least 6 characters" });
      return;
    }

    const resetRecord = await authRepo.findValidResetToken(token);
    if (!resetRecord) {
      res
        .status(400)
        .json({ error: "Invalid or expired password reset token" });
      return;
    }

    await authRepo.updateUserPassword(
      resetRecord.userId.toString(),
      newPassword,
    );
    await authRepo.deleteResetTokens(resetRecord.email);

    res
      .status(200)
      .json({ message: "Password has been reset successfully. Please login." });
  } catch (error) {
    console.error("Reset Password Error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const getProfile = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const userId = (req as any).user?.id;

    if (!userId) {
      res.status(401).json({ error: "User ID missing from token" });
      return;
    }

    const user = await authRepo.findUserById(userId);
    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    res.status(200).json({
      message: "Profile fetched successfully",
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        isVerified: user.isVerified,
        createdAt: user.createdAt,
      },
    });
  } catch (error) {
    console.error("Get profile error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};
