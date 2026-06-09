import { createAccount, createClient } from 'genlayer-js';
import { studionet } from 'genlayer-js/chains';
import { TransactionStatus } from 'genlayer-js/types';

const DEFAULT_CONTRACT_ADDRESS = '0xE736C7A8bA9f62bB807dA7059F9997A342893A2F';

const contractAddress =
  process.env.GENDRAW_CONTRACT_ADDRESS ?? DEFAULT_CONTRACT_ADDRESS;
const ownerPrivateKey = process.env.GENDRAW_OWNER_PRIVATE_KEY;
const dryRun = process.argv.includes('--dry-run');

function assertPrivateKey(value) {
  if (typeof value !== 'string' || !/^0x[0-9a-fA-F]{64}$/.test(value)) {
    throw new Error(
      'GENDRAW_OWNER_PRIVATE_KEY must be a 0x-prefixed 32-byte private key.',
    );
  }
  return value;
}

async function readWeekId(client) {
  const raw = await client.readContract({
    address: contractAddress,
    functionName: 'get_current_week_id',
  });
  return Number(raw);
}

const readClient = createClient({ chain: studionet });
const before = await readWeekId(readClient);

if (dryRun) {
  console.log(
    `[gendraw] dry run: current week is #${before}; advance_week was not called.`,
  );
  process.exit(0);
}

const account = createAccount(assertPrivateKey(ownerPrivateKey));
const writeClient = createClient({
  chain: studionet,
  account,
});

console.log(`[gendraw] advancing week from #${before}...`);
const hash = await writeClient.writeContract({
  address: contractAddress,
  functionName: 'advance_week',
  args: [],
  value: 0n,
});
console.log(`[gendraw] submitted advance_week tx ${hash}`);

await writeClient.waitForTransactionReceipt({
  hash,
  status: TransactionStatus.ACCEPTED,
  interval: 2_000,
  retries: 90,
});

const after = await readWeekId(readClient);
if (after <= before) {
  throw new Error(
    `advance_week tx accepted but week did not increase: before=${before}, after=${after}`,
  );
}

console.log(`[gendraw] week advanced to #${after}`);
