'use strict';

export const CONTRACT_ABI_URL = '../../contracts/TicketTokenABI.json';
export const CONFIG_URL = '../config.json';
export const TICKET_PRICE = "0.01";

let config = null;
let ABI = null;
let roles = [];
let events = [];

try {
    const storedEvents = localStorage.getItem('ethmission_events');
    if (storedEvents) {
        events = JSON.parse(storedEvents);
    }

    const storedRoles = localStorage.getItem('ethmission_roles');
    if (storedRoles) {
        roles = JSON.parse(storedRoles);
    }
} catch (error) {
    console.error("Failed to load data from localStorage:", error);
}

export async function initConfig() {
    try {
        const [configResponse, abiResponse] = await Promise.all([fetch(CONFIG_URL).then(res => res.json()), fetch(CONTRACT_ABI_URL).then(res => res.json())]);
        config = configResponse;
        ABI = abiResponse;
        return {config, ABI};
    } catch (error) {
        console.error("Failed to load configuration:", error);
        throw error;
    }
}

export async function registerRole(type, name, address) {
    roles.push({type, name, address});
    localStorage.setItem('ethmission_roles', JSON.stringify(roles));
    return Promise.resolve();
}

export async function getRegisteredRoles() {
    return Promise.resolve(roles);
}

export async function getTicketHolders(contract) {
    try {
        const result = await contract.methods.getTicketHolders().call();
        const addresses = result[0];
        const tickets = result[1];
        return addresses.map((address, index) => ({address, tickets: tickets[index]}));
    } catch (error) {
        console.error("Failed to fetch ticket holders:", error);
        throw error;
    }
}

export const getVendorAccess = () => config?.vendor?.address;

export const getProviderUrl = () => config?.provider?.url;

export const getAdminPassword = () => config?.admin?.password;

export const displayVendorAddress = () => {
    document.getElementById('vendorAddress').textContent = getVendorAccess();
};

export async function getEvents() {
    return Promise.resolve(events);
}

export async function saveEvent(event) {
    events.push(event);
    localStorage.setItem('ethmission_events', JSON.stringify(events));
    return Promise.resolve();
}

export async function updateEventAttendance(eventId, newAttendance) {
    const event = events.find(e => e.id === eventId);
    if (event) {
        event.currentAttendance = newAttendance;
        localStorage.setItem('ethmission_events', JSON.stringify(events));
    }
    return Promise.resolve();
}

export async function recordEventEntry(eventId, userAddress) {
    const attendeeKey = 'ethmission_event_attendees';
    let attendeeMap = JSON.parse(localStorage.getItem(attendeeKey) || '{}');

    if (!attendeeMap[userAddress]) {
        attendeeMap[userAddress] = [];
    }

    if (!attendeeMap[userAddress].includes(eventId)) {
        attendeeMap[userAddress].push(eventId);
    }

    localStorage.setItem(attendeeKey, JSON.stringify(attendeeMap));
    return Promise.resolve();
}

export async function getUserEvents(userAddress) {
    const attendeeKey = 'ethmission_event_attendees';
    const attendeeMap = JSON.parse(localStorage.getItem(attendeeKey) || '{}');
    const userEventIds = attendeeMap[userAddress] || [];

    const allEvents = await getEvents();

    return allEvents.filter(event => userEventIds.includes(event.id));
}

initConfig().catch(console.error);
