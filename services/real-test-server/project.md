# Server - Express Backend

RESTful API backend for e-commerce platform with authentication, admin panel, product/category/order/cart management, Cloudinary image uploads, and gRPC notification integration.

## Tech Stack

| Technology | Version | Purpose |
|------------|---------|---------|
| Express | 5.2.1 | Web framework |
| TypeScript | 5.7.2 | Type safety |
| Mongoose | 9.3.3 | MongoDB ODM |
| jsonwebtoken | 9.0.3 | JWT authentication |
| bcryptjs | 3.0.3 | Password hashing |
| express-validator | 7.3.1 | Input validation |
| cloudinary | 2.10.0 | Cloud image storage |
| multer | 2.1.1 | Multipart form/file uploads |
| multer-storage-cloudinary | 2.2.1 | Cloudinary multer storage engine |
| @grpc/grpc-js | 1.14.3 | gRPC client |
| @grpc/proto-loader | 0.8.0 | Proto file loader |
| cors | 2.8.6 | Cross-origin requests |
| tsc-watch | 6.2.1 | Development server |

## Folder Structure

```
src/
├── config/
│   ├── database.ts                    # MongoDB connection
│   └── index.ts                       # Environment config loader
├── controllers/
│   ├── auth.controller.ts             # Auth business logic (login returns role)
│   ├── admin.controller.ts            # Admin: categories, products, orders, users
│   └── user.controller.ts             # User: products, cart, address, orders, customize
├── routes/
│   ├── auth.route.ts                  # /api/auth/*
│   ├── admin.route.ts                 # /api/admin/* (auth + admin middleware)
│   └── user.route.ts                  # /api/* (public + auth-protected)
├── middleware/
│   ├── auth.middleware.ts             # JWT verification → req.user
│   └── admin.middleware.ts            # Role check: req.user.role === "admin"
├── models/
│   ├── user.model.ts                  # User schema (role: "user"|"admin")
│   ├── otp.model.ts                   # OTP schema
│   ├── resetPassword.model.ts         # Password reset tokens
│   ├── product.model.ts               # Product schema
│   ├── category.model.ts              # Category schema
│   ├── cart.model.ts                  # Cart schema (refPath for Product/Custom)
│   ├── order.model.ts                 # Order schema with OrderStatus enum
│   ├── address.model.ts               # Address schema (one per user)
│   ├── custom.model.ts                # Custom order request schema
│   └── index.ts                       # Model exports
├── repository/
│   ├── auth.repository.ts             # Auth DB operations
│   ├── admin.repository.ts            # Admin DB operations (CRUD all entities)
│   └── user.repository.ts             # User DB operations (browse, cart, address)
├── types/
│   ├── index.ts                       # TypeScript interfaces
│   └── multer-storage-cloudinary.d.ts # Manual type declaration for library
├── utils/
│   ├── jwt.ts                         # JWT helpers (includes role in payload)
│   ├── grpc.ts                        # gRPC client for notifications
│   └── cloudinary.ts                  # Multer-Cloudinary storage engines
├── scripts/
│   └── createAdmin.ts                 # One-time script to seed admin user
├── proto/
│   └── notification.proto             # gRPC service definition
└── index.ts                           # Server entry point
```

## Setup

```bash
npm install
npm run dev        # dev server with hot reload (tsc-watch)
npm run build      # compile TypeScript → dist/
npm start          # run compiled code
npm run create-admin  # seed admin account (admin@brand.com / Admin@123)
```

## Environment Variables

```env
PORT=5000
MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/dbname
JWT_SECRET=your-super-secret-key
JWT_EXPIRES_IN=7d
FRONTEND_URL=http://localhost:5173
NOTIFICATION_GRPC_URL=localhost:50051
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
```

## API Endpoints

### Auth (`/api/auth`)

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/register` | Register new user | No |
| POST | `/login` | Login — returns `{ user: { role }, token }` | No |
| POST | `/verify` | Verify OTP | No |
| POST | `/resend-otp` | Resend OTP | No |
| POST | `/forgot-password` | Request password reset | No |
| POST | `/reset-password` | Reset password with token | No |
| GET | `/profile` | Get user profile | Yes |

### Admin (`/api/admin`) — requires `role: "admin"` JWT

| Method | Endpoint | Description | Upload |
|--------|----------|-------------|--------|
| POST | `/categories` | Create category | `image` (single) |
| GET | `/categories` | List all categories | — |
| DELETE | `/categories/:id` | Delete category | — |
| POST | `/products` | Create product | — |
| GET | `/products` | List products (paginated) | — |
| PUT | `/products/:id` | Update product fields | — |
| DELETE | `/products/:id` | Delete product | — |
| POST | `/products/:id/images` | Add images for a color | `images[]` (up to 10) |
| GET | `/orders` | List all orders (paginated, filterable by status) | — |
| GET | `/orders/:id` | Get single order | — |
| PATCH | `/orders/:id/status` | Update order status | — |
| GET | `/users` | List all users (paginated) | — |
| GET | `/users/:id` | Get single user | — |

### User (`/api`)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/products` | No | List products (search, category, sort, price range, pagination) |
| GET | `/products/code/:code` | No | Get product by productCode |
| GET | `/products/:id` | No | Get product by MongoDB ID |
| GET | `/categories` | No | List all categories |
| GET | `/cart` | Yes | Get user cart (populated) |
| POST | `/cart` | Yes | Add item to cart |
| PUT | `/cart/:itemId` | Yes | Update cart item quantity |
| DELETE | `/cart/:itemId` | Yes | Remove cart item |
| GET | `/address` | Yes | Get saved address |
| POST | `/address` | Yes | Save/update address |
| GET | `/orders/mine` | Yes | Get user's orders |
| GET | `/orders/mine/:id` | Yes | Get specific order |
| POST | `/customize` | Yes | Submit custom order request |

## Database Models

### User
```typescript
{ name, email (unique), password (hashed), isVerified: boolean,
  role: "user" | "admin" (default: "user"), createdAt, updatedAt }
```

### Product
```typescript
{ name, description, price, discountedPrice, discount,
  sizes: string[], colors: string[],
  images: Map<string, string[]>,   // color → [url, url, ...]
  ratings, reviews: [], stock, tags: string[], toptag,
  custom: boolean, customPrice, productCode (unique),
  category: ObjectId → Category, likes }
```

### Category
```typescript
{ name (unique), image: string (Cloudinary URL) }
```

### Cart
```typescript
{ userId: ObjectId → User,
  items: [{ productId: ObjectId (refPath), productType: "Product"|"Custom", quantity }] }
```

### Order
```typescript
{ userId, items: [], totalAmount, status: OrderStatus,
  shippingAddress, paymentMethod, paymentStatus }

// OrderStatus enum: "pending" | "confirmed" | "packaging" | "shipped"
//                   | "out_for_delivery" | "delivered" | "cancelled"
```

### Address
```typescript
{ userId (unique), street, city, state, postalCode, country, phone }
```

### Custom (customization request)
```typescript
{ code, price, customMeasurements: { userId, productId, options, measurements, referenceImage } }
```

## Cloudinary Integration

Three separate multer storage engines in `src/utils/cloudinary.ts`:

```typescript
uploadProductImages   // → ecom/products   (max 5MB per file)
uploadCategoryImage   // → ecom/categories (max 2MB)
uploadCustomReference // → ecom/custom-references (max 10MB)
```

**Important:** The `multer-storage-cloudinary` v2 library is a factory function (not a class). It receives the full `cloudinary` module (not `v2` directly) because it internally accesses `cloudinary.v2.uploader`. The file URL is set on `file.secure_url` (not `file.path`) after upload — controllers check both.

## Authentication & Roles

JWT payload includes `{ userId, role }`. The login response returns:
```json
{ "user": { "id": "...", "name": "...", "email": "...", "role": "user|admin" }, "token": "..." }
```

Admin middleware (`src/middleware/admin.middleware.ts`) checks `req.user.role !== "admin"` and returns 403.

## Admin Account

```bash
npm run create-admin
# Creates: admin@brand.com / Admin@123
# If user exists with that email, upgrades them to admin role
```

## gRPC Integration

```typescript
import { sendNotificationEmail } from "./utils/grpc";
await sendNotificationEmail(userId, email, "OTP", { otp: "123456", name: "John", expiryMinutes: 10 });
```

**Proto** (`src/proto/notification.proto`):
```protobuf
service NotificationService { rpc SendEmail(EmailRequest) returns (EmailResponse); }
message EmailRequest { string userId = 1; string email = 2; string templateType = 3; string dataJson = 4; }
```

## Architecture

```
Client (React)
     │ REST API
     ▼
┌─────────────────────────┐
│   Express Server :5000  │
├─────────────────────────┤
│ Routes (auth/admin/user)│
│ Middleware (auth/admin) │
│ Controllers             │
│ Repository Layer        │
├─────────────────────────┤
│   MongoDB (Mongoose)    │
└──────────┬──────────────┘
           │ gRPC            Cloudinary (image uploads)
           ▼
┌─────────────────────────┐
│ Notification Service    │
│ Port 50051 (gRPC)       │
└─────────────────────────┘
```
