import {
  ActionPostResponse,
  createActionHeaders,
  createPostResponse,
  ActionGetResponse,
  ActionPostRequest,
} from "@solana/actions";

import { Connection, PublicKey, Transaction } from "@solana/web3.js";

import { getAssociatedTokenAddress } from "@solana/spl-token";
import {
  getGroupedTokenAccountsByOwner,
  createBulkTransferInstructions,
  createBulkCloseInstructions,
} from "./instructions";

const headers = createActionHeaders();

export const GET = async (req: Request) => {
  const payload: ActionGetResponse = {
    title: "De-duplicate token accounts",
    icon: "https://ucarecdn.com/7aa46c85-08a4-4bc7-9376-88ec48bb1f43/-/preview/880x864/-/quality/smart/-/format/auto/",
    description:
      "Consolidate all token accounts of the same mint into a single one",
    label: "De-duplicate",
    type: "action",
    links: {
      actions: [
        {
          href: `/api/actions/dedup`,
          label: "Consolidate and close",
        },
      ],
    },
  };

  return Response.json(payload, {
    headers,
  });
};

export const POST = async (req: Request) => {
  const body: ActionPostRequest = await req.json();
  const owner = new PublicKey(body.account);

  const connection = new Connection(
    "https://mainnet.helius-rpc.com/?api-key=06fae213-1755-4d43-bd51-48b1eb6676cf"
  );

  const { blockhash, lastValidBlockHeight } =
    await connection.getLatestBlockhash();

  const dups = await getGroupedTokenAccountsByOwner(owner, connection);
  const keys = Object.keys(dups);

  if (keys.length === 0) {
    throw new Error("No accounts found");
  }

  const dupAccounts = dups[keys[0]];

  const associatedTokenAddress = await getAssociatedTokenAddress(
    new PublicKey(dupAccounts[0].account.data.parsed.info.mint ?? ""),
    owner,
    false
  );

  const bulkTransfer = await createBulkTransferInstructions(
    owner,
    associatedTokenAddress,
    dupAccounts
  );

  const bulkClose = await createBulkCloseInstructions(
    owner,
    associatedTokenAddress,
    dupAccounts
  );

  const transaction = new Transaction({
    feePayer: owner,
    blockhash,
    lastValidBlockHeight,
  }).add(...bulkTransfer, ...bulkClose);

  const payload: ActionPostResponse = await createPostResponse({
    fields: {
      transaction,
      message: `${dupAccounts.length} accounts from mint ${keys[0]} consolidated and closed (if needed)`,
    },
  });

  return Response.json(payload, {
    headers,
  });
};

export const OPTIONS = GET;
