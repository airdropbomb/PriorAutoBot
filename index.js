import "dotenv/config";
import blessed from "blessed";
import figlet from "figlet";
import { ethers } from "ethers";

const RPC_URL = process.env.RPC_URL;
const PRIVATE_KEYS = [
  process.env.PRIVATE_KEY_1,
  process.env.PRIVATE_KEY_2,
  // လိုချင်ရင် PRIVATE_KEY_3, PRIVATE_KEY_4 စသဖြင့် ထပ်ထည့်လို့ ရတယ်
].filter(key => key); // ဗလာ key တွေ မပါအောင် filter လုပ်တယ်
const USDC_ADDRESS = "0x109694D75363A75317A8136D80f50F871E81044e";
const USDT_ADDRESS = "0x014397DaEa96CaC46DbEdcbce50A42D5e0152B2E";
const PRIOR_ADDRESS = "0xc19Ec2EEBB009b2422514C51F9118026f1cD89ba";
const routerAddress = "0x0f1DADEcc263eB79AE3e4db0d57c49a8b6178B0B";
const FAUCET_ADDRESS = "0xCa602D9E45E1Ed25105Ee43643ea936B8e2Fd6B7";
const NETWORK_NAME = "PRIOR TESTNET";

let walletsInfo = [];
let transactionLogs = [];
let priorSwapRunning = false;
let priorSwapCancelled = false;
let globalWallets = [];

const ERC20_ABI = [
  "function balanceOf(address owner) view returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function transfer(address to, uint256 amount) returns (bool)",
  "function transferFrom(address from, address to, uint256 amount) returns (bool)"
];

const routerABI = [
  {
    "inputs": [{ "internalType": "uint256", "name": "varg0", "type": "uint256" }],
    "name": "swapPriorToUSDC",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [{ "internalType": "uint256", "name": "varg0", "type": "uint256" }],
    "name": "swapPriorToUSDT",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  }
];

const FAUCET_ABI = [
  "function claimTokens() external",
  "function lastClaimTime(address) view returns (uint256)",
  "function claimCooldown() view returns (uint256)",
  "function claimAmount() view returns (uint256)"
];

function getShortAddress(address) {
  return address.slice(0, 6) + "..." + address.slice(-4);
}

function addLog(message, type) {
  const timestamp = new Date().toLocaleTimeString();
  let coloredMessage = message;
  if (type === "prior") coloredMessage = `{bright-magenta-fg}${message}{/bright-magenta-fg}`;
  else if (type === "system") coloredMessage = `{bright-white-fg}${message}{/bright-white-fg}`;
  else if (type === "error") coloredMessage = `{bright-red-fg}${message}{/bright-red-fg}`;
  else if (type === "success") coloredMessage = `{bright-green-fg}${message}{/bright-green-fg}`;
  else if (type === "warning") coloredMessage = `{bright-yellow-fg}${message}{/bright-yellow-fg}`;
  transactionLogs.push(`{bright-cyan-fg}[{/bright-cyan-fg} {bold}{grey-fg}${timestamp}{/grey-fg}{/bold} {bright-cyan-fg}]{/bright-cyan-fg} {bold}${coloredMessage}{/bold}`);
  updateLogs();
}

function getRandomDelay() {
  return Math.random() * (60000 - 30000) + 30000;
}

function getRandomNumber(min, max) {
  return Math.random() * (max - min) + min;
}

function getShortHash(hash) {
  return hash.slice(0, 6) + "..." + hash.slice(-4);
}

function updateLogs() {
  logsBox.setContent(transactionLogs.join("\n"));
  logsBox.setScrollPerc(100);
  safeRender();
}

function clearTransactionLogs() {
  transactionLogs = [];
  updateLogs();
  addLog("Transaction logs telah dihapus.", "system");
}

async function waitWithCancel(delay, type) {
  return Promise.race([
    new Promise(resolve => setTimeout(resolve, delay)),
    new Promise(resolve => {
      const interval = setInterval(() => {
        if (type === "prior" && priorSwapCancelled) { clearInterval(interval); resolve(); }
      }, 100);
    })
  ]);
}

const screen = blessed.screen({
  smartCSR: true,
  title: "Prior Swap",
  fullUnicode: true,
  mouse: true
});

let renderTimeout;
function safeRender() {
  if (renderTimeout) clearTimeout(renderTimeout);
  renderTimeout = setTimeout(() => { screen.render(); }, 50);
}

const headerBox = blessed.box({
  top: 0,
  left: "center",
  width: "100%",
  tags: true,
  style: { fg: "white", bg: "default" }
});

figlet.text("ADB NODE".toUpperCase(), { font: "ANSI Shadow" }, (err, data) => {
  if (err) headerBox.setContent("{center}{bold}ADB NODE{/bold}{/center}");
  else headerBox.setContent(`{center}{bold}{bright-cyan-fg}${data}{/bright-cyan-fg}{/bold}{/center}`);
  safeRender();
});

const descriptionBox = blessed.box({
  left: "center",
  width: "100%",
  content: "{center}{bold}{bright-yellow-fg}                                                  « ✮  P̳̿͟͞R̳̿͟͞I̳̿͟͞O̳̿͟͞R̳̿͟͞ A̳̿͟͞U̳̿͟͞T̳̿͟͞O̳̿͟͞ B̳̿͟͞O̳̿͟͞T̳̿͟͞ ✮ »{/bright-yellow-fg}{/bold}{/center}",
  tags: true,
  style: { fg: "white", bg: "default" }
});

const logsBox = blessed.box({
  label: " Transaction Logs ",
  left: 0,
  border: { type: "line" },
  scrollable: true,
  alwaysScroll: true,
  mouse: true,
  keys: true,
  vi: true,
  tags: true,
  scrollbar: { ch: " ", inverse: true, style: { bg: "blue" } },
  content: "",
  style: { border: { fg: "bright-cyan" }, bg: "default" }
});

const walletBox = blessed.box({
  label: " Informasi Wallets ",
  border: { type: "line" },
  tags: true,
  style: { border: { fg: "magenta" }, fg: "white", bg: "default" },
  content: "Loading Data wallets..."
});

const mainMenu = blessed.list({
  label: " Menu ",
  left: "60%",
  keys: true,
  vi: true,
  mouse: true,
  border: { type: "line" },
  style: { fg: "white", bg: "default", border: { fg: "red" }, selected: { bg: "green", fg: "black" } },
  items: getMainMenuItems()
});

const priorSubMenu = blessed.list({
  label: " Prior Swap Sub Menu ",
  left: "60%",
  keys: true,
  vi: true,
  mouse: true,
  border: { type: "line" },
  style: { fg: "white", bg: "default", border: { fg: "red" }, selected: { bg: "cyan", fg: "black" } },
  items: getPriorMenuItems()
});
priorSubMenu.hide();

const promptBox = blessed.prompt({
  parent: screen,
  border: "line",
  height: 5,
  width: "60%",
  top: "center",
  left: "center",
  label: "{bright-blue-fg}Swap Prompt{/bright-blue-fg}",
  tags: true,
  keys: true,
  vi: true,
  mouse: true,
  style: { fg: "bright-red", bg: "default", border: { fg: "red" } }
});

screen.append(headerBox);
screen.append(descriptionBox);
screen.append(logsBox);
screen.append(walletBox);
screen.append(mainMenu);
screen.append(priorSubMenu);

function getMainMenuItems() {
  let items = ["Prior Swap", "Claim Faucet", "Clear Transaction Logs", "Refresh", "Exit"];
  if (priorSwapRunning) items.unshift("Stop All Transactions");
  return items;
}

function getPriorMenuItems() {
  let items = ["Auto Swap Prior & USDC/USDT", "Clear Transaction Logs", "Back To Main Menu", "Refresh"];
  if (priorSwapRunning) items.splice(1, 0, "Stop Transaction");
  return items;
}

function updateWallet() {
  let content = walletsInfo.map((wallet, index) => {
    const shortAddress = getShortAddress(wallet.address);
    const prior = Number(wallet.balancePrior).toFixed(2);
    const usdc = Number(wallet.balanceUSDC).toFixed(2);
    const usdt = Number(wallet.balanceUSDT).toFixed(2);
    const eth = Number(wallet.balanceETH).toFixed(4);
    return `Wallet ${index + 1}:\n┌── Address : {bright-yellow-fg}${shortAddress}{/bright-yellow-fg}\n│   ├── ETH     : {bright-green-fg}${eth}{/bright-green-fg}\n│   ├── PRIOR   : {bright-green-fg}${prior}{/bright-green-fg}\n│   ├── USDC    : {bright-green-fg}${usdc}{/bright-green-fg}\n│   └── USDT    : {bright-green-fg}${usdt}{/bright-green-fg}\n└── Network     : {bright-cyan-fg}${NETWORK_NAME}{/bright-cyan-fg}\n`;
  }).join("\n");
  walletBox.setContent(content || "No wallets available.");
  safeRender();
}

async function updateWalletData() {
  try {
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    globalWallets = PRIVATE_KEYS.map(key => new ethers.Wallet(key, provider));
    walletsInfo = await Promise.all(globalWallets.map(async wallet => {
      const [ethBalance, balancePrior, balanceUSDC, balanceUSDT] = await Promise.all([
        provider.getBalance(wallet.address),
        new ethers.Contract(PRIOR_ADDRESS, ERC20_ABI, provider).balanceOf(wallet.address),
        new ethers.Contract(USDC_ADDRESS, ERC20_ABI, provider).balanceOf(wallet.address),
        new ethers.Contract(USDT_ADDRESS, ERC20_ABI, provider).balanceOf(wallet.address)
      ]);
      return {
        address: wallet.address,
        balanceETH: ethers.formatEther(ethBalance),
        balancePrior: ethers.formatEther(balancePrior),
        balanceUSDC: ethers.formatUnits(balanceUSDC, 6),
        balanceUSDT: ethers.formatUnits(balanceUSDT, 6)
      };
    }));
    updateWallet();
    addLog("Saldo & Wallets Updated !!", "system");
  } catch (error) {
    addLog("Gagal mengambil data wallets: " + error.message, "system");
  }
}

function stopAllTransactions() {
  if (priorSwapRunning) {
    priorSwapCancelled = true;
    addLog("Stop All Transactions command received. Semua transaksi telah dihentikan.", "system");
  }
}

async function autoClaimFaucet() {
  const provider = new ethers.JsonRpcProvider(RPC_URL);
  for (const wallet of globalWallets) {
    const faucetContract = new ethers.Contract(FAUCET_ADDRESS, FAUCET_ABI, wallet);
    const shortAddress = getShortAddress(wallet.address);
    try {
      const lastClaim = await faucetContract.lastClaimTime(wallet.address);
      const cooldown = await faucetContract.claimCooldown();
      const currentTime = Math.floor(Date.now() / 1000);
      const nextClaimTime = Number(lastClaim) + Number(cooldown);

      if (currentTime < nextClaimTime) {
        const waitTime = nextClaimTime - currentTime;
        const waitHours = Math.floor(waitTime / 3600);
        const waitMinutes = Math.floor((waitTime % 3600) / 60);
        addLog(`Wallet ${shortAddress}: You have to wait ${waitHours} Hours ${waitMinutes} minutes before claiming again.`, "warning");
        continue;
      }
      addLog(`Wallet ${shortAddress}: Starting Claim Faucet PRIOR...`, "system");
      const tx = await faucetContract.claimTokens();
      const txHash = tx.hash;
      addLog(`Wallet ${shortAddress}: Transaction Sent!!. Hash: ${getShortHash(txHash)}`, "warning");

      const receipt = await tx.wait();
      if (receipt.status === 1) {
        addLog(`Wallet ${shortAddress}: Claim Faucet Successfully!!`, "success");
        await updateWalletData();
      } else {
        addLog(`Wallet ${shortAddress}: Claim Faucet Failed.`, "error");
      }
    } catch (error) {
      addLog(`Wallet ${shortAddress}: Error When Claiming: ${error.message}`, "error");
    }
  }
}

async function runAutoSwap() {
  promptBox.setFront();
  promptBox.readInput("Masukkan Jumlah Swap:", "", async (err, value) => {
    promptBox.hide();
    safeRender();
    if (err || !value) {
      addLog("Prior Swap: Input tidak valid atau dibatalkan.", "prior");
      return;
    }
    const loopCount = parseInt(value);
    if (isNaN(loopCount)) {
      addLog("Prior Swap: Input harus berupa angka.", "prior");
      return;
    }
    addLog(`Prior Swap: Anda Memasukkan ${loopCount} kali auto swap untuk semua wallet.`, "prior");
    if (priorSwapRunning) {
      addLog("Prior: Transaksi Sedang Berjalan. Silahkan stop transaksi terlebih dahulu.", "prior");
      return;
    }

    const provider = new ethers.JsonRpcProvider(RPC_URL);
    globalWallets = PRIVATE_KEYS.map(key => new ethers.Wallet(key, provider));

    priorSwapRunning = true;
    priorSwapCancelled = false;
    mainMenu.setItems(getMainMenuItems());
    priorSubMenu.setItems(getPriorMenuItems());
    priorSubMenu.show();
    safeRender();

    for (let i = 1; i <= loopCount; i++) {
      if (priorSwapCancelled) {
        addLog(`Prior Swap: Auto swap dihentikan pada Cycle Ke ${i}.`, "prior");
        break;
      }

      for (const wallet of globalWallets) {
        if (priorSwapCancelled) break;
        const shortAddress = getShortAddress(wallet.address);
        const priorToken = new ethers.Contract(PRIOR_ADDRESS, ERC20_ABI, wallet);
        const randomAmount = getRandomNumber(0.001, 0.01);
        const amountPrior = ethers.parseEther(randomAmount.toFixed(6));
        const isUSDC = i % 2 === 1;
        const functionSelector = isUSDC ? "0xf3b68002" : "0x03b530a3";
        const swapTarget = isUSDC ? "USDC" : "USDT";

        try {
          const approveTx = await priorToken.approve(routerAddress, amountPrior);
          const txHash = approveTx.hash;
          addLog(`Wallet ${shortAddress}: Approval Transaction dikirim. Hash: ${getShortHash(txHash)}`, "prior");
          const approveReceipt = await approveTx.wait();
          if (approveReceipt.status !== 1) {
            addLog(`Wallet ${shortAddress}: Approval gagal. Melewati Cycle ini.`, "prior");
            continue;
          }
          addLog(`Wallet ${shortAddress}: Approval berhasil.`, "prior");
        } catch (approvalError) {
          addLog(`Wallet ${shortAddress}: Error saat approval: ${approvalError.message}`, "prior");
          continue;
        }

        const paramHex = ethers.zeroPadValue(ethers.toBeHex(amountPrior), 32);
        const txData = functionSelector + paramHex.slice(2);
        try {
          addLog(`Wallet ${shortAddress}: Melakukan swap PRIOR ➯ ${swapTarget}, Amount ${ethers.formatEther(amountPrior)} PRIOR`, "prior");
          const tx = await wallet.sendTransaction({
            to: routerAddress,
            data: txData,
            gasLimit: 500000
          });
          const txHash = tx.hash;
          addLog(`Wallet ${shortAddress}: Transaksi dikirim. Hash: ${getShortHash(txHash)}`, "prior");
          const receipt = await tx.wait();
          if (receipt.status === 1) {
            addLog(`Wallet ${shortAddress}: Swap PRIOR ➯ ${swapTarget} berhasil.`, "prior");
            await updateWalletData();
            addLog(`Wallet ${shortAddress}: Swap Ke ${i} Selesai.`, "prior");
          } else {
            addLog(`Wallet ${shortAddress}: Swap PRIOR ➯ ${swapTarget} gagal.`, "prior");
          }
        } catch (txError) {
          addLog(`Wallet ${shortAddress}: Error saat mengirim transaksi swap: ${txError.message}`, "prior");
        }
      }

      if (i < loopCount) {
        const delay = getRandomDelay();
        const minutes = Math.floor(delay / 60000);
        const seconds = Math.floor((delay % 60000) / 1000);
        addLog(`Prior: Menunggu ${minutes} menit ${seconds} detik sebelum transaksi berikutnya`, "prior");
        await waitWithCancel(delay, "prior");
        if (priorSwapCancelled) {
          addLog("Prior: Auto swap Dihentikan saat waktu tunggu.", "prior");
          break;
        }
      }
    }
    priorSwapRunning = false;
    mainMenu.setItems(getMainMenuItems());
    priorSubMenu.setItems(getPriorMenuItems());
    safeRender();
    addLog("Prior Swap: Auto swap selesai.", "prior");
  });
}

function adjustLayout() {
  const screenHeight = screen.height;
  const screenWidth = screen.width;
  const headerHeight = Math.max(8, Math.floor(screenHeight * 0.15));
  headerBox.top = 0;
  headerBox.height = headerHeight;
  headerBox.width = "100%";
  descriptionBox.top = "25%";
  descriptionBox.height = Math.floor(screenHeight * 0.05);
  logsBox.top = headerHeight + descriptionBox.height;
  logsBox.left = 0;
  logsBox.width = Math.floor(screenWidth * 0.6);
  logsBox.height = screenHeight - (headerHeight + descriptionBox.height);
  walletBox.top = headerHeight + descriptionBox.height;
  walletBox.left = Math.floor(screenWidth * 0.6);
  walletBox.width = Math.floor(screenWidth * 0.4);
  walletBox.height = Math.floor(screenHeight * 0.35);
  mainMenu.top = headerHeight + descriptionBox.height + walletBox.height;
  mainMenu.left = Math.floor(screenWidth * 0.6);
  mainMenu.width = Math.floor(screenWidth * 0.4);
  mainMenu.height = screenHeight - (headerHeight + descriptionBox.height + walletBox.height);
  priorSubMenu.top = mainMenu.top;
  priorSubMenu.left = mainMenu.left;
  priorSubMenu.width = mainMenu.width;
  priorSubMenu.height = mainMenu.height;
  safeRender();
}

screen.on("resize", adjustLayout);
adjustLayout();

mainMenu.on("select", (item) => {
  const selected = item.getText();
  if (selected === "Stop All Transactions") {
    stopAllTransactions();
    mainMenu.setItems(getMainMenuItems());
    mainMenu.focus();
    safeRender();
  } else if (selected === "Prior Swap") {
    priorSubMenu.show();
    priorSubMenu.focus();
    safeRender();
  } else if (selected === "Claim Faucet") {
    autoClaimFaucet();
  } else if (selected === "Clear Transaction Logs") {
    clearTransactionLogs();
  } else if (selected === "Refresh") {
    updateWalletData();
    updateLogs();
    safeRender();
    addLog("Refreshed", "system");
  } else if (selected === "Exit") {
    process.exit(0);
  }
});

priorSubMenu.on("select", (item) => {
  const selected = item.getText();
  if (selected === "Auto Swap Prior & USDC/USDT") {
    runAutoSwap();
  } else if (selected === "Stop Transaction") {
    if (priorSwapRunning) {
      priorSwapCancelled = true;
      addLog("Prior Swap: Perintah Stop Transaction diterima.", "prior");
    } else {
      addLog("Prior Swap: Tidak ada transaksi yang berjalan.", "prior");
    }
  } else if (selected === "Clear Transaction Logs") {
    clearTransactionLogs();
  } else if (selected === "Back To Main Menu") {
    priorSubMenu.hide();
    mainMenu.show();
    mainMenu.focus();
    safeRender();
  } else if (selected === "Refresh") {
    updateWalletData();
    updateLogs();
    safeRender();
    addLog("Refreshed", "system");
  }
});

screen.key(["escape", "q", "C-c"], () => process.exit(0));
screen.key(["C-up"], () => { logsBox.scroll(-1); safeRender(); });
screen.key(["C-down"], () => { logsBox.scroll(1); safeRender(); });

safeRender();
mainMenu.focus();
updateLogs();
updateWalletData();
