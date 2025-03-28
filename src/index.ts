import dotenv from "dotenv";
import express from "express";
import { connectDB } from "./config/db";
import cors from "cors";
import axios from "axios";

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
import { ICustomer } from "./models/ICustomer";
app.use("/products", productRouter);
app.use("/customers", customerRouter);
app.use("/orders", orderRouter);
app.use("/order-items", orderItemRouter);

const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

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
interface IPayload {
  line_items: ILineItem[];
  order_id: number;
  metadata: metadata[];
}
interface metadata {
  product_id: number;
  quantity: number;
}

app.post("/stripe/create-checkout-session", async (req, res) => {
  const { line_items, order_id, metadata }: IPayload = req.body.payload;
  const metadataString = JSON.stringify(metadata);

  const session = await stripe.checkout.sessions.create({
    line_items: line_items,
    metadata: {
      items: metadataString,
    },
    mode: "payment",
    ui_mode: "embedded",
    return_url: "http://localhost:5173/order-confirmation/{CHECKOUT_SESSION_ID}",
    client_reference_id: order_id,
  });
  await axios.patch(
    `http://localhost:3000/orders/${order_id}`,
    {
      payment_id: session.id,
      payment_status: "Unpaid",
      order_status: "Pending",
    },
    {
      headers: {
        "Content-Type": "application/json",
      },
    }
  );
  res.send({ clientSecret: session.client_secret }); //Skall denna ändras till session.id?
});

app.post("/stripe/webhook", async (request, response) => {
  const event = request.body;
  // console.log("event:", event);

  // Handle the event
  switch (event.type) {
    case "checkout.session.completed":
      const session = event.data.object;
      const { id, client_reference_id } = event.data.object;
      console.log("id", id);
      console.log("client_reference_id", client_reference_id);

      await axios.patch(
        `http://localhost:3000/orders/${client_reference_id}`,
        {
          payment_id: id,
          payment_status: "Paid",
          order_status: "Recieved",
        },
        {
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      const metadata = JSON.parse(session.metadata.items);
      metadata.forEach(async (item: metadata) => {
        const response = await axios.get(`http://localhost:3000/products/${item.product_id}`);
        const product: IProduct = response.data;
        product.stock -= item.quantity;

        await axios.patch(`http://localhost:3000/products/${item.product_id}`, product);
        console.log(`${item.product_id} updated`);
      });

      break;

    default:
  }

  response.json({ received: true });
});
// Attempt to connect to the database
connectDB();
// Start Express server
const PORT = 3000;
app.listen(PORT, () => {
  console.log(`The server is running at http://localhost:${PORT}`);
});
