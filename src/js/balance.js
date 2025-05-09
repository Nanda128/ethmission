'use strict';

import {handleError, showMessage, state, updateBalancesUI, isValidAddress, getInputValue} from './common.js';
import {getAdminPassword, getRegisteredRoles, getTicketHolders, initConfig, registerRole, getUserEvents, getEvents} from './config.js';

const handlers = {
    checkBalanceButton: checkBalances,
    verifyTicketButton: verifyTicketHolder,
    checkVenueStatsButton: displayVenueStats,
    registerRoleButton: registerNewRole
};

function getRoleSectionId(role) {
    const roleMap = {
        'Attendee': 'AttendeeSection',
        'Doorman': 'DoormanSection',
        'Venue': 'VenueSection',
        'Admin': 'AdminSection'
    };
    return roleMap[role] || 'AttendeeSection';
}

async function handleRoleChange(selectedRole) {
    if (selectedRole === 'Admin' && !(await verifyAdminPassword())) {
        handleError("Invalid Admin password.");
        resetToAttendeeRole();
    } else if (['Venue', 'Doorman'].includes(selectedRole) && !(await verifyRoleRegistration(selectedRole))) {
        resetToAttendeeRole();
    } else {
        applyRoleSelection(selectedRole);
    }
}

async function verifyRoleRegistration(roleType) {
    if (!state.account) return handleError("Please connect your wallet first."), false;

    const roles = await getRegisteredRoles();
    const isRegistered = roles.some(role => role.type === roleType && role.address.toLowerCase() === state.account.toLowerCase());
    if (!isRegistered) handleError(`Your wallet is not registered as a ${roleType}.`);
    return isRegistered;
}

async function verifyAdminPassword() {
    const password = prompt("Please enter the Admin password:");
    if (!password) return false;

    try {
        await initConfig();
        return password === getAdminPassword();
    } catch {
        handleError("❌ Unable to verify Admin password. Please try again.");
        return false;
    }
}

async function displayVenueStats() {
    console.log("displayVenueStats called");
    const {account, contract, web3} = state;
    if (!account || !contract) {
        console.log("No account or contract");
        return handleError("Please connect your wallet first.");
    }

    try {
        console.log("Getting roles");
        const roles = await getRegisteredRoles();

        console.log("Getting ticket holders");
        const holders = await getTicketHolders(contract);
        console.log("Holders:", holders);
        
        console.log("Getting events");
        const allEvents = await getEvents();
        console.log("Events:", allEvents);
        
        const statsDiv = document.getElementById('venueStats');
        console.log("statsDiv:", statsDiv);
        
        statsDiv.innerHTML = '<div class="loading-throbber"></div>' +
                            '<p>Loading ticket holder data...</p>';
        
        statsDiv.innerHTML = '<ul class="ticket-holders-list"></ul>';
        const holdersList = statsDiv.querySelector('.ticket-holders-list');
        
        if (holders.length === 0) {
            holdersList.innerHTML = '<li>No ticket holders found</li>';
            return;
        }
        
        console.log("Processing holders");
        for (const {address, tickets} of holders) {
            const shortAddress = `${address.slice(0, 4)}...${address.slice(-4)}`;
            const ticketsInTKT = web3.utils.fromWei(tickets, 'ether');
            
            console.log("Processing holder:", address, ticketsInTKT);
            
            const userRoles = roles.filter(role => 
                role.address.toLowerCase() === address.toLowerCase()
            );
            
            const attendedEvents = await getUserEvents(address);
            console.log("Attended events:", attendedEvents);
            
            const organizedEvents = allEvents.filter(event => 
                event.venueManager?.toLowerCase() === address.toLowerCase() || 
                event.doorman?.toLowerCase() === address.toLowerCase()
            );
            console.log("Organized events:", organizedEvents);
            
            let holderHTML = `
                <li class="ticket-holder-item">
                    <div class="holder-main-info">
                        <span class="address-container" data-full-address="${address}">
                            ${shortAddress} <span class="hover-instruction">(Click to copy full address)</span>
                            <span class="copy-tooltip">Copied!</span>
                        </span> 
                        <span class="ticket-balance">${ticketsInTKT} TKT</span>
                    </div>`;
            
            if (userRoles.length > 0) {
                holderHTML += `<div class="holder-roles">
                    <strong>Roles:</strong> ${userRoles.map(r => `${r.name} (${r.type})`).join(', ')}
                </div>`;
            }
            
            if (organizedEvents.length > 0) {
                holderHTML += `<div class="holder-organized-events">
                    <strong>Organizes/Manages:</strong> ${organizedEvents.map(e => e.name).join(', ')}
                </div>`;
            }
            
            if (attendedEvents.length > 0) {
                holderHTML += `<div class="holder-attended-events">
                    <strong>Attended:</strong> ${attendedEvents.map(e => e.name).join(', ')}
                </div>`;
            }
            
            holderHTML += `</li>`;
            holdersList.innerHTML += holderHTML;
        }
        
        console.log("Setting up address copy");
        setupAddressCopy(statsDiv);
        showMessage("✅ Ticket distribution loaded successfully!");
    } catch (error) {
        console.error("Error in displayVenueStats:", error);
        handleError("Error fetching venue stats: " + error.message);
    }
}

export function setupBalanceChecking() {
    Object.keys(handlers).forEach(id => setupButton(id, handlers[id]));
}

export function setupRoleSelection() {
    document.querySelectorAll('input[name="userRole"]').forEach(input => {
        input.addEventListener('change', () => handleRoleChange(input.value));
    });
}

export function checkBalances() {
    const {account, contract, web3} = state;
    if (!account || !contract || !web3) return handleError("Please connect your wallet first.");

    const throbber = document.getElementById('loadingThrobber');
    Promise.all([contract.methods.balanceOf(account).call(), web3.eth.getBalance(account)])
        .then(([ticketBal, ethBal]) => {
            updateBalancesUI(ticketBal, ethBal);
            showMessage("✅ Balances updated!");
        })
        .catch(() => handleError("Error fetching balances."))
        .finally(() => throbber && (throbber.style.display = 'none'));
}

function toggleRoleSection(role) {
    document.querySelectorAll('.role-section').forEach(section => section.style.display = 'none');
    const sectionId = getRoleSectionId(role);
    const section = document.getElementById(sectionId);
    if (section) {
        section.style.display = 'block';
    } else {
        console.error(`Section not found: ${sectionId}`);
    }
}

function verifyTicketHolder() {
    if (!state.contract) return handleError("Please connect your wallet first.");

    const address = getInputValue('verifyAddress');
    if (!address) return handleError("Please enter a wallet address.");

    state.contract.methods.balanceOf(address).call()
        .then(async balance => {
            document.getElementById('verificationResult').innerText = balance > 0 ? "✅ Valid ticket holder!" : "❌ No tickets found.";
            await showAttendeeEvents(address);
        })
        .catch(() => handleError("Error verifying ticket holder."));
}

async function showAttendeeEvents(address) {
    try {
        const userEvents = await getUserEvents(address);
        
        const eventsDiv = document.getElementById('attendeeEvents');
        if (userEvents.length > 0) {
            eventsDiv.innerHTML = `<h4>Registered Events:</h4><ul>` +
                userEvents.map(event => `<li>${event.name} - ${new Date(event.date).toLocaleString()}</li>`).join('') +
                `</ul>`;
        } else {
            eventsDiv.innerHTML = `<p>No registered events found for this address.</p>`;
        }
    } catch (error) {
        handleError("Error fetching attendee events", error);
    }
}

function registerNewRole() {
    const roleType = getInputValue('roleType');
    const roleName = getInputValue('roleName');
    const roleAddress = getInputValue('roleAddress');

    if (!roleType || !roleName || !roleAddress) return handleError("Please fill in all fields.");
    if (!state.account) return handleError("Please connect your wallet first.");

    getRegisteredRoles().then(roles => {
        if (roles.some(role => role.name === roleName || role.address === roleAddress)) {
            return handleError("Name or address already registered. Please use different values.");
        }

        if (!isValidAddress(roleAddress)) {
            return handleError("Invalid wallet address or Web3 Initialization Error.");
        }

        registerRole(roleType, roleName, roleAddress)
            .then(() => {
                showMessage(`✅ ${roleType} registered successfully!`);
                displayRegisteredRoles();
            })
            .catch(() => handleError("Error registering role."));
    });
}

function applyRoleSelection(role) {
    state.userRole = role;
    toggleRoleSection(role);
    showMessage(`✅ ${role} access granted.`);
}

function resetToAttendeeRole() {
    document.querySelector('input[value="Attendee"]').checked = true;
    applyRoleSelection('Attendee');
}

function displayRegisteredRoles() {
    getRegisteredRoles().then(roles => {
        const rolesDiv = document.getElementById('registeredRoles');
        rolesDiv.innerHTML = roles.map(({name, address, type}) => `<p>${name} (${type}): ${address}</p>`).join('');
    });
}

function setupButton(buttonId, handler) {
    document.getElementById(buttonId)?.addEventListener('click', handler);
}

function setupAddressCopy(container) {
    container.querySelectorAll('.address-container').forEach(element => {
        element.addEventListener('click', async () => {
            try {
                const fullAddress = element.dataset.fullAddress;
                await navigator.clipboard.writeText(fullAddress);
                const tooltip = element.querySelector('.copy-tooltip');
                tooltip.classList.add('show-tooltip');
                setTimeout(() => tooltip.classList.remove('show-tooltip'), 2000);
                showMessage("✅ Full address copied to clipboard!");
            } catch {
                handleError("Failed to copy address.");
            }
        });
    });
}