// Import modules
import Web3 from "web3";
import dotenv from "dotenv";
import BigNumber from "bignumber.js";

// Load environment variables from the .env file
dotenv.config();

// Use a valid BSC RPC endpoint (Infura does NOT support BSC)
const BSC_RPC = "https://bsc-mainnet.infura.io/v3/dfc5c6112e594e43a38688615b7859aa";
const web3 = new Web3(BSC_RPC);

// Load sensitive variables
const { PRIVATE_KEY, TOKEN_ADDRESS, RECIPIENT_ADDRESS } = process.env;
const account = web3.eth.accounts.privateKeyToAccount(PRIVATE_KEY);
const PUBLIC_KEY = account.address;

const TOKEN_ABI = [
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "address",
        name: "owner",
        type: "address",
      },
      {
        indexed: true,
        internalType: "address",
        name: "spender",
        type: "address",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "amount",
        type: "uint256",
      },
    ],
    name: "Approval",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: "address", name: "from", type: "address" },
      { indexed: true, internalType: "address", name: "to", type: "address" },
      {
        indexed: false,
        internalType: "uint256",
        name: "amount",
        type: "uint256",
      },
    ],
    name: "Transfer",
    type: "event",
  },
  {
    inputs: [
      { internalType: "address", name: "owner", type: "address" },
      { internalType: "address", name: "spender", type: "address" },
    ],
    name: "allowance",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      { internalType: "address", name: "spender", type: "address" },
      { internalType: "uint256", name: "amount", type: "uint256" },
    ],
    name: "approve",
    outputs: [{ internalType: "bool", name: "", type: "bool" }],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [{ internalType: "address", name: "owner", type: "address" }],
    name: "balanceOf",
    outputs: [{ internalType: "uint256", name: "balance", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "decimals",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      { internalType: "address", name: "_creator", type: "address" },
      { internalType: "uint256", name: "_totalSupply", type: "uint256" },
      { internalType: "string", name: "_name", type: "string" },
      { internalType: "string", name: "_symbol", type: "string" },
      { internalType: "uint256", name: "_decimals", type: "uint256" },
    ],
    name: "init",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [],
    name: "initialized",
    outputs: [{ internalType: "bool", name: "", type: "bool" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "name",
    outputs: [{ internalType: "string", name: "", type: "string" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "symbol",
    outputs: [{ internalType: "string", name: "", type: "string" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "totalSupply",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      { internalType: "address", name: "to", type: "address" },
      { internalType: "uint256", name: "amount", type: "uint256" },
    ],
    name: "transfer",
    outputs: [{ internalType: "bool", name: "", type: "bool" }],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      { internalType: "address", name: "from", type: "address" },
      { internalType: "address", name: "to", type: "address" },
      { internalType: "uint256", name: "amount", type: "uint256" },
    ],
    name: "transferFrom",
    outputs: [{ internalType: "bool", name: "", type: "bool" }],
    stateMutability: "nonpayable",
    type: "function",
  },
];

const tokenContract = new web3.eth.Contract(TOKEN_ABI, TOKEN_ADDRESS);

// Get gas price from BSC
// Get dynamic gas price with fallback
async function getDynamicGasPrice() {
  try {
    const gasPrice = await web3.eth.getGasPrice();
    console.log(`Gas Price: ${web3.utils.fromWei(gasPrice, "gwei")} gwei`);
    return gasPrice;
  } catch (error) {
    console.error("Error fetching gas price, using fallback:", error);
    return web3.utils.toWei("5", "gwei"); // fallback 5 gwei
  }
}


// Create a transaction
async function createTransferTransaction(toAddress, amount) {
  const nonce = await web3.eth.getTransactionCount(PUBLIC_KEY, "latest");
  const gasPrice = await getDynamicGasPrice();

  // Estimate gas dynamically
  const gasEstimate = await tokenContract.methods
    .transfer(toAddress, amount)
    .estimateGas({ from: PUBLIC_KEY });

  const tx = {
    from: PUBLIC_KEY,
    to: TOKEN_ADDRESS,
    nonce,
    gas: gasEstimate,
    gasPrice,
    data: tokenContract.methods.transfer(toAddress, amount).encodeABI(),
  };

  return tx;
}


// Sign and send
async function signAndSendTransaction(tx) {
  try {
    const signedTx = await web3.eth.accounts.signTransaction(tx, PRIVATE_KEY);
    const receipt = await web3.eth.sendSignedTransaction(
      signedTx.rawTransaction
    );
    console.log("✅ Transfer successful:", receipt.transactionHash);
  } catch (error) {
    console.error("❌ Transaction failed:", error.message || error);
  }
}

// Check balance and transfer
async function checkBalanceAndTransfer(recipient) {
  try {
    const rawBalance = await tokenContract.methods.balanceOf(PUBLIC_KEY).call();
    const balance = new BigNumber(rawBalance);

    if (balance.isGreaterThan(10000000)) {
      console.log(`Balance: ${balance.toString()}`);
      const gasPrice = await getDynamicGasPrice();
      const tx = await createTransferTransaction(
        recipient,
        balance.toFixed(), // transfer full balance
        gasPrice
      );
      await signAndSendTransaction(tx);
    } else {
      console.log("Balance is 0. Skipping transfer.");
    }
  } catch (error) {
    console.error("Error in balance check/transfer:", error);
  }
}

// Run the loop
async function runBot() {
  const recipient = RECIPIENT_ADDRESS;
  let attempts = 0;

  while (attempts < 10000) {
    await checkBalanceAndTransfer(recipient);
    await new Promise((r) => setTimeout(r, 1500));
    attempts++;
  }

  console.log("Bot stopped after max attempts.");
}

runBot().catch(console.error);
