import { User } from "../models/user.model";
import { Product } from "../models/product.model";
import { Category } from "../models/category.model";
import { Order, OrderStatus } from "../models/order.model";

// --- Categories ---

export const createCategory = async (name: string, image: string) => {
  return Category.create({ name, image });
};

export const getAllCategories = async () => {
  return Category.find().sort({ createdAt: -1 });
};

export const getCategoryById = async (id: string) => {
  return Category.findById(id);
};

export const deleteCategoryById = async (id: string) => {
  return Category.findByIdAndDelete(id);
};

// --- Products ---

export const createProduct = async (data: {
  name: string;
  description?: string;
  price: number;
  sizes?: string[];
  discount?: number;
  discountedPrice?: number;
  colors?: string[];
  images?: Record<string, string[]>;
  stock?: number;
  tags?: string[];
  toptag?: string;
  custom?: boolean;
  customPrice?: number;
  productCode: string;
  category: string;
}) => {
  return Product.create(data);
};

export const getAllProducts = async (page = 1, limit = 20) => {
  const skip = (page - 1) * limit;
  const [products, total] = await Promise.all([
    Product.find().populate("category", "name").skip(skip).limit(limit).sort({ createdAt: -1 }),
    Product.countDocuments(),
  ]);
  return { products, total, page, pages: Math.ceil(total / limit) };
};

export const getProductById = async (id: string) => {
  return Product.findById(id).populate("category", "name");
};

export const updateProductById = async (id: string, data: Partial<{ name: string; description: string; price: number; sizes: string[]; discount: number; discountedPrice: number; colors: string[]; stock: number; tags: string[]; toptag: string; custom: boolean; customPrice: number; category: string }>) => {
  return Product.findByIdAndUpdate(id, data, { new: true });
};

export const deleteProductById = async (id: string) => {
  return Product.findByIdAndDelete(id);
};

export const addImagesToProduct = async (
  productId: string,
  color: string,
  imageUrls: string[]
) => {
  const product = await Product.findById(productId);
  if (!product) return null;
  const existing = product.images.get(color) || [];
  product.images.set(color, [...existing, ...imageUrls]);
  return product.save();
};

// --- Orders ---

export const getAllOrders = async (page = 1, limit = 20, status?: OrderStatus) => {
  const filter = status ? { status } : {};
  const skip = (page - 1) * limit;
  const [orders, total] = await Promise.all([
    Order.find(filter)
      .populate("userId", "name email")
      .populate("address")
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 }),
    Order.countDocuments(filter),
  ]);
  return { orders, total, page, pages: Math.ceil(total / limit) };
};

export const getOrderById = async (id: string) => {
  return Order.findById(id).populate("userId", "name email").populate("address");
};

export const updateOrderStatus = async (id: string, status: OrderStatus) => {
  return Order.findByIdAndUpdate(id, { status }, { new: true });
};

// --- Users ---

export const getAllUsers = async (page = 1, limit = 20) => {
  const skip = (page - 1) * limit;
  const [users, total] = await Promise.all([
    User.find({}, "-password").skip(skip).limit(limit).sort({ createdAt: -1 }),
    User.countDocuments(),
  ]);
  return { users, total, page, pages: Math.ceil(total / limit) };
};

export const getUserById = async (id: string) => {
  return User.findById(id, "-password");
};
