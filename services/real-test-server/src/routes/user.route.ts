import { Router } from "express";
import { authMiddleware } from "../middleware/auth.middleware";
import { uploadCustomReference } from "../utils/cloudinary";
import {
  getProducts, getProduct, getProductByCode,
  getCategories,
  getCart, addToCart, updateCartItem, removeFromCart,
  getAddresses, addAddress, updateAddress, deleteAddress, setDefaultAddress,
  getMyOrders, getMyOrder,
  submitCustomization,
} from "../controllers/user.controller";

const router = Router();

// Public
router.get("/products", getProducts);
router.get("/products/code/:code", getProductByCode);
router.get("/products/:id", getProduct);
router.get("/categories", getCategories);

// Auth required
router.get("/cart", authMiddleware, getCart);
router.post("/cart", authMiddleware, addToCart);
router.put("/cart/:id", authMiddleware, updateCartItem);
router.delete("/cart/:id", authMiddleware, removeFromCart);

router.get("/addresses", authMiddleware, getAddresses);
router.post("/addresses", authMiddleware, addAddress);
router.put("/addresses/:addressId", authMiddleware, updateAddress);
router.delete("/addresses/:addressId", authMiddleware, deleteAddress);
router.patch("/addresses/:addressId/default", authMiddleware, setDefaultAddress);

router.get("/orders/mine", authMiddleware, getMyOrders);
router.get("/orders/mine/:id", authMiddleware, getMyOrder);

router.post(
  "/customize",
  authMiddleware,
  uploadCustomReference.single("referenceImage"),
  submitCustomization
);

export default router;
