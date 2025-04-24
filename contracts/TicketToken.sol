// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract TicketToken is ERC20 {
    address public owner;
    uint public ticketPrice = 0.01 ether;

    constructor() ERC20("TicketToken", "TKT") {
        owner = msg.sender;
    }

    function buyTicket() public payable {
        require(msg.value >= ticketPrice, "Insufficient ETH sent");
        _mint(msg.sender, 1 * 10 ** decimals());
    }

    function refundTicket() public {
        uint balance = balanceOf(msg.sender);
        require(balance > 0, "No tickets to refund");

        _burn(msg.sender, 1 * 10 ** decimals());
        payable(msg.sender).transfer(ticketPrice);
    }

    function withdraw() public {
        require(msg.sender == owner, "Not owner");
        payable(owner).transfer(address(this).balance);
    }

    receive() external payable {}
}
