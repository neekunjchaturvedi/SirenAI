import { Request, Response } from "express";
import * as userRepo from "../repository/user.repository";
import { Product } from "../models/product.model";

// ── Products ──────────────────────────────────────────────────────────────────

export const getProducts = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      page, limit, search, category, minPrice, maxPrice,
      tags, toptag, sort, custom,
    } = req.query;

    const result = await userRepo.getProducts({
      page: page ? parseInt(page as string) : 1,
      limit: limit ? parseInt(limit as string) : 20,
      search: search as string | undefined,
      category: category as string | undefined,
      minPrice: minPrice ? parseFloat(minPrice as string) : undefined,
      maxPrice: maxPrice ? parseFloat(maxPrice as string) : undefined,
      tags: tags ? (Array.isArray(tags) ? tags as string[] : [tags as string]) : undefined,
      toptag: toptag as string | undefined,
      sort: sort as any,
      custom: custom !== undefined ? custom === "true" : undefined,
    });

    res.status(200).json(result);
  } catch (error) {
    console.error("Get products error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const getProduct = async (req: Request, res: Response): Promise<void> => {
  try {
    const product = await userRepo.getProductById(req.params.id);
    if (!product) {
      res.status(404).json({ error: "Product not found" });
      return;
    }
    res.status(200).json({ product });
  } catch (error) {
    console.error("Get product error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const getProductByCode = async (req: Request, res: Response): Promise<void> => {
  try {
    const product = await userRepo.getProductByCode(req.params.code);
    if (!product) {
      res.status(404).json({ error: "Product not found" });
      return;
    }
    res.status(200).json({ product });
  } catch (error) {
    console.error("Get product by code error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// ── Categories ────────────────────────────────────────────────────────────────

export const getCategories = async (_req: Request, res: Response): Promise<void> => {
  try {
    const categories = await userRepo.getAllCategories();
    res.status(200).json({ categories });
  } catch (error) {
    console.error("Get categories error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// ── Cart ──────────────────────────────────────────────────────────────────────

export const getCart = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user.id;
    const items = await userRepo.getCart(userId);
    res.status(200).json({ cart: items });
  } catch (error) {
    console.error("Get cart error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const addToCart = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user.id;
    const { productId, productType, quantity = 1 } = req.body;

    if (!productId || !productType) {
      res.status(400).json({ error: "productId and productType are required" });
      return;
    }
    if (!["Product", "Custom"].includes(productType)) {
      res.status(400).json({ error: "productType must be 'Product' or 'Custom'" });
      return;
    }
    if (quantity < 1) {
      res.status(400).json({ error: "quantity must be at least 1" });
      return;
    }

    const item = await userRepo.addToCart(userId, productId, productType, Number(quantity));
    res.status(200).json({ message: "Added to cart", item });
  } catch (error) {
    console.error("Add to cart error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const updateCartItem = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user.id;
    const { quantity } = req.body;

    if (!quantity || quantity < 1) {
      res.status(400).json({ error: "quantity must be at least 1" });
      return;
    }

    const item = await userRepo.updateCartItem(req.params.id, userId, Number(quantity));
    if (!item) {
      res.status(404).json({ error: "Cart item not found" });
      return;
    }
    res.status(200).json({ message: "Cart updated", item });
  } catch (error) {
    console.error("Update cart error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const removeFromCart = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user.id;
    const deleted = await userRepo.removeCartItem(req.params.id, userId);
    if (!deleted) {
      res.status(404).json({ error: "Cart item not found" });
      return;
    }
    res.status(200).json({ message: "Item removed from cart" });
  } catch (error) {
    console.error("Remove from cart error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// ── Address ───────────────────────────────────────────────────────────────────

export const getAddresses = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user.id;
    const addresses = await userRepo.getAddresses(userId);
    res.status(200).json({ addresses });
  } catch (error) {
    console.error("Get addresses error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const addAddress = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user.id;
    const { label, street, city, state, postalCode, country, phone, isDefault } = req.body;

    if (!street || !city || !state || !postalCode || !country) {
      res.status(400).json({ error: "street, city, state, postalCode and country are required" });
      return;
    }

    const address = await userRepo.addAddress(userId, { label, street, city, state, postalCode, country, phone, isDefault });
    res.status(201).json({ message: "Address added", address });
  } catch (error) {
    console.error("Add address error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const updateAddress = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user.id;
    const { addressId } = req.params;
    const { label, street, city, state, postalCode, country, phone, isDefault } = req.body;

    const address = await userRepo.updateAddress(userId, addressId, { label, street, city, state, postalCode, country, phone, isDefault });
    if (!address) { res.status(404).json({ error: "Address not found" }); return; }
    res.status(200).json({ message: "Address updated", address });
  } catch (error) {
    console.error("Update address error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const deleteAddress = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user.id;
    const { addressId } = req.params;

    const deleted = await userRepo.deleteAddress(userId, addressId);
    if (!deleted) { res.status(404).json({ error: "Address not found" }); return; }
    res.status(200).json({ message: "Address deleted" });
  } catch (error) {
    console.error("Delete address error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const setDefaultAddress = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user.id;
    const { addressId } = req.params;

    const address = await userRepo.setDefaultAddress(userId, addressId);
    if (!address) { res.status(404).json({ error: "Address not found" }); return; }
    res.status(200).json({ message: "Default address updated", address });
  } catch (error) {
    console.error("Set default address error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// ── User Orders ───────────────────────────────────────────────────────────────

export const getMyOrders = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user.id;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const result = await userRepo.getUserOrders(userId, page, limit);
    res.status(200).json(result);
  } catch (error) {
    console.error("Get my orders error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const getMyOrder = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user.id;
    const order = await userRepo.getUserOrderById(req.params.id, userId);
    if (!order) {
      res.status(404).json({ error: "Order not found" });
      return;
    }
    res.status(200).json({ order });
  } catch (error) {
    console.error("Get my order error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// ── Custom Orders ─────────────────────────────────────────────────────────────

export const submitCustomization = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user.id;
    const { productId, options, measurements } = req.body;

    if (!productId || !options) {
      res.status(400).json({ error: "productId and options are required" });
      return;
    }

    let parsedOptions = options;
    let parsedMeasurements = measurements;
    if (typeof options === "string") parsedOptions = JSON.parse(options);
    if (typeof measurements === "string") parsedMeasurements = JSON.parse(measurements);

    const product = await Product.findById(productId);
    if (!product) {
      res.status(404).json({ error: "Product not found" });
      return;
    }
    if (!product.custom) {
      res.status(400).json({ error: "This product does not support customization" });
      return;
    }

    const referenceImageFile = req.file as (Express.Multer.File & { path?: string; secure_url?: string }) | undefined;

    const customRequest = await userRepo.createCustomRequest({
      code: product.productCode,
      price: product.customPrice,
      customMeasurements: {
        userId,
        productId,
        options: parsedOptions,
        measurements: parsedMeasurements || {},
        referenceImage: referenceImageFile?.path || (referenceImageFile as any)?.secure_url || null,
      },
    });

    res.status(201).json({
      message: "Customization request submitted",
      customId: customRequest._id,
      price: customRequest.price,
    });
  } catch (error) {
    console.error("Submit customization error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};
