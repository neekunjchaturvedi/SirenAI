import { Product } from "../models/product.model";
import { Category } from "../models/category.model";
import { Cart } from "../models/cart.model";
import { Address } from "../models/address.model";
import { Custom } from "../models/custom.model";

// ── Products ─────────────────────────────────────────────────────────────────

export interface ProductQuery {
  page?: number;
  limit?: number;
  search?: string;
  category?: string;
  minPrice?: number;
  maxPrice?: number;
  tags?: string[];
  toptag?: string;
  sort?: "price_asc" | "price_desc" | "newest" | "popular";
  custom?: boolean;
}

export const getProducts = async (query: ProductQuery) => {
  const {
    page = 1, limit = 20, search, category, minPrice, maxPrice,
    tags, toptag, sort = "newest", custom,
  } = query;

  const filter: Record<string, any> = {};

  if (search) {
    filter.$or = [
      { name: { $regex: search, $options: "i" } },
      { description: { $regex: search, $options: "i" } },
      { tags: { $in: [new RegExp(search, "i")] } },
    ];
  }
  if (category) filter.category = category;
  if (minPrice !== undefined || maxPrice !== undefined) {
    filter.price = {};
    if (minPrice !== undefined) filter.price.$gte = minPrice;
    if (maxPrice !== undefined) filter.price.$lte = maxPrice;
  }
  if (tags && tags.length > 0) filter.tags = { $in: tags };
  if (toptag) filter.toptag = toptag;
  if (custom !== undefined) filter.custom = custom;

  const sortMap: Record<string, any> = {
    price_asc: { price: 1 },
    price_desc: { price: -1 },
    newest: { createdAt: -1 },
    popular: { likes: -1, ratings: -1 },
  };

  const skip = (page - 1) * limit;
  const [products, total] = await Promise.all([
    Product.find(filter)
      .populate("category", "name image")
      .sort(sortMap[sort])
      .skip(skip)
      .limit(limit)
      .select("-reviews"),
    Product.countDocuments(filter),
  ]);

  return { products, total, page, pages: Math.ceil(total / limit) };
};

export const getProductById = async (id: string) => {
  return Product.findById(id).populate("category", "name image");
};

export const getProductByCode = async (code: string) => {
  return Product.findOne({ productCode: code }).populate("category", "name image");
};

// ── Categories ────────────────────────────────────────────────────────────────

export const getAllCategories = async () => {
  return Category.find().sort({ name: 1 });
};

// ── Cart ──────────────────────────────────────────────────────────────────────

export const getCart = async (userId: string) => {
  return Cart.find({ userId })
    .populate({
      path: "productId",
      select: "name price discountedPrice discount images productCode",
    })
    .sort({ createdAt: -1 });
};

export const addToCart = async (
  userId: string,
  productId: string,
  productType: "Product" | "Custom",
  quantity: number
) => {
  const existing = await Cart.findOne({ userId, productId, productType });
  if (existing) {
    existing.quantity += quantity;
    return existing.save();
  }
  return Cart.create({ userId, productId, productType, quantity });
};

export const updateCartItem = async (cartItemId: string, userId: string, quantity: number) => {
  return Cart.findOneAndUpdate(
    { _id: cartItemId, userId },
    { quantity },
    { new: true }
  );
};

export const removeCartItem = async (cartItemId: string, userId: string) => {
  return Cart.findOneAndDelete({ _id: cartItemId, userId });
};

export const clearCart = async (userId: string) => {
  return Cart.deleteMany({ userId });
};

// ── Address ───────────────────────────────────────────────────────────────────

export const getAddresses = async (userId: string) => {
  return Address.find({ userId }).sort({ isDefault: -1, createdAt: -1 });
};

export const addAddress = async (
  userId: string,
  data: { label?: string; street: string; city: string; state: string; postalCode: string; country: string; phone?: string; isDefault?: boolean }
) => {
  if (data.isDefault) {
    await Address.updateMany({ userId }, { isDefault: false });
  }
  const count = await Address.countDocuments({ userId });
  return Address.create({ userId, ...data, isDefault: data.isDefault ?? count === 0 });
};

export const updateAddress = async (
  userId: string,
  addressId: string,
  data: Partial<{ label: string; street: string; city: string; state: string; postalCode: string; country: string; phone: string; isDefault: boolean }>
) => {
  if (data.isDefault) {
    await Address.updateMany({ userId }, { isDefault: false });
  }
  return Address.findOneAndUpdate({ _id: addressId, userId }, data, { new: true });
};

export const deleteAddress = async (userId: string, addressId: string) => {
  const deleted = await Address.findOneAndDelete({ _id: addressId, userId });
  if (deleted?.isDefault) {
    const next = await Address.findOne({ userId }).sort({ createdAt: -1 });
    if (next) await Address.findByIdAndUpdate(next._id, { isDefault: true });
  }
  return deleted;
};

export const setDefaultAddress = async (userId: string, addressId: string) => {
  await Address.updateMany({ userId }, { isDefault: false });
  return Address.findOneAndUpdate({ _id: addressId, userId }, { isDefault: true }, { new: true });
};

// ── User Orders ───────────────────────────────────────────────────────────────

export const getUserOrders = async (userId: string, page = 1, limit = 10) => {
  const skip = (page - 1) * limit;
  const [orders, total] = await Promise.all([
    (await import("../models/order.model")).Order
      .find({ userId })
      .populate("address")
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 }),
    (await import("../models/order.model")).Order.countDocuments({ userId }),
  ]);
  return { orders, total, page, pages: Math.ceil(total / limit) };
};

export const getUserOrderById = async (orderId: string, userId: string) => {
  return (await import("../models/order.model")).Order
    .findOne({ _id: orderId, userId })
    .populate("address");
};

// ── Custom Orders ─────────────────────────────────────────────────────────────

export const createCustomRequest = async (data: {
  code: string;
  customMeasurements: Record<string, unknown>;
  price: number;
}) => {
  return Custom.create(data);
};

export const getCustomsByCode = async (code: string) => {
  return Custom.findOne({ code });
};
