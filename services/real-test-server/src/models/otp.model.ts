import mongoose, { Document, Schema } from "mongoose";

export interface IOtp extends Document {
  userId: mongoose.Types.ObjectId;
  email: string;
  otp: string;
  expiresAt: Date;
  createdAt: Date;
}

const otpSchema = new Schema<IOtp>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    email: {
      type: String,
      required: true,
    },
    otp: {
      type: String,
      required: true,
    },
    expiresAt: {
      type: Date,
      required: true,
      index: { expires: 0 }, // Auto-delete when expired
    },
  },
  {
    timestamps: true,
  }
);

export const Otp = mongoose.model<IOtp>("Otp", otpSchema);
