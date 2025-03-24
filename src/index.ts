import { Checkout } from "./../../../09-lecture/03-cart-with-localstorage/src/pages/Checkout";
import dotenv from "dotenv";
import express from "express";
import { connectDB } from "./config/db";
import cors from "cors";

const YOUR_DOMAIN = "http://localhost:3000";
dotenv.config();
const app = express();
app.use(express.static("public"));

// Middleware
app.use(express.json());
app.use(cors());

// Routes
import productRouter from "./routes/products";
import customerRouter from "./routes/customers";
import orderRouter from "./routes/orders";
import orderItemRouter from "./routes/orderItems";
import { IProduct } from "./models/IProduct";
app.use("/products", productRouter);
app.use("/customers", customerRouter);
app.use("/orders", orderRouter);
app.use("/order-items", orderItemRouter);

const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

app.post("/stripe/create-checkout-session", async (req, res) => {
  interface ICartItem {
    product: IProduct;
    quantity: number;
  }
  interface ILineItem {
    price_data: {
      currency: string;
      product_data: {
        name: string;
        images?: string[];
        description: string;
      };
      unit_amount: number;
    };
    quantity: number;
  }

  const cart: ICartItem[] = req.body.cart;
  const session = await stripe.checkout.sessions.create({
    line_items: cart.map((item: ICartItem): ILineItem => {
      return {
        price_data: {
          currency: "sek",
          product_data: {
            name: item.product.name,
            images: [item.product.image],
            description: item.product.description,
          },
          unit_amount: item.product.price * 100,
        },
        quantity: item.quantity,
      };
    }),
    mode: "payment",
    ui_mode: "embedded",
    return_url: "http://localhost:5173/order-confirmation?session_id={CHECKOUT_SESSION_ID}",
  });
  res.send({ clientSecret: session.client_secret });
});
// Attempt to connect to the database
connectDB();
// Start Express server
const PORT = 3000;
app.listen(PORT, () => {
  console.log(`The server is running at http://localhost:${PORT}`);
});
