import mongoose, { Document, Schema } from "mongoose";

export interface IResetPassword extends Document {
  userId: mongoose.Types.ObjectId;
  email: string;
  token: string;
  expiresAt: Date;
  createdAt: Date;
}

const resetPasswordSchema = new Schema<IResetPassword>(
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
    token: {
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

export const ResetPassword = mongoose.model<IResetPassword>("ResetPassword", resetPasswordSchema);
