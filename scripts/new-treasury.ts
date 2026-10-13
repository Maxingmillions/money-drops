// Generates a fresh Solana keypair for the custodial escrow treasury.
// Prints the values to put in .env; never commit them.
import { Keypair } from "@solana/web3.js";
import bs58 from "bs58";

const kp = Keypair.generate();
console.log(`NEXT_PUBLIC_TREASURY_ADDRESS="${kp.publicKey.toBase58()}"`);
console.log(`TREASURY_SECRET_KEY="${bs58.encode(kp.secretKey)}"`);
console.log("\nFund it with a little SOL for fees (devnet: solana airdrop 1 <address> --url devnet).");
