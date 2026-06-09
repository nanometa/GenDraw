/**
 * GenLayer Studionet network config — see https://docs.genlayer.com/developers/networks
 */
export const STUDIONET_RPC = 'https://studio.genlayer.com/api';
export const STUDIONET_CHAIN_ID = 61999;

/**
 * Deployed GenDraw contract on Studionet.
 *
 * This version generates round clues inside the intelligent contract with
 * GenLayer consensus. The secret word is readable only by the drawer via
 * `get_current_word`, while guessers read the contract-generated clue via
 * `get_current_hint`.
 */
export const CONTRACT_ADDRESS = '0xE736C7A8bA9f62bB807dA7059F9997A342893A2F';
