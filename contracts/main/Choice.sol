// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

struct Choice {
    uint256 _id;
    string _description;
    address _fundsAddress; // fees are paid to this address
    uint16 _feePercentage; // fees paid to choice from votes
    uint256 _fundingTarget; // connot recieve funds more than this amount
}
