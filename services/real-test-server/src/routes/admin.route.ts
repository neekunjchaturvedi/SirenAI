import { Router } from "express";
import { authMiddleware } from "../middleware/auth.middleware";
import { adminMiddleware } from "../middleware/admin.middleware";
import {
  uploadCategoryImage,
  uploadProductImages as multerProductImages,
} from "../utils/cloudinary";
import {
  addCategory, getCategories, deleteCategory,
  addProduct, uploadProductImages, getProducts, updateProduct, deleteProduct,
  getOrders, getOrder, updateOrderStatus,
  getUsers, getUser,
} from "../controllers/admin.controller";

const router = Router();

router.use(authMiddleware, adminMiddleware);

// Categories
router.post("/categories", uploadCategoryImage.single("image"), addCategory);
router.get("/categories", getCategories);
router.delete("/categories/:id", deleteCategory);

// Products
router.post("/products", addProduct);
router.get("/products", getProducts);
router.put("/products/:id", updateProduct);
router.delete("/products/:id", deleteProduct);
router.post("/products/:id/images", multerProductImages.array("images", 10), uploadProductImages);

// Orders
router.get("/orders", getOrders);
router.get("/orders/:id", getOrder);
router.patch("/orders/:id/status", updateOrderStatus);

// Users
router.get("/users", getUsers);
router.get("/users/:id", getUser);

export default router;
