'use strict';

import {showMessage, state, updateBalancesUI} from './common.js';
import {getRegisteredRoles, registerRole, getTicketHolders} from './config.js';

export function setupBalanceChecking() {
    document.getElementById('checkBalanceButton')?.addEventListener('click', checkBalances);
    document.getElementById('verifyTicketButton')?.addEventListener('click', verifyTicketHolder);
    document.getElementById('checkVenueStatsButton')?.addEventListener('click', displayVenueStats);
    document.getElementById('registerRoleButton')?.addEventListener('click', registerNewRole);
}

export function setupRoleSelection() {
    const roleInputs = document.querySelectorAll('input[name="userRole"]');
    roleInputs.forEach(input => {
        input.addEventListener('change', () => {
            state.userRole = input.value;
            showRoleSection(state.userRole);
        });
    });
}

function showRoleSection(role) {
    document.querySelectorAll('.role-section').forEach(section => {
        section.style.display = 'none';
    });
    document.getElementById(`${role}Section`).style.display = 'block';
}

function checkBalances() {
    const {account, contract, web3} = state;
    if (!account || !contract || !web3) return showMessage("❌ Please connect your wallet first.");

    Promise.all([contract.methods.balanceOf(account).call(), web3.eth.getBalance(account)])
        .then(([ticketBal, ethBal]) => {
            updateBalancesUI(ticketBal, ethBal);
            showMessage("✅ Balances updated!");
        })
        .catch(() => showMessage("❌ Error fetching balances."));
}

function verifyTicketHolder() {
    const address = document.getElementById('verifyAddress')?.value;
    if (!address) return showMessage("❌ Please enter a wallet address.");

    state.contract.methods.balanceOf(address).call()
        .then(balance => {
            document.getElementById('verificationResult').innerText = balance > 0 ? "✅ Valid ticket holder!" : "❌ No tickets found.";
        })
        .catch(() => showMessage("❌ Error verifying ticket holder."));
}

function displayVenueStats() {
    const {contract} = state;
    if (!contract) {
        showMessage("❌ Please connect your wallet first.");
        return;
    }

    getTicketHolders(contract)
        .then(holders => {
            const statsDiv = document.getElementById('venueStats');
            statsDiv.innerHTML = `
                <h4>Ticket Holders:</h4>
                <ul>
                    ${holders.map(holder => `<li>${holder.address}: ${holder.tickets} tickets</li>`).join('')}
                </ul>
            `;
        })
        .catch(() => showMessage("❌ Error fetching venue stats."));
}

function registerNewRole() {
    const roleType = document.getElementById('roleType')?.value;
    const roleName = document.getElementById('roleName')?.value;
    const roleAddress = document.getElementById('roleAddress')?.value;

    if (!roleType || !roleName || !roleAddress) {
        return showMessage("❌ Please fill in all fields.");
    }

    registerRole(roleType, roleName, roleAddress)
        .then(() => {
            showMessage(`✅ ${roleType} registered successfully!`);
            displayRegisteredRoles();
        })
        .catch(() => showMessage("❌ Error registering role."));
}

function displayRegisteredRoles() {
    getRegisteredRoles().then(roles => {
        const rolesDiv = document.getElementById('registeredRoles');
        rolesDiv.innerHTML = roles.map(role => `
            <p>${role.type}: ${role.name} (${role.address})</p>
        `).join('');
    }).catch(() => showMessage("❌ Error fetching registered roles."));
}

