let config, ABI;
const ticketPrice = "0.01";
let account, contract;
let newWallet = null;
let web3;
let uploadedWallet = null;
let connectionType = null;

document.addEventListener('DOMContentLoaded', async () => {
    config = await fetch('./config.json').then(res => res.json());
    ABI = await fetch('./contracts/TicketTokenABI.json').then(res => res.json());

    const { address: contractAddress } = config.contract;

    document.getElementById('connectMetamaskButton').onclick = () => connectWithMetamask(contractAddress);
    document.getElementById('walletFileInput').addEventListener('change', handleWalletFileUpload);
    document.getElementById('connectUploadedWalletButton').onclick = () => connectWithUploadedWallet(contractAddress);
    
    document.getElementById('buyTicketButton').onclick = buyTicket;
    document.getElementById('checkBalanceButton').onclick = checkBalances;
    document.getElementById('transferAmountButton').onclick = transferTicket;
    document.getElementById('createWalletButton').onclick = createWallet;
    document.getElementById('downloadWalletButton').onclick = downloadWallet;
});

export function connectWithMetamask(contractAddress) {
    if (!window.ethereum) return alert("Please install MetaMask!");
    web3 = new Web3(window.ethereum);
    ethereum.request({ method: 'eth_requestAccounts' })
        .then(() => web3.eth.getAccounts())
        .then(accounts => {
            account = accounts[0];
            connectionType = 'metamask';
            updateWalletUI(account);
            contract = new web3.eth.Contract(ABI, contractAddress);
            showMessage("✅ Connected with MetaMask!");
        })
        .catch(error => handleError("Error connecting with MetaMask", error));
}

export function handleWalletFileUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            uploadedWallet = JSON.parse(e.target.result);
            document.getElementById('uploadedWalletInfo').style.display = 'block';
            document.getElementById('uploadedWalletInfo').innerText = 
                `📁 Wallet file loaded: ${uploadedWallet.address || '(Address encrypted)'}`;
            document.getElementById('walletDecryptSection').style.display = 'block';
            showMessage("✅ Wallet file loaded. Enter password to decrypt.");
        } catch (error) {
            handleError("Invalid wallet file", error);
            uploadedWallet = null;
        }
    };
    reader.readAsText(file);
}

export async function connectWithUploadedWallet(contractAddress) {
    if (!uploadedWallet) {
        return showMessage("❌ No wallet file uploaded.");
    }
    
    const password = document.getElementById('walletPassword').value;
    if (!password) {
        return showMessage("❌ Please enter your wallet password.");
    }
    
    try {
        web3 = new Web3(new Web3.providers.HttpProvider(config.provider.url));
        
        const decryptedWallet = await web3.eth.accounts.decrypt(uploadedWallet, password);
        
        web3.eth.accounts.wallet.add(decryptedWallet);
        account = decryptedWallet.address;
        
        connectionType = 'localwallet';
        updateWalletUI(account);
        
        contract = new web3.eth.Contract(ABI, contractAddress);
        
        showMessage("✅ Connected with uploaded wallet!");
    } catch (error) {
        handleError("Error decrypting wallet", error);
    }
}

export function buyTicket() {
    if (!account) return alert("Please connect wallet first.");

    if (connectionType === 'metamask') {
        contract.methods.buyTicket().send({ from: account, value: web3.utils.toWei(ticketPrice, 'ether') })
            .then(() => showMessage("✅ Ticket purchased!"))
            .catch(() => showMessage("❌ Error buying ticket."));
    } else {
        const tx = {
            from: account,
            to: contract.options.address,
            gas: 200000,
            value: web3.utils.toWei(ticketPrice, 'ether'),
            data: contract.methods.buyTicket().encodeABI()
        };
        
        web3.eth.accounts.signTransaction(tx, web3.eth.accounts.wallet[account].privateKey)
            .then(signed => {
                web3.eth.sendSignedTransaction(signed.rawTransaction)
                    .on('receipt', () => showMessage("✅ Ticket purchased!"))
                    .on('error', (error) => {
                        console.error(error);
                        showMessage("❌ Error buying ticket.");
                    });
            })
            .catch(error => handleError("Error signing transaction", error));
    }
}

export function checkBalances() {
    if (!account) return alert("Please connect wallet first.");
    Promise.all([contract.methods.balanceOf(account).call(), web3.eth.getBalance(account)])
        .then(([ticketBal, ethBal]) => updateBalancesUI(ticketBal, ethBal))
        .catch(() => showMessage("❌ Error fetching balances."));
}

export function transferTicket() {
    if (!account) return alert("Please connect wallet first.");
    const to = document.getElementById("transferTo").value;
    const amount = document.getElementById("transferAmount").value;
    if (!to || !amount) return alert("Please enter recipient and amount.");
    
    if (connectionType === 'metamask') {
        contract.methods.transfer(to, amount).send({ from: account })
            .then(() => showMessage(`✅ Transferred ${amount} ticket(s) to ${to}`))
            .catch(() => showMessage("❌ Error transferring ticket."));
    } else {
        const tx = {
            from: account,
            to: contract.options.address,
            gas: 200000,
            data: contract.methods.transfer(to, amount).encodeABI()
        };
        
        web3.eth.accounts.signTransaction(tx, web3.eth.accounts.wallet[account].privateKey)
            .then(signed => {
                web3.eth.sendSignedTransaction(signed.rawTransaction)
                    .on('receipt', () => showMessage(`✅ Transferred ${amount} ticket(s) to ${to}`))
                    .on('error', (error) => {
                        console.error(error);
                        showMessage("❌ Error transferring ticket.");
                    });
            })
            .catch(error => handleError("Error signing transaction", error));
    }
}

export function createWallet() {
    try {
        const web3Instance = new Web3();
        newWallet = web3Instance.eth.accounts.create();

        const walletInfo = document.getElementById("newWalletInfo");
        walletInfo.innerHTML = `
            ✅ New wallet created!<br>
            📝 Address: ${newWallet.address}<br>
            🔒 Private Key: <span class="private-key-container">
                <span class="private-key-hidden">***SENSITIVE—NEVER SHARE***</span>
                <span class="private-key-reveal">${newWallet.privateKey}</span>
                <span class="hover-instruction">(Hover to reveal, click to copy)</span>
                <span class="copy-tooltip">Copied!</span>
              </span><br>
            👇 Set a password below to download your wallet file
        `;
        
        const privateKeyContainer = walletInfo.querySelector('.private-key-container');
        privateKeyContainer.addEventListener('click', async () => {
            try {
                await navigator.clipboard.writeText(newWallet.privateKey);
                
                const tooltip = privateKeyContainer.querySelector('.copy-tooltip');
                tooltip.classList.add('show-tooltip');
                
                setTimeout(() => {
                    tooltip.classList.remove('show-tooltip');
                }, 2000);
                
                showMessage("✅ Private key copied to clipboard!");
            } catch (err) {
                showMessage("❌ Failed to copy: " + err);
            }
        });

        document.getElementById("walletPasswordSection").style.display = "block";
        showMessage("✅ New wallet created! Set a password to download it.");
    } catch (error) {
        handleError("Error creating wallet", error);
    }
}

export function downloadWallet() {
    if (!newWallet) {
        return showMessage("❌ No wallet created yet. Please create a wallet first.");
    }

    const password = document.getElementById("walletPasswordCreate").value;
    if (!password) {
        return showMessage("❌ Please enter a password to encrypt your wallet.");
    }

    try {
        const web3Instance = new Web3();
        web3Instance.eth.accounts.encrypt(newWallet.privateKey, password)
            .then(keystore => {
                const keystoreJSON = JSON.stringify(keystore, null, 2);

                const blob = new Blob([keystoreJSON], { type: 'application/json' });
                const url = URL.createObjectURL(blob);

                const a = document.createElement('a');
                a.href = url;
                a.download = `ethmission-wallet-${newWallet.address.substring(2, 8)}.json`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);

                showMessage("✅ Wallet downloaded successfully! Keep it safe.");
            });
    } catch (error) {
        handleError("Error downloading wallet", error);
    }
}

export function updateWalletUI(account) {
    document.getElementById("walletAddress").innerText = `✅ Connected: ${account}`;
}

export function updateBalancesUI(ticketBal, ethBal) {
    document.getElementById("balances").innerHTML = `
        🪙 Ticket Tokens: ${web3.utils.fromWei(ticketBal, 'ether')}<br>
        💰 ETH: ${web3.utils.fromWei(ethBal, 'ether')}
    `;
}

export function handleError(message, error) {
    console.error(message, error);
    showMessage(`❌ ${message}: ${error.message}`);
}

const showMessage = (msg) => document.getElementById("output").innerText = msg;

window.connectWithMetamask = connectWithMetamask;
window.connectWithUploadedWallet = connectWithUploadedWallet;
window.handleWalletFileUpload = handleWalletFileUpload;
window.buyTicket = buyTicket;
window.checkBalances = checkBalances;
window.transferTicket = transferTicket;
window.createWallet = createWallet;
window.downloadWallet = downloadWallet;
