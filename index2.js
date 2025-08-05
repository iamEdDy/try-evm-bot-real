// Import modules
import Web3 from "web3";
import dotenv from "dotenv";
import BigNumber from "bignumber.js";

// Load environment variables from the .env file
dotenv.config();

// Directly pass the URL as the provider, without `HttpProvider`
const INFURA_URL =
  "https://mainnet.infura.io/v3/dfc5c6112e594e43a38688615b7859aa"; // You can replace this with any public RPC endpoint
const web3 = new Web3(INFURA_URL); // No need for HttpProvider constructor

// Load sensitive variables from .env file
const { PRIVATE_KEY, TOKEN_ADDRESS, RECIPIENT_ADDRESS } = process.env;

// Derive the public key from the private key
const account = web3.eth.accounts.privateKeyToAccount(PRIVATE_KEY);
const PUBLIC_KEY = account.address;

// Token contract ABI (ERC-20)
const TOKEN_ABI = [];

const tokenContract = new web3.eth.Contract(TOKEN_ABI, TOKEN_ADDRESS);

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

// Create the transfer transaction
async function createTransferTransaction(
  toAddress,
  amount,
  maxFeePerGas,
  maxPriorityFeePerGas
) {
  try {
    const nonce = await web3.eth.getTransactionCount(PUBLIC_KEY, "latest"); // Get latest nonce
    const tx = {
      from: PUBLIC_KEY,
      to: TOKEN_ADDRESS,
      nonce: nonce,
      gas: 200000, // Adjust the gas limit based on transaction complexity
      maxFeePerGas: maxFeePerGas, // EIP-1559 field
      maxPriorityFeePerGas: maxPriorityFeePerGas, // EIP-1559 field
      data: tokenContract.methods.transfer(toAddress, amount).encodeABI(),
    };
    return tx;
  } catch (error) {
    console.error("Error creating transaction:", error);
    throw error;
  }
}

// Sign and send transaction with retry mechanism
async function signAndSendTransaction(tx) {
  try {
    const signedTx = await web3.eth.accounts.signTransaction(tx, PRIVATE_KEY);
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

async function checkBalanceAndTransfer(threshold, recipient) {
  try {
    // Fetch the balance and convert it to a BigNumber
    const balance = await tokenContract.methods.balanceOf(PUBLIC_KEY).call();
    const showBalance = new BigNumber(
      await tokenContract.methods.balanceOf(PUBLIC_KEY).call()
    );

    console.log(`Raw Balance: ${balance.toString()}`);

    // Trigger transfer if balance is greater than 0
    if (showBalance.isGreaterThan(0)) {
      console.log(`Balance is greater than 0, initiating transfer...`);
      const gasPrices = await getDynamicGasPrice();
      const amount = balance.toString(); // Convert to string for transfer
      const tx = await createTransferTransaction(
        recipient,
        amount,
        gasPrices.maxFeePerGas,
        gasPrices.maxPriorityFeePerGas
      );
      await signAndSendTransaction(tx);
      console.log("Transfer successful");
    } else {
      console.log("Balance is 0 or below, waiting...");
    }
  } catch (error) {
    console.error("Error checking balance:", error);
  }
}

// Main function to run the bot with error handling and reconnection logic
async function runBot() {
  const recipient = RECIPIENT_ADDRESS;
  let attempts = 0;

  while (attempts < 10000) {
    // Limit attempts to prevent infinite loops in case of errors
    try {
      await checkBalanceAndTransfer(0, recipient); // No threshold, transfer any positive balance
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
