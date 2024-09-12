import {
  ActionPostResponse,
  createActionHeaders,
  createPostResponse,
  ActionGetResponse,
  ActionPostRequest,
} from "@solana/actions";

import {
  AccountInfo,
  clusterApiUrl,
  Connection,
  ParsedAccountData,
  PublicKey,
  Transaction,
  TransactionInstruction,
} from "@solana/web3.js";

import {
  TOKEN_PROGRAM_ID,
  getAssociatedTokenAddress,
  createCloseAccountInstruction,
  createTransferInstruction,
} from "@solana/spl-token";

const headers = createActionHeaders();

export const GET = async (req: Request) => {
  const payload: ActionGetResponse = {
    title: "De-duplicate token accounts",
    icon: "https://ucarecdn.com/7aa46c85-08a4-4bc7-9376-88ec48bb1f43/-/preview/880x864/-/quality/smart/-/format/auto/",
    description: "Consolidate token accounts into a single one",
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
      message: `All duplicate accounts from mint ${keys[0]} consolidated and closed`,
    },
  });

  return Response.json(payload, {
    headers,
  });
};

export const OPTIONS = GET;

type TokenAccount = {
  pubkey: PublicKey;
  account: AccountInfo<ParsedAccountData>;
};

const getGroupedTokenAccountsByOwner = async (
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

const createBulkTransferInstructions = async (
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

const createBulkCloseInstructions = async (
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
