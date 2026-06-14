declare module "multer-storage-cloudinary" {
  import { StorageEngine } from "multer";
  import { v2 as cloudinaryV2 } from "cloudinary";

  interface CloudinaryStorageOptions {
    cloudinary: typeof cloudinaryV2;
    params?: Record<string, unknown>;
  }

  function CloudinaryStorage(options: CloudinaryStorageOptions): StorageEngine;

  export = CloudinaryStorage;
}
