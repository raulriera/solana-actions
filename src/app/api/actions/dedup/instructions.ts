import { Connection, PublicKey, TransactionInstruction } from "@solana/web3.js";

import {
  TOKEN_PROGRAM_ID,
  createCloseAccountInstruction,
  createTransferInstruction,
} from "@solana/spl-token";
import { TokenAccount } from "./types";

export const getGroupedTokenAccountsByOwner = async (
  owner: PublicKey,
  connection: Connection
) => {
  const tokenAccounts = await connection.getParsedTokenAccountsByOwner(owner, {
    programId: TOKEN_PROGRAM_ID,
  });

  return tokenAccounts.value.reduce((acc, item) => {
    const mint = item.account.data.parsed.info.mint as string;

    if (!acc[mint]) {
      acc[mint] = [];
    }
    acc[mint].push(item);
    return acc;
  }, {} as Record<string, TokenAccount[]>);
};

export const createBulkTransferInstructions = async (
  owner: PublicKey,
  destination: PublicKey,
  tokenAccounts: TokenAccount[]
) => {
  let instructions: TransactionInstruction[] = [];

  tokenAccounts.forEach((account) => {
    instructions.push(
      createTransferInstruction(
        account.pubkey,
        destination,
        owner,
        account.account.data.parsed.info.tokenAmount.amount
      )
    );
  });

  return instructions;
};

export const createBulkCloseInstructions = async (
  owner: PublicKey,
  excluding: PublicKey,
  tokenAccounts: TokenAccount[]
) => {
  let instructions: TransactionInstruction[] = [];

  tokenAccounts
    .filter((account) => account.pubkey.toString() !== excluding.toString())
    .forEach((account) => {
      instructions.push(
        createCloseAccountInstruction(account.pubkey, owner, owner, [])
      );
    });

  return instructions;
};
