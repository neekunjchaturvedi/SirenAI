import mongoose from "mongoose";

const connectDB = async (): Promise<void> => {
  try {
    const mongoURI = process.env.MONGODB_URI || "mongodb://localhost:27017/ecom";

    await mongoose.connect(mongoURI);

    console.log("MongoDB connected successfully");

    mongoose.connection.on("error", (err) => {
      console.error("MongoDB connection error:", err);
    });

    mongoose.connection.on("disconnected", () => {
      console.log("MongoDB disconnected");
    });

  } catch (error) {
    // Do NOT exit the process: the Siren demo needs the container to stay up so
    // the operator can observe and remediate the release regression even if the
    // database is unreachable. Surface the error to the caller instead.
    console.error("MongoDB connection failed:", error);
    throw error;
  }
};

export default connectDB;
