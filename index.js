import "dotenv/config";
import blessed from "blessed";
import figlet from "figlet";
import { ethers } from "ethers";

const RPC_URL = process.env.RPC_URL;
// Load multiple private keys from environment (e.g., PRIVATE_KEYS="key1,key2,key3")
const PRIVATE_KEYS = process.env.PRIVATE_KEYS.split(",");
const USDC_ADDRESS = "0x109694D75363A75317A8136D80f50F871E81044e";
const USDT_ADDRESS = "0x014397DaEa96CaC46DbEdcbce50A42D5e0152B2E";
const PRIOR_ADDRESS = "0xc19Ec2EEBB009b2422514C51F9118026f1cD89ba";
const routerAddress = "0x0f1DADEcc263eB79AE3e4db0d57c49a8b6178B0B";
const FAUCET_ADDRESS = "0xCa602D9E45E1Ed25105Ee43643ea936B8e2Fd6B7";
const NETWORK_NAME = "PRIOR TESTNET";

// Array to store multiple wallet info
let walletsInfo = [];
let transactionLogs = [];
let priorSwapRunning = false;
let priorSwapCancelled = false;
let globalWallets = [];

const ERC20_ABI = [/* unchanged */];
const routerABI = [/* unchanged */];
const FAUCET_ABI = [/* unchanged */];

// Utility functions (unchanged except where noted)
function getShortAddress(address) { return address.slice(0, 6) + "..." + address.slice(-4); }
function addLog(message, type) { /* unchanged */ }
function getRandomDelay() { return Math.random() * (60000 - 30000) + 30000; }
function getRandomNumber(min, max) { return Math.random() * (max - min) + min; }
function getShortHash(hash) { return hash.slice(0, 6) + "..." + hash.slice(-4); }
function updateLogs() { /* unchanged */ }
function clearTransactionLogs() { /* unchanged */ }
async function waitWithCancel(delay, type) { /* unchanged */ }

const screen = blessed.screen({ /* unchanged */ });
const headerBox = blessed.box({ /* unchanged */ });
figlet.text("ADB NODE", { font: "Doom" }, (err, data) => { /* unchanged */ });
const descriptionBox = blessed.box({ /* unchanged */ });
const logsBox = blessed.box({ /* unchanged */ });

// Adjusted walletBox to display multiple wallets
const walletBox = blessed.box({
  label: "{cyan-fg}◄ WALLETS 💰 ►{/cyan-fg}",
  top: "20%",
  left: 0,
  width: "40%",
  height: "25%",
  border: { type: "line" },
  tags: true,
  style: { border: { fg: "cyan" }, fg: "white", bg: "black" },
  content: "Initializing wallets... 🔄",
  scrollable: true, // Allow scrolling if many wallets
  scrollbar: { ch: "│", style: { bg: "cyan" } }
});

const codeStreamBox = blessed.box({ /* unchanged */ });
const mainMenu = blessed.list({ /* unchanged */ });
const priorSubMenu = blessed.list({ /* unchanged */ });
const promptBox = blessed.prompt({ /* unchanged */ });

screen.append(headerBox);
screen.append(descriptionBox);
screen.append(logsBox);
screen.append(walletBox);
screen.append(codeStreamBox);
screen.append(mainMenu);
screen.append(priorSubMenu);

function getMainMenuItems() { /* unchanged */ }
function getPriorMenuItems() { /* unchanged */ }

// Update wallet display for multiple wallets
function updateWalletsDisplay() {
  let content = "";
  walletsInfo.forEach((walletInfo, index) => {
    const shortAddress = walletInfo.address ? getShortAddress(walletInfo.address) : "N/A";
    const prior = walletInfo.balancePrior ? Number(walletInfo.balancePrior).toFixed(2) : "0.00";
    const usdc = walletInfo.balanceUSDC ? Number(walletInfo.balanceUSDC).toFixed(2) : "0.00";
    const usdt = walletInfo.balanceUSDT ? Number(walletInfo.balanceUSDT).toFixed(2) : "0.00";
    const eth = walletInfo.balanceETH ? Number(walletInfo.balanceETH).toFixed(4) : "0.000";
    content += `{cyan-fg}W${index + 1} 🌐:{/cyan-fg} ${shortAddress}\n` +
               `{cyan-fg}ETH 💎:{/cyan-fg} ${eth}  ` +
               `{cyan-fg}PRIOR 🚀:{/cyan-fg} ${prior}\n` +
               `{cyan-fg}USDC 💵:{/cyan-fg} ${usdc}  ` +
               `{cyan-fg}USDT 💲:{/cyan-fg} ${usdt}\n` +
               `-------------------------\n`;
  });
  walletBox.setContent(content.trim());
  walletBox.setScrollPerc(100);
  safeRender();
}

// Fake code stream (unchanged)
const fakeCodeSnippets = [/* unchanged */];
function updateCodeStream() { /* unchanged */ }
setInterval(updateCodeStream, 1000);

// Initialize and update multiple wallets
async function updateWalletsData() {
  try {
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    globalWallets = PRIVATE_KEYS.map(key => new ethers.Wallet(key.trim(), provider));
    walletsInfo = globalWallets.map(wallet => ({
      address: wallet.address,
      balanceETH: "0.00",
      balancePrior: "0.00",
      balanceUSDC: "0.00",
      balanceUSDT: "0.00",
      network: NETWORK_NAME,
      status: "Initializing"
    }));

    for (let i = 0; i < globalWallets.length; i++) {
      const wallet = globalWallets[i];
      const [ethBalance, balancePrior, balanceUSDC, balanceUSDT] = await Promise.all([
        provider.getBalance(wallet.address),
        new ethers.Contract(PRIOR_ADDRESS, ERC20_ABI, provider).balanceOf(wallet.address),
        new ethers.Contract(USDC_ADDRESS, ERC20_ABI, provider).balanceOf(wallet.address),
        new ethers.Contract(USDT_ADDRESS, ERC20_ABI, provider).balanceOf(wallet.address)
      ]);

      walletsInfo[i].balanceETH = ethers.formatEther(ethBalance);
      walletsInfo[i].balancePrior = ethers.formatEther(balancePrior);
      walletsInfo[i].balanceUSDC = ethers.formatUnits(balanceUSDC, 6);
      walletsInfo[i].balanceUSDT = ethers.formatUnits(balanceUSDT, 6);
    }

    updateWalletsDisplay();
    addLog("All wallets synced 🔄.", "system");
  } catch (error) {
    addLog("Sync failed: " + error.message, "error");
  }
}

function stopAllTransactions() { /* unchanged */ }

// Adjusted to handle multiple wallets
async function autoClaimFaucet() {
  const provider = new ethers.JsonRpcProvider(RPC_URL);
  for (let i = 0; i < globalWallets.length; i++) {
    const wallet = globalWallets[i];
    const faucetContract = new ethers.Contract(FAUCET_ADDRESS, FAUCET_ABI, wallet);
    const shortAddr = getShortAddress(wallet.address);

    try {
      const lastClaim = await faucetContract.lastClaimTime(wallet.address);
      const cooldown = await faucetContract.claimCooldown();
      const currentTime = Math.floor(Date.now() / 1000);
      const nextClaimTime = Number(lastClaim) + Number(cooldown);

      if (currentTime < nextClaimTime) {
        const waitTime = nextClaimTime - currentTime;
        const waitHours = Math.floor(waitTime / 3600);
        const waitMinutes = Math.floor((waitTime % 3600) / 60);
        addLog(`W${i + 1} [${shortAddr}] Faucet cooldown: ${waitHours}h ${waitMinutes}m ⏳.`, "warning");
        continue;
      }
      addLog(`W${i + 1} [${shortAddr}] Accessing faucet... 🌊`, "system");
      const tx = await faucetContract.claimTokens();
      const txHash = tx.hash;
      addLog(`W${i + 1} Faucet tx: ${getShortHash(txHash)} 📡`, "warning");

      const receipt = await tx.wait();
      if (receipt.status === 1) {
        addLog(`W${i + 1} Faucet success 🎉.`, "success");
      } else {
        addLog(`W${i + 1} Faucet failed 😞.`, "error");
      }
    } catch (error) {
      addLog(`W${i + 1} Faucet error: ${error.message} 🚨`, "error");
    }
  }
  await updateWalletsData();
}

// Adjusted for multiple wallets
async function runAutoSwap() {
  promptBox.setFront();
  promptBox.readInput("Swap cycles: 🔢", "", async (err, value) => {
    promptBox.hide();
    safeRender();
    if (err || !value) { addLog("Swap: Invalid input 🚫.", "prior"); return; }
    const loopCount = parseInt(value);
    if (isNaN(loopCount)) { addLog("Swap: Numeric input required ⚠️.", "prior"); return; }
    addLog(`Swap: Starting ${loopCount} cycles across ${globalWallets.length} wallets 🌠.`, "prior");
    if (priorSwapRunning) { addLog("Swap: Already running. Stop first ⛔.", "prior"); return; }

    const provider = new ethers.JsonRpcProvider(RPC_URL);
    priorSwapRunning = true;
    priorSwapCancelled = false;
    mainMenu.setItems(getMainMenuItems());
    priorSubMenu.setItems(getPriorMenuItems());
    priorSubMenu.show();
    safeRender();

    for (let i = 1; i <= loopCount; i++) {
      if (priorSwapCancelled) {
        addLog(`Swap: Stopped at cycle ${i} 🛑.`, "prior");
        break;
      }

      for (let w = 0; w < globalWallets.length; w++) {
        if (priorSwapCancelled) break;
        const wallet = globalWallets[w];
        const shortAddr = getShortAddress(wallet.address);
        const priorToken = new ethers.Contract(PRIOR_ADDRESS, ERC20_ABI, wallet);
        const randomAmount = getRandomNumber(0.001, 0.01);
        const amountPrior = ethers.parseEther(randomAmount.toFixed(6));
        const isUSDC = i % 2 === 1;
        const functionSelector = isUSDC ? "0xf3b68002" : "0x03b530a3";
        const swapTarget = isUSDC ? "USDC" : "USDT";

        try {
          const approveTx = await priorToken.approve(routerAddress, amountPrior);
          const txHash = approveTx.hash;
          addLog(`W${w + 1} [${shortAddr}] Approval tx: ${getShortHash(txHash)} 📤`, "prior");
          const approveReceipt = await approveTx.wait();
          if (approveReceipt.status !== 1) {
            addLog(`W${w + 1} Approval failed. Skipping 🚫.`, "prior");
            continue;
          }
          addLog(`W${w + 1} Approval done ✅.`, "prior");
        } catch (approvalError) {
          addLog(`W${w + 1} Approval error: ${approvalError.message} 🚨`, "prior");
          continue;
        }

        const paramHex = ethers.zeroPadValue(ethers.toBeHex(amountPrior), 32);
        const txData = functionSelector + paramHex.slice(2);
        try {
          addLog(`W${w + 1} [${shortAddr}] Swapping PRIOR -> ${swapTarget}: ${ethers.formatEther(amountPrior)} 🔄`, "prior");
          const tx = await wallet.sendTransaction({
            to: routerAddress,
            data: txData,
            gasLimit: 500000
          });
          const txHash = tx.hash;
          addLog(`W${w + 1} Swap tx: ${getShortHash(txHash)} 📡`, "prior");
          const receipt = await tx.wait();
          if (receipt.status === 1) {
            addLog(`W${w + 1} Swap to ${swapTarget} done 🎉.`, "prior");
          } else {
            addLog(`W${w + 1} Swap to ${swapTarget} failed 😞.`, "prior");
          }
        } catch (txError) {
          addLog(`W${w + 1} Swap error: ${txError.message} 🚨`, "prior");
        }
      }

      await updateWalletsData();
      if (i < loopCount) {
        const delay = getRandomDelay();
        const minutes = Math.floor(delay / 60000);
        const seconds = Math.floor((delay % 60000) / 1000);
        addLog(`Pausing ${minutes}m ${seconds}s ⏳.`, "prior");
        await waitWithCancel(delay, "prior");
        if (priorSwapCancelled) {
          addLog("Swap: Aborted during pause 🛑.", "prior");
          break;
        }
      }
    }
    priorSwapRunning = false;
    mainMenu.setItems(getMainMenuItems());
    priorSubMenu.setItems(getPriorMenuItems());
    safeRender();
    addLog("Swap: Done 🎯.", "prior");
  });
}

function adjustLayout() { /* unchanged */ }
screen.on("resize", adjustLayout);
adjustLayout();

mainMenu.on("select", (item) => {
  const selected = item.getText();
  if (selected === "Stop All") stopAllTransactions();
  else if (selected === "Prior") priorSubMenu.show(), priorSubMenu.focus();
  else if (selected === "Faucet") autoClaimFaucet();
  else if (selected === "Clear Logs") clearTransactionLogs();
  else if (selected === "Sync") updateWalletsData(), updateLogs(), addLog("Synced 🔄.", "system");
  else if (selected === "Exit") process.exit(0);
  mainMenu.setItems(getMainMenuItems());
  safeRender();
});

priorSubMenu.on("select", (item) => { /* unchanged */ });
screen.key(["escape", "q", "C-c"], () => process.exit(0));
screen.key(["C-up"], () => { logsBox.scroll(-1); safeRender(); });
screen.key(["C-down"], () => { logsBox.scroll(1); safeRender(); });

setInterval(() => { /* unchanged */ }, 500);

safeRender();
mainMenu.focus();
updateLogs();
updateWalletsData();
