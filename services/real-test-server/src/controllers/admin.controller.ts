import { Request, Response } from "express";
import * as adminRepo from "../repository/admin.repository";
import { cloudinary } from "../utils/cloudinary";
import { OrderStatus } from "../models/order.model";

// ── Categories ──────────────────────────────────────────────────────────────

export const addCategory = async (req: Request, res: Response): Promise<void> => {
  try {
    const { name } = req.body;
    if (!name) {
      res.status(400).json({ error: "Category name is required" });
      return;
    }

    const file = req.file as Express.Multer.File & { path?: string; secure_url?: string };
    const imageUrl = file?.path || (file as any)?.secure_url;
    if (!file || !imageUrl) {
      res.status(400).json({ error: "Category image is required or upload failed" });
      return;
    }

    const category = await adminRepo.createCategory(name.trim(), imageUrl);
    res.status(201).json({ message: "Category created", category });
  } catch (error: any) {
    if (error.code === 11000) {
      res.status(400).json({ error: "Category already exists" });
      return;
    }
    console.error("Add category error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const getCategories = async (_req: Request, res: Response): Promise<void> => {
  try {
    const categories = await adminRepo.getAllCategories();
    res.status(200).json({ categories });
  } catch (error) {
    console.error("Get categories error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const deleteCategory = async (req: Request, res: Response): Promise<void> => {
  try {
    const deleted = await adminRepo.deleteCategoryById(req.params.id);
    if (!deleted) {
      res.status(404).json({ error: "Category not found" });
      return;
    }
    res.status(200).json({ message: "Category deleted" });
  } catch (error) {
    console.error("Delete category error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// ── Products ─────────────────────────────────────────────────────────────────

export const addProduct = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      name, description, price, sizes, discount, discountedPrice,
      colors, stock, tags, toptag, custom, customPrice, productCode, category,
    } = req.body;

    if (!name || !price || !productCode || !category) {
      res.status(400).json({ error: "name, price, productCode and category are required" });
      return;
    }

    const parseList = (val: unknown): string[] => {
      if (!val) return [];
      if (Array.isArray(val)) return val;
      const str = String(val).trim();
      if (str.startsWith("[")) return JSON.parse(str);
      return str.split(",").map((s) => s.trim()).filter(Boolean);
    };

    const product = await adminRepo.createProduct({
      name,
      description,
      price: Number(price),
      sizes: parseList(sizes),
      discount: discount ? Number(discount) : 0,
      discountedPrice: discountedPrice ? Number(discountedPrice) : 0,
      colors: parseList(colors),
      stock: stock ? Number(stock) : 0,
      tags: parseList(tags),
      toptag,
      custom: custom === "true",
      customPrice: customPrice ? Number(customPrice) : 0,
      productCode,
      category,
    });

    res.status(201).json({ message: "Product created", product });
  } catch (error: any) {
    if (error.code === 11000) {
      res.status(400).json({ error: "Product code already exists" });
      return;
    }
    console.error("Add product error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const uploadProductImages = async (req: Request, res: Response): Promise<void> => {
  try {
    const { productId, color } = req.body;

    if (!productId || !color) {
      res.status(400).json({ error: "productId and color are required" });
      return;
    }

    const files = req.files as (Express.Multer.File & { path?: string; secure_url?: string })[];
    if (!files || files.length === 0) {
      res.status(400).json({ error: "At least one image is required" });
      return;
    }

    const imageUrls = files.map((f) => f.path || (f as any).secure_url).filter(Boolean) as string[];
    if (imageUrls.length === 0) {
      res.status(400).json({ error: "Image upload failed. Check Cloudinary credentials." });
      return;
    }
    const product = await adminRepo.addImagesToProduct(productId, color, imageUrls);

    if (!product) {
      res.status(404).json({ error: "Product not found" });
      return;
    }

    res.status(200).json({ message: "Images uploaded", product });
  } catch (error) {
    console.error("Upload product images error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const getProducts = async (req: Request, res: Response): Promise<void> => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const result = await adminRepo.getAllProducts(page, limit);
    res.status(200).json(result);
  } catch (error) {
    console.error("Get products error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const updateProduct = async (req: Request, res: Response): Promise<void> => {
  try {
    const updates = req.body;
    const parseList = (val: unknown): string[] => {
      if (!val) return [];
      if (Array.isArray(val)) return val;
      const str = String(val).trim();
      if (str.startsWith("[")) return JSON.parse(str);
      return str.split(",").map((s) => s.trim()).filter(Boolean);
    };
    if (updates.price) updates.price = Number(updates.price);
    if (updates.stock !== undefined) updates.stock = Number(updates.stock);
    if (updates.discount !== undefined) updates.discount = Number(updates.discount);
    if (updates.discountedPrice !== undefined) updates.discountedPrice = Number(updates.discountedPrice);
    if (updates.customPrice !== undefined) updates.customPrice = Number(updates.customPrice);
    if (updates.sizes !== undefined) updates.sizes = parseList(updates.sizes);
    if (updates.colors !== undefined) updates.colors = parseList(updates.colors);
    if (updates.tags !== undefined) updates.tags = parseList(updates.tags);
    if (updates.custom !== undefined) updates.custom = updates.custom === "true" || updates.custom === true;

    const product = await adminRepo.updateProductById(req.params.id, updates);
    if (!product) {
      res.status(404).json({ error: "Product not found" });
      return;
    }
    res.status(200).json({ message: "Product updated", product });
  } catch (error) {
    console.error("Update product error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const deleteProduct = async (req: Request, res: Response): Promise<void> => {
  try {
    const deleted = await adminRepo.deleteProductById(req.params.id);
    if (!deleted) {
      res.status(404).json({ error: "Product not found" });
      return;
    }
    res.status(200).json({ message: "Product deleted" });
  } catch (error) {
    console.error("Delete product error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// ── Orders ───────────────────────────────────────────────────────────────────

const VALID_STATUSES: OrderStatus[] = [
  "pending", "confirmed", "packaging", "ready_to_ship",
  "shipped", "out_for_delivery", "delivered", "cancelled", "returned",
];

export const getOrders = async (req: Request, res: Response): Promise<void> => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const status = req.query.status as OrderStatus | undefined;

    if (status && !VALID_STATUSES.includes(status)) {
      res.status(400).json({ error: "Invalid status filter" });
      return;
    }

    const result = await adminRepo.getAllOrders(page, limit, status);
    res.status(200).json(result);
  } catch (error) {
    console.error("Get orders error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const getOrder = async (req: Request, res: Response): Promise<void> => {
  try {
    const order = await adminRepo.getOrderById(req.params.id);
    if (!order) {
      res.status(404).json({ error: "Order not found" });
      return;
    }
    res.status(200).json({ order });
  } catch (error) {
    console.error("Get order error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const updateOrderStatus = async (req: Request, res: Response): Promise<void> => {
  try {
    const { status } = req.body;

    if (!status || !VALID_STATUSES.includes(status)) {
      res.status(400).json({ error: "Valid status is required", validStatuses: VALID_STATUSES });
      return;
    }

    const order = await adminRepo.updateOrderStatus(req.params.id, status);
    if (!order) {
      res.status(404).json({ error: "Order not found" });
      return;
    }
    res.status(200).json({ message: "Order status updated", order });
  } catch (error) {
    console.error("Update order status error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// ── Users ─────────────────────────────────────────────────────────────────────

export const getUsers = async (req: Request, res: Response): Promise<void> => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const result = await adminRepo.getAllUsers(page, limit);
    res.status(200).json(result);
  } catch (error) {
    console.error("Get users error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const getUser = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = await adminRepo.getUserById(req.params.id);
    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }
    res.status(200).json({ user });
  } catch (error) {
    console.error("Get user error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};
