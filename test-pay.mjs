import axios from "axios";
import { x402Client, wrapAxiosWithPayment } from "@x402/axios";
import { registerExactEvmScheme } from "@x402/evm/exact/client";
import { privateKeyToAccount } from "viem/accounts";

const signer = privateKeyToAccount(process.env.PK);
console.log("Signer address:", signer.address);

const client = new x402Client();
registerExactEvmScheme(client, { signer });

const api = wrapAxiosWithPayment(
  axios.create({ baseURL: "https://optim-x402-gateway-production.up.railway.app" }),
  client,
  { onPaymentRequired: (req) => console.log("Payment required for:", req.url) }
);

try {
  console.log("Sending request...");
  const res = await api.post("/solve/portfolio", {});
  console.log("SUCCESS:", res.status);
} catch(e) {
  console.log("Failed. Status:", e.response?.status);
  if (e.response?.headers) {
    const pr = e.response.headers["payment-required"];
    if (pr) {
      const decoded = JSON.parse(Buffer.from(pr, "base64").toString());
      console.log("Server says:", JSON.stringify(decoded, null, 2).slice(0, 800));
    }
  }
  console.log("Error message:", e.message?.slice(0, 300));
}
