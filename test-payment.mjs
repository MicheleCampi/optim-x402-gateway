import axios from "axios";
import { x402Client, wrapAxiosWithPayment } from "@x402/axios";
import { registerExactEvmScheme } from "@x402/evm/exact/client";
import { privateKeyToAccount } from "viem/accounts";

const PRIVATE_KEY = process.env.PRIVATE_KEY;
const GATEWAY_URL = "https://optim-x402-gateway-production.up.railway.app";

const client = new x402Client();
const signer = privateKeyToAccount(PRIVATE_KEY);
registerExactEvmScheme(client, { signer });

const api = wrapAxiosWithPayment(axios.create({ baseURL: GATEWAY_URL }), client);

console.log("Calling /solve/portfolio with x402 payment...");
const res = await api.post("/solve/portfolio", {
  assets: ["ETH", "USDC", "SOL"],
  expected_returns: [0.12, 0.04, 0.20],
  volatilities: [0.40, 0.01, 0.55],
});
console.log("SUCCESS! Response:", JSON.stringify(res.data, null, 2));
