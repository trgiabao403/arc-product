// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {BlackpinkTestBase} from "./BlackpinkTickets.Base.t.sol";
import {BlackpinkTickets} from "../BlackpinkTickets.sol";

contract BlackpinkTicketsFuzzTest is BlackpinkTestBase {
    function testFuzz_ResaleFeeSplit(uint256 price) public {
        price = bound(price, 1, 1e30);
        _buy(alice, 0, 0);
        uint256 id = _tid(0, 0);
        usdc.mint(bob, price);
        vm.prank(alice);
        t.listForSale(id, price);

        uint256 expectedFee = (price * 500) / 10_000;
        uint256 aliceBefore = usdc.balanceOf(alice);
        uint256 bobBefore = usdc.balanceOf(bob);
        uint256 contractBefore = usdc.balanceOf(address(t));

        vm.expectEmit(true, true, true, true, address(t));
        emit BlackpinkTickets.ListedSold(id, alice, bob, price, expectedFee);
        vm.prank(bob);
        t.buyListed(id, price);

        assertEq(usdc.balanceOf(alice), aliceBefore + price - expectedFee);
        assertEq(usdc.balanceOf(address(t)), contractBefore + expectedFee);
        assertEq(usdc.balanceOf(bob), bobBefore - price);
        // fee never exceeds 5%, and seller + fee == price (no dust created or lost)
        assertLe(expectedFee * 20, price);
        assertEq(t.ownerOf(id), bob);
    }

    function testFuzz_UpgradePriceDifference(uint16 oldSeat, uint16 newSeat) public {
        oldSeat = uint16(bound(oldSeat, 0, 343));
        newSeat = uint16(bound(newSeat, 0, 343));
        _buy(alice, 0, oldSeat);
        uint8 oldTier = t.tierOf(oldSeat);
        uint8 newTier = t.tierOf(newSeat);
        uint256 balBefore = usdc.balanceOf(alice);
        uint256 contractBefore = usdc.balanceOf(address(t));
        uint256 pointsBefore = t.fanPoints(alice);

        if (newTier <= oldTier) {
            vm.expectRevert(abi.encodeWithSelector(BlackpinkTickets.HigherTierRequired.selector, oldTier, newTier));
            vm.prank(alice);
            t.upgradeSeat(_tid(0, oldSeat), newSeat);
            return;
        }
        uint256 diff = t.priceOf(newTier) - t.priceOf(oldTier);
        vm.prank(alice);
        t.upgradeSeat(_tid(0, oldSeat), newSeat);

        assertEq(usdc.balanceOf(alice), balBefore - diff);
        assertEq(usdc.balanceOf(address(t)), contractBefore + diff);
        assertEq(t.fanPoints(alice), pointsBefore + t.pointsOf(newTier) - t.pointsOf(oldTier));
        assertEq(t.ticketsHeld(0, alice), 1);
        assertEq(t.ownerOf(_tid(0, newSeat)), alice);
    }

    function testFuzz_MixedTierTotals(uint8 nSeed, uint16 baseSeed, uint8 strideSeed, uint8 showSeed) public {
        uint256 n = bound(nSeed, 1, 6);
        uint8 show = uint8(bound(showSeed, 0, 1));
        uint256 base = bound(baseSeed, 0, 343);
        // odd stride not divisible by 43 => coprime with 344 => up to 6 distinct seats
        uint256 stride = bound(strideSeed, 0, 100) * 2 + 1;
        if (stride % 43 == 0) stride += 2;

        uint16[] memory seats = new uint16[](n);
        uint256 expectedTotal;
        uint256 expectedPoints;
        uint256 expectedVip;
        for (uint256 i; i < n; ++i) {
            seats[i] = uint16((base + i * stride) % 344);
            uint8 tier = t.tierOf(seats[i]);
            expectedTotal += t.priceOf(tier);
            expectedPoints += t.pointsOf(tier);
            if (tier >= 1) expectedVip++;
        }
        uint256 balBefore = usdc.balanceOf(alice);
        vm.prank(alice);
        t.buyTickets(show, seats);

        assertEq(usdc.balanceOf(alice), balBefore - expectedTotal);
        assertEq(usdc.balanceOf(address(t)), expectedTotal);
        assertEq(t.fanPoints(alice), expectedPoints);
        assertEq(t.vipTickets(alice), expectedVip);
        assertEq(t.ticketsHeld(show, alice), n);
        for (uint256 i; i < n; ++i) {
            assertEq(t.ownerOf(_tid(show, seats[i])), alice);
        }
    }

    function testFuzz_WalletCapAcrossTwoPurchases(uint8 aSeed, uint8 bSeed) public {
        uint256 a = bound(aSeed, 1, 6);
        uint256 b = bound(bSeed, 1, 6);
        _buyRange(alice, 0, 0, a);
        uint16[] memory seats = new uint16[](b);
        for (uint256 i; i < b; ++i) {
            seats[i] = uint16(100 + i);
        }
        if (a + b > 6) {
            vm.expectRevert(abi.encodeWithSelector(BlackpinkTickets.WalletCapExceeded.selector, uint8(0), alice));
        }
        vm.prank(alice);
        t.buyTickets(0, seats);
        assertLe(t.ticketsHeld(0, alice), 6);
        assertEq(t.ticketsHeld(0, alice), a + b > 6 ? a : a + b);
    }

    function testFuzz_Lightsticks(uint256 qty) public {
        qty = bound(qty, 1, 10);
        uint256 bal = usdc.balanceOf(alice);
        vm.prank(alice);
        t.buyLightstick(qty);
        assertEq(bal - usdc.balanceOf(alice), 5e6 * qty);
        assertEq(t.fanPoints(alice), 25 * qty);
        assertEq(t.lightsticks(alice), qty);
    }

    function testFuzz_WithdrawEmptiesContract(uint8 qty) public {
        uint256 q = bound(qty, 1, 10);
        vm.prank(alice);
        t.buyLightstick(q);
        _buy(bob, 0, 300);
        uint256 held = usdc.balanceOf(address(t));
        vm.prank(owner);
        t.withdrawRevenue(carol);
        assertEq(usdc.balanceOf(carol), FUNDS + held);
        assertEq(usdc.balanceOf(address(t)), 0);
    }

    function testFuzz_GetFansPagination(uint256 offset, uint256 limit) public {
        _buy(alice, 0, 1);
        _buy(bob, 0, 2);
        _buy(carol, 0, 3);
        offset = bound(offset, 0, 10);
        limit = bound(limit, 0, 10);
        address[] memory page = t.getFans(offset, limit);
        uint256 expected = offset >= 3 ? 0 : (3 - offset < limit ? 3 - offset : limit);
        assertEq(page.length, expected);
        for (uint256 i; i < page.length; ++i) {
            assertEq(page[i], t.fans(offset + i));
        }
    }
}
