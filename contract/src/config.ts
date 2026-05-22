/**
 * GenLayer Studionet network config — see https://docs.genlayer.com/developers/networks
 */
export const STUDIONET_RPC = 'https://studio.genlayer.com/api';
export const STUDIONET_CHAIN_ID = 61999;

/** Deployed GenDraw contract on Studionet.
 *
 * v5: same as v4 (atomic rotate, multi-correct, capped attempts, weekly
 *  leaderboard) but with the timestamp-based week-id replaced by a
 *  manual `advance_week()` owner action. GenVM does not expose
 *  `gl.message.timestamp` so the v4 weekly leaderboard panic'd on every
 *  correct guess.
 */
export const CONTRACT_ADDRESS = '0xDcF68814DCF7a11B2AbC82Eb08854eBe93174080';
