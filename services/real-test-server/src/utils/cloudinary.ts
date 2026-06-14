import * as cloudinaryModule from "cloudinary";
import CloudinaryStorage = require("multer-storage-cloudinary");
import multer from "multer";

// Configure v2 — the library accesses cloudinaryModule.v2 internally
cloudinaryModule.v2.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Pass the full module so the library can reach .v2.uploader
const productStorage = CloudinaryStorage({
  cloudinary: cloudinaryModule as any,
  params: { folder: "ecom/products", allowed_formats: ["jpg", "jpeg", "png", "webp"] } as any,
});

const categoryStorage = CloudinaryStorage({
  cloudinary: cloudinaryModule as any,
  params: { folder: "ecom/categories", allowed_formats: ["jpg", "jpeg", "png", "webp"] } as any,
});

const customReferenceStorage = CloudinaryStorage({
  cloudinary: cloudinaryModule as any,
  params: { folder: "ecom/custom-references", allowed_formats: ["jpg", "jpeg", "png", "webp"] } as any,
});

export const uploadProductImages = multer({
  storage: productStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
});

export const uploadCategoryImage = multer({
  storage: categoryStorage,
  limits: { fileSize: 2 * 1024 * 1024 },
});

export const uploadCustomReference = multer({
  storage: customReferenceStorage,
  limits: { fileSize: 10 * 1024 * 1024 },
});

export const cloudinary = cloudinaryModule.v2;
