// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {BlackpinkTickets} from "../BlackpinkTickets.sol";

/// @dev Minimal six-decimal ERC-20 used as USDC in tests.
contract MockUSDC {
    string public name = "Mock USDC";
    string public symbol = "mUSDC";
    uint8 public constant decimals = 6;
    uint256 public totalSupply;
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);

    function mint(address to, uint256 amount) external {
        totalSupply += amount;
        balanceOf[to] += amount;
        emit Transfer(address(0), to, amount);
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        emit Approval(msg.sender, spender, amount);
        return true;
    }

    function transfer(address to, uint256 amount) external returns (bool) {
        _move(msg.sender, to, amount);
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        uint256 a = allowance[from][msg.sender];
        if (a != type(uint256).max) {
            require(a >= amount, "allowance");
            allowance[from][msg.sender] = a - amount;
        }
        _move(from, to, amount);
        return true;
    }

    function _move(address from, address to, uint256 amount) internal {
        require(balanceOf[from] >= amount, "balance");
        balanceOf[from] -= amount;
        balanceOf[to] += amount;
        emit Transfer(from, to, amount);
    }
}

abstract contract BlackpinkTestBase is Test {
    BlackpinkTickets internal t;
    MockUSDC internal usdc;

    address internal owner = makeAddr("owner");
    address internal alice = makeAddr("alice");
    address internal bob = makeAddr("bob");
    address internal carol = makeAddr("carol");

    uint256 internal constant FUNDS = 1_000_000e6;

    function setUp() public virtual {
        usdc = new MockUSDC();
        t = new BlackpinkTickets(address(usdc), owner);
        address[3] memory users = [alice, bob, carol];
        for (uint256 i; i < users.length; ++i) {
            usdc.mint(users[i], FUNDS);
            vm.prank(users[i]);
            usdc.approve(address(t), type(uint256).max);
        }
    }

    function _one(uint16 seat) internal pure returns (uint16[] memory a) {
        a = new uint16[](1);
        a[0] = seat;
    }

    function _buy(address who, uint8 show, uint16 seat) internal {
        vm.prank(who);
        t.buyTickets(show, _one(seat));
    }

    /// @dev Buys `n` consecutive seats starting at `first` for `who`.
    function _buyRange(address who, uint8 show, uint16 first, uint256 n) internal {
        uint16[] memory seats = new uint16[](n);
        for (uint256 i; i < n; ++i) {
            seats[i] = first + uint16(i);
        }
        vm.prank(who);
        t.buyTickets(show, seats);
    }

    function _tid(uint8 show, uint16 seat) internal view returns (uint256) {
        return t.tokenIdOf(show, seat);
    }
}
