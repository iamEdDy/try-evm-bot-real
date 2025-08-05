// Import modules
import Web3 from "web3";
import dotenv from "dotenv";
import BigNumber from "bignumber.js";

// Load environment variables from the .env file
dotenv.config();

// Directly pass the URL as the provider, without `HttpProvider`
const INFURA_URL =
  "https://mainnet.infura.io/v3/dfc5c6112e594e43a38688615b7859aa"; // Replace with your own public RPC endpoint if needed
const web3 = new Web3(INFURA_URL); // No need for HttpProvider constructor

// Load sensitive variables from .env file
const { PRIVATE_KEY_ETHER, RECIPIENT_ADDRESS_ETHER } = process.env;

// Derive the public key from the private key
const account = web3.eth.accounts.privateKeyToAccount(PRIVATE_KEY_ETHER);
const PUBLIC_KEY = account.address;

// Get the current gas price from Ethereum network with fallback if it fails
async function getDynamicGasPrice() {
  try {
    const latestBlock = await web3.eth.getBlock("latest");
    const baseFeePerGas = latestBlock.baseFeePerGas; // Base fee per gas in wei

    if (!baseFeePerGas) {
      throw new Error("Base fee per gas not available");
    }

    console.log(`Base Fee Per Gas: ${baseFeePerGas}`);

    // Set a priority fee on top of the base fee
    const priorityFee = web3.utils.toWei("2", "gwei"); // Example priority fee amount
    const maxFeePerGas = new BigNumber(baseFeePerGas)
      .plus(new BigNumber(priorityFee))
      .toString();
    const maxPriorityFeePerGas = new BigNumber(priorityFee).toString();

    return {
      maxFeePerGas,
      maxPriorityFeePerGas,
    };
  } catch (error) {
    console.error("Error fetching gas price, using fallback gas price:", error);
    // Fallback values if API fails (note: these are not EIP-1559 values)
    return {
      maxFeePerGas: web3.utils.toWei("7", "gwei"),
      maxPriorityFeePerGas: web3.utils.toWei("2", "gwei"),
    };
  }
}

// Create the ETH transfer transaction
async function createEthTransferTransaction(
  toAddress,
  amountInEth,
  maxFeePerGas,
  maxPriorityFeePerGas
) {
  try {
    const nonce = await web3.eth.getTransactionCount(PUBLIC_KEY, "latest"); // Get latest nonce
    const tx = {
      from: PUBLIC_KEY,
      to: toAddress,
      nonce: nonce,
      gas: 21000, // Fixed gas limit for ETH transfer
      value: web3.utils.toWei(amountInEth, "ether"), // Amount in wei
      maxFeePerGas: maxFeePerGas, // EIP-1559 field
      maxPriorityFeePerGas: maxPriorityFeePerGas, // EIP-1559 field
    };
    return tx;
  } catch (error) {
    console.error("Error creating transaction:", error);
    throw error;
  }
}

// Sign and send the ETH transfer transaction
async function signAndSendTransaction(tx) {
  try {
    const signedTx = await web3.eth.accounts.signTransaction(tx, PRIVATE_KEY_ETHER);
    const receipt = await web3.eth.sendSignedTransaction(
      signedTx.rawTransaction
    );
    console.log("Transaction receipt: ", receipt);
  } catch (error) {
    console.error("Error sending transaction, retrying...", error);
    // Wait 5 seconds and retry in case of failure
    await new Promise((resolve) => setTimeout(resolve, 5000));
    await signAndSendTransaction(tx);
  }
}

async function checkEthBalanceAndTransfer(threshold, recipient) {
  try {
    // Fetch the ETH balance and convert it to a BigNumber
    const balanceInWei = await web3.eth.getBalance(PUBLIC_KEY);
    const balanceInEth = web3.utils.fromWei(balanceInWei, "ether");

    console.log(`Balance: ${balanceInEth} ETH`);
    console.log(`Threshold: ${threshold} ETH`);

    // Trigger transfer if balance is greater than threshold
    if (new BigNumber(balanceInEth).isGreaterThan(threshold)) {
      console.log(`Balance is greater than threshold, initiating transfer...`);
      const gasPrices = await getDynamicGasPrice();
      const tx = await createEthTransferTransaction(
        recipient,
        balanceInEth, // Transfer entire balance
        gasPrices.maxFeePerGas,
        gasPrices.maxPriorityFeePerGas
      );
      await signAndSendTransaction(tx);
      console.log("ETH transfer successful");
    } else {
      console.log("Balance is below threshold, waiting...");
    }
  } catch (error) {
    console.error("Error checking ETH balance:", error);
  }
}

// Main function to run the bot with error handling and reconnection logic
async function runBot() {
  const recipient = RECIPIENT_ADDRESS_ETHER;
  let attempts = 0;

  while (attempts < 10000) {
    // Limit attempts to prevent infinite loops in case of errors
    try {
      await checkEthBalanceAndTransfer(0.002, recipient); // No threshold, transfer any positive balance
    } catch (error) {
      console.error("Error in bot loop, reconnecting...", error);
      // Reconnect if the network disconnects
      await new Promise((resolve) => setTimeout(resolve, 5000));
    }
    // Wait before checking again (adjust interval as needed)
    await new Promise((resolve) => setTimeout(resolve, 5000));
    attempts++;
  }
  console.log("Max attempts reached, stopping bot.");
}

// Start the bot
runBot().catch(console.error);
