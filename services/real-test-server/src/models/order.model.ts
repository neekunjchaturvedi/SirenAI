import mongoose, { Document, Schema } from "mongoose";

interface IOrderProduct {
  productId: mongoose.Types.ObjectId;
  productType: "Product" | "Custom";
}

export type OrderStatus =
  | "pending"
  | "confirmed"
  | "packaging"
  | "ready_to_ship"
  | "shipped"
  | "out_for_delivery"
  | "delivered"
  | "cancelled"
  | "returned";

export interface IOrder extends Document {
  userId: mongoose.Types.ObjectId;
  product: IOrderProduct;
  quantity: number;
  address: mongoose.Types.ObjectId;
  email: string;
  phone: string;
  status: OrderStatus;
}

const ORDER_STATUSES: OrderStatus[] = [
  "pending",
  "confirmed",
  "packaging",
  "ready_to_ship",
  "shipped",
  "out_for_delivery",
  "delivered",
  "cancelled",
  "returned",
];

const orderSchema = new Schema<IOrder>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    product: {
      productId: { type: Schema.Types.ObjectId, required: true, refPath: "product.productType" },
      productType: { type: String, required: true, enum: ["Product", "Custom"] },
    },
    quantity: { type: Number, required: true, min: 1 },
    address: { type: Schema.Types.ObjectId, ref: "Address", required: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    phone: { type: String, required: true, trim: true },
    status: { type: String, enum: ORDER_STATUSES, default: "pending" },
  },
  { timestamps: true }
);

export const Order = mongoose.model<IOrder>("Order", orderSchema);
