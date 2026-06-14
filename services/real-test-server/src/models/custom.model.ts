import mongoose, { Document, Schema } from "mongoose";

export interface ICustom extends Document {
  code: string;
  customMeasurements: Record<string, unknown>;
  price: number;
}

const customSchema = new Schema<ICustom>(
  {
    code: { type: String, required: true, trim: true },
    customMeasurements: { type: Schema.Types.Mixed, default: {} },
    price: { type: Number, required: true },
  },
  { timestamps: true }
);

export const Custom = mongoose.model<ICustom>("Custom", customSchema);
