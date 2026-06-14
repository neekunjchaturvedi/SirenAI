import mongoose, { Document, Schema } from "mongoose";

interface IReview {
  userId: mongoose.Types.ObjectId;
  name: string;
  rating: number;
  comment: string;
  createdAt: Date;
}

export interface IProduct extends Document {
  name: string;
  description: string;
  price: number;
  sizes: string[];
  discount: number;
  discountedPrice: number;
  colors: string[];
  images: Map<string, string[]>;
  ratings: number;
  reviews: IReview[];
  stock: number;
  tags: string[];
  toptag: string;
  custom: boolean;
  customPrice: number;
  productCode: string;
  category: mongoose.Types.ObjectId;
  likes: number;
}

const reviewSchema = new Schema<IReview>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    name: { type: String, required: true },
    rating: { type: Number, required: true, min: 1, max: 5 },
    comment: { type: String, required: true },
  },
  { timestamps: true }
);

const productSchema = new Schema<IProduct>(
  {
    name: { type: String, required: true, trim: true },
    description: { type: String, default: "" },
    price: { type: Number, required: true },
    sizes: [{ type: String }],
    discount: { type: Number, default: 0 },
    discountedPrice: { type: Number, default: 0 },
    colors: [{ type: String }],
    images: { type: Map, of: [String], default: {} },
    ratings: { type: Number, default: 0 },
    reviews: [reviewSchema],
    stock: { type: Number, default: 0 },
    tags: [{ type: String }],
    toptag: { type: String, default: "" },
    custom: { type: Boolean, default: false },
    customPrice: { type: Number, default: 0 },
    productCode: { type: String, required: true, unique: true, trim: true },
    category: { type: Schema.Types.ObjectId, ref: "Category", required: true },
    likes: { type: Number, default: 0 },
  },
  { timestamps: true }
);

export const Product = mongoose.model<IProduct>("Product", productSchema);
