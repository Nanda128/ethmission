'use strict';

import {showMessage, state, updateBalancesUI} from './common.js';
import {getRegisteredRoles, getTicketHolders, registerRole} from './config.js';

export function setupBalanceChecking() {
    setupButton('checkBalanceButton', checkBalances);
    setupButton('verifyTicketButton', verifyTicketHolder);
    setupButton('checkVenueStatsButton', displayVenueStats);
    setupButton('registerRoleButton', registerNewRole);
}

export function setupRoleSelection() {
    document.querySelectorAll('input[name="userRole"]').forEach(input => {
        input.addEventListener('change', () => {
            state.userRole = input.value;
            toggleRoleSection(state.userRole);
        });
    });
}

function toggleRoleSection(role) {
    document.querySelectorAll('.role-section').forEach(section => section.style.display = 'none');
    document.getElementById(`${role}Section`).style.display = 'block';
}

export function checkBalances() {
    const {account, contract, web3} = state;
    if (!account || !contract || !web3) return showMessage("❌ Please connect your wallet first.");

    const throbber = document.getElementById('loadingThrobber');
    Promise.all([contract.methods.balanceOf(account).call(), web3.eth.getBalance(account)])
        .then(([ticketBal, ethBal]) => {
            updateBalancesUI(ticketBal, ethBal);
            showMessage("✅ Balances updated!");
        })
        .catch(() => showMessage("❌ Error fetching balances."))
        .finally(() => throbber && (throbber.style.display = 'none'));
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
    const {contract, web3} = state;
    if (!contract) return showMessage("❌ Please connect your wallet first.");

    getTicketHolders(contract)
        .then(holders => {
            const statsDiv = document.getElementById('venueStats');
            statsDiv.innerHTML = holders.map(holder => {
                const shortAddress = `${holder.address.slice(0, 4)}...${holder.address.slice(-4)}`;
                const ticketsInTKT = web3.utils.fromWei(holder.tickets, 'ether');
                return `<li>
                        <span class="address-container" data-full-address="${holder.address}">
                            ${shortAddress} <span class="hover-instruction">(Click to copy full address)</span>
                            <span class="copy-tooltip">Copied!</span>
                        </span> ${ticketsInTKT} TKT
                    </li>`;
            }).join('');
            setupAddressCopy(statsDiv);
        })
        .catch(() => showMessage("❌ Error fetching venue stats."));
}

function registerNewRole() {
    const roleType = getInputValue('roleType');
    const roleName = getInputValue('roleName');
    const roleAddress = getInputValue('roleAddress');

    if (!roleType || !roleName || !roleAddress) return showMessage("❌ Please fill in all fields.");

    registerRole(roleType, roleName, roleAddress)
        .then(() => {
            showMessage(`✅ ${roleType} registered successfully!`);
            displayRegisteredRoles();
        })
        .catch(() => showMessage("❌ Error registering role."));
}

function displayRegisteredRoles() {
    getRegisteredRoles()
        .then(roles => {
            const rolesDiv = document.getElementById('registeredRoles');
            rolesDiv.innerHTML = roles.map(role => `<p>${role.type}: ${role.name} (${role.address})</p>`).join('');
        })
        .catch(() => showMessage("❌ Error fetching registered roles."));
}

function setupButton(buttonId, handler) {
    document.getElementById(buttonId)?.addEventListener('click', handler);
}

function getInputValue(inputId) {
    return document.getElementById(inputId)?.value;
}

function setupAddressCopy(container) {
    container.querySelectorAll('.address-container').forEach(element => {
        element.addEventListener('click', async () => {
            try {
                const fullAddress = element.getAttribute('data-full-address');
                await navigator.clipboard.writeText(fullAddress);
                const tooltip = element.querySelector('.copy-tooltip');
                tooltip.classList.add('show-tooltip');
                setTimeout(() => tooltip.classList.remove('show-tooltip'), 2000);
                showMessage("✅ Full address copied to clipboard!");
            } catch (err) {
                showMessage("❌ Failed to copy: " + err);
            }
        });
    });
}