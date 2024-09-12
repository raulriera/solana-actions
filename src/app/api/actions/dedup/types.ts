import { PublicKey, AccountInfo, ParsedAccountData } from "@solana/web3.js";

export type TokenAccount = {
  pubkey: PublicKey;
  account: AccountInfo<ParsedAccountData>;
};
