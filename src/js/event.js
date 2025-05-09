'use strict';

import {state, showMessage, handleError, isValidAddress, getInputValue} from './common.js';
import {registerRole, getEvents, saveEvent, updateEventAttendance, recordEventEntry} from './config.js';

export function setupEventCreation() {
    const createButton = document.getElementById('createEventButton');
    createButton?.addEventListener('click', createEvent);
}

export function setupEventEntry() {
    const eventSelector = document.getElementById('eventSelector');
    const enterButton = document.getElementById('enterEventButton');

    eventSelector?.addEventListener('change', loadEventOptionsAndDetails);
    enterButton?.addEventListener('click', enterEvent);

    loadEventOptionsAndDetails()
}

async function createEvent() {
    if (!state.account) return handleError("Please connect your wallet first.");

    const eventName = getInputValue('eventName');
    const eventDate = getInputValue('eventDate');
    const doormanAddress = getInputValue('doormanAddress');
    const maxCapacity = getInputValue('maxCapacity');

    if (!eventName || !eventDate || !doormanAddress || !maxCapacity) {
        return handleError("Please fill in all event details.");
    }
    if (!isValidAddress(doormanAddress)) {
        return handleError("Invalid doorman wallet address.");
    }

    try {
        const newEvent = {
            id: Date.now().toString(),
            name: eventName,
            date: eventDate,
            doorman: doormanAddress,
            venueManager: state.account,
            maxCapacity: parseInt(maxCapacity),
            currentAttendance: 0
        };

        await Promise.all([registerRole("Doorman", eventName, doormanAddress), registerRole("Venue", eventName, state.account), saveEvent(newEvent)]);

        showMessage(`✅ Event "${eventName}" created successfully!`);
        clearInputs(['eventName', 'eventDate', 'doormanAddress', 'maxCapacity']);
    } catch (error) {
        handleError("Error creating event", error);
    }
}

async function loadEventOptionsAndDetails() {
    try {
        const events = await getEvents();
        populateEventSelector(events);
        await displaySelectedEventDetails(events);
    } catch (error) {
        handleError("Error loading events", error);
    }
}

function populateEventSelector(events) {
    const selector = document.getElementById('eventSelector');
    const currentSelection = selector.value;

    selector.innerHTML = '<option value="">Select an event</option>';
    events.forEach(event => {
        const option = new Option(event.name, event.id);
        selector.add(option);
    });

    if (currentSelection) {
        selector.value = currentSelection;
    }
}

async function displaySelectedEventDetails(events) {
    const eventId = getInputValue('eventSelector');
    const detailsContainer = document.getElementById('eventDetails');
    detailsContainer.style.display = 'none';
    if (!eventId) return;

    const selectedEvent = events.find(event => event.id === eventId);
    if (!selectedEvent) return;

    updateEventDetailsUI(selectedEvent);
    await updateTicketInfo(selectedEvent);
    detailsContainer.style.display = 'block';
}

function updateEventDetailsUI(event) {
    setTextContent('selectedEventName', event.name);
    setTextContent('selectedEventDate', new Date(event.date).toLocaleString());
    setTextContent('currentAttendance', event.currentAttendance);
    setTextContent('maxCapacity', event.maxCapacity);

    const capacityPercentage = (event.currentAttendance / event.maxCapacity) * 100;
    document.getElementById('capacityIndicator').style.width = `${capacityPercentage}%`;
    toggleElement('capacityWarning', event.currentAttendance >= event.maxCapacity);
    document.getElementById('enterEventButton').disabled = event.currentAttendance >= event.maxCapacity;
}

async function updateTicketInfo(event) {
    if (!state.contract) return;

    const ticketBalance = await state.contract.methods.balanceOf(state.account).call();
    const hasTickets = parseInt(ticketBalance) > 0;

    setTextContent('ticketBalance', hasTickets ? "✅ You have tickets available to enter." : "❌ You need at least 1 TKT to enter this event.");

    document.getElementById('enterEventButton').disabled = !hasTickets || event.currentAttendance >= event.maxCapacity;
}

async function enterEvent() {
    if (!state.account || !state.contract) return handleError("Please connect your wallet first.");

    const eventId = getInputValue('eventSelector');
    if (!eventId) return handleError("Please select an event to enter.");

    try {
        const ticketBalance = await state.contract.methods.balanceOf(state.account).call();
        if (parseInt(ticketBalance) <= 0) {
            return handleError("You need at least 1 TKT to enter this event.");
        }

        const events = await getEvents();
        const selectedEvent = events.find(event => event.id === eventId);
        if (!selectedEvent || selectedEvent.currentAttendance >= selectedEvent.maxCapacity) {
            return handleError("This event has reached maximum capacity.");
        }

        await transferTicket(selectedEvent);
        selectedEvent.currentAttendance += 1;
        await updateEventAttendance(eventId, selectedEvent.currentAttendance);

        await recordEventEntry(eventId, state.account);

        showMessage("✅ Successfully entered the event!");
        await displaySelectedEventDetails(events);
    } catch (error) {
        handleError("Error entering event", error);
    }
}

async function transferTicket(event) {
    const burnAmount = state.web3.utils.toWei("1", "ether");
    const method = state.contract.methods.transfer(event.venueManager, burnAmount);

    if (state.connectionType === 'metamask') {
        await method.send({from: state.account});
    } else {
        const data = method.encodeABI();
        const tx = {to: state.contract.options.address, gas: 300000, data, from: state.account};
        const privateKey = state.web3.eth.accounts.wallet[state.account].privateKey;

        const signed = await state.web3.eth.accounts.signTransaction(tx, privateKey);
        await state.web3.eth.sendSignedTransaction(signed.rawTransaction);
    }
}

function setTextContent(id, text) {
    document.getElementById(id).textContent = text;
}

function toggleElement(id, show) {
    document.getElementById(id).style.display = show ? 'block' : 'none';
}

function clearInputs(ids) {
    ids.forEach(id => (document.getElementById(id).value = ''));
}