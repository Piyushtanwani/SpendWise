const mongoose = require("mongoose");

let isConnecting = false;

const connectDB = async (retries = 5, delayMs = 1500) => {
  const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI;

  if (!mongoUri) {
    console.error(
      "MongoDB connection string missing. Set MONGODB_URI or MONGO_URI in server/.env"
    );
    if (process.env.NODE_ENV !== "test") process.exit(1);
    return;
  }

  if (mongoose.connection.readyState === 1) {
    return mongoose.connection;
  }

  if (isConnecting) return;
  isConnecting = true;

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const conn = await mongoose.connect(mongoUri, {
        serverSelectionTimeoutMS: 20000,
        socketTimeoutMS: 45000,
        maxPoolSize: 15,
        minPoolSize: 1,
        retryWrites: true,
        retryReads: true,
      });
      console.log(`MongoDB connected: ${conn.connection.host}`);
      isConnecting = false;
      return conn;
    } catch (err) {
      console.warn(
        `MongoDB connection attempt ${attempt}/${retries} failed: ${err.message}`
      );
      if (attempt === retries) {
        console.error("All MongoDB connection attempts exhausted.");
        isConnecting = false;
        return null;
      }
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
  isConnecting = false;
};

// Logging listeners for connection status (Mongoose 8 manages reconnects internally)
mongoose.connection.on("connected", () => {
  console.log("MongoDB connection active");
});

mongoose.connection.on("disconnected", () => {
  console.warn("MongoDB disconnected. Driver is reconnecting...");
});

mongoose.connection.on("reconnected", () => {
  console.log("MongoDB reconnected successfully");
});

mongoose.connection.on("error", (err) => {
  console.error("MongoDB connection error:", err.message);
});

module.exports = connectDB;

