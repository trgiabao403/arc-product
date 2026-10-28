// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import {IERC721Errors} from "@openzeppelin/contracts/interfaces/draft-IERC6093.sol";
import {BlackpinkTestBase} from "./BlackpinkTickets.Base.t.sol";
import {BlackpinkTickets} from "../BlackpinkTickets.sol";

contract BlackpinkTicketsMarketTest is BlackpinkTestBase {
    uint256 internal id; // alice's standing seat 0 / show 0

    function setUp() public override {
        super.setUp();
        _buy(alice, 0, 0);
        id = _tid(0, 0);
    }

    // ----------------------------------------------------------------- list
    function test_List_HappyAndEvent() public {
        vm.expectEmit(true, true, false, true, address(t));
        emit BlackpinkTickets.Listed(id, alice, 20e6);
        vm.prank(alice);
        t.listForSale(id, 20e6);
        BlackpinkTickets.Listing memory l = t.getListing(id);
        assertEq(l.seller, alice);
        assertEq(l.price, 20e6);
        assertEq(t.ownerOf(id), alice); // no escrow
    }

    function test_List_Reverts() public {
        vm.expectRevert(abi.encodeWithSelector(BlackpinkTickets.NotTicketOwner.selector, id, bob));
        vm.prank(bob);
        t.listForSale(id, 1);
        vm.expectRevert(BlackpinkTickets.InvalidListingPrice.selector);
        vm.prank(alice);
        t.listForSale(id, 0);
        vm.expectRevert(abi.encodeWithSelector(IERC721Errors.ERC721NonexistentToken.selector, uint256(1001)));
        vm.prank(alice);
        t.listForSale(1001, 1);
    }

    function test_List_ReplacedByRelisting() public {
        vm.prank(alice);
        t.listForSale(id, 20e6);
        vm.expectEmit(true, true, false, false, address(t));
        emit BlackpinkTickets.ListingCancelled(id, alice);
        vm.expectEmit(true, true, false, true, address(t));
        emit BlackpinkTickets.Listed(id, alice, 30e6);
        vm.prank(alice);
        t.listForSale(id, 30e6);
        assertEq(t.getListing(id).price, 30e6);
        // old price no longer valid for a buyer capping at 20
        vm.expectRevert(abi.encodeWithSelector(BlackpinkTickets.PriceTooHigh.selector, 30e6, 20e6));
        vm.prank(bob);
        t.buyListed(id, 20e6);
    }

    function test_List_AllowedWhilePausedAndShowClosed() public {
        vm.startPrank(owner);
        t.pause();
        t.setShowOpen(0, false);
        vm.stopPrank();
        vm.prank(alice);
        t.listForSale(id, 5e6);
        assertEq(t.getListing(id).price, 5e6);
    }

    // --------------------------------------------------------------- cancel
    function test_Cancel_BySellerEmitsEvent() public {
        vm.prank(alice);
        t.listForSale(id, 5e6);
        vm.expectEmit(true, true, false, false, address(t));
        emit BlackpinkTickets.ListingCancelled(id, alice);
        vm.prank(alice);
        t.cancelListing(id);
        assertEq(t.getListing(id).seller, address(0));
    }

    function test_Cancel_Reverts() public {
        vm.expectRevert(abi.encodeWithSelector(BlackpinkTickets.ListingNotFound.selector, id));
        vm.prank(alice);
        t.cancelListing(id);
        vm.prank(alice);
        t.listForSale(id, 5e6);
        vm.expectRevert(abi.encodeWithSelector(BlackpinkTickets.NotListingSellerOrOwner.selector, id, bob));
        vm.prank(bob);
        t.cancelListing(id);
    }

    function test_Cancel_WorksWhilePaused() public {
        vm.prank(alice);
        t.listForSale(id, 5e6);
        vm.prank(owner);
        t.pause();
        vm.prank(alice);
        t.cancelListing(id);
        assertEq(t.getListing(id).price, 0);
    }

    // ------------------------------------------------------------ buyListed
    function test_BuyListed_FeeSplitAndOwnershipMove() public {
        vm.prank(alice);
        t.listForSale(id, 200e6);
        uint256 aliceBefore = usdc.balanceOf(alice);
        uint256 contractBefore = usdc.balanceOf(address(t));
        vm.expectEmit(true, true, true, true, address(t));
        emit BlackpinkTickets.ListedSold(id, alice, bob, 200e6, 10e6);
        vm.prank(bob);
        t.buyListed(id, 200e6);
        assertEq(t.ownerOf(id), bob);
        assertEq(usdc.balanceOf(alice), aliceBefore + 190e6);
        assertEq(usdc.balanceOf(address(t)), contractBefore + 10e6);
        assertEq(usdc.balanceOf(bob), FUNDS - 200e6);
        assertEq(t.ticketsHeld(0, alice), 0);
        assertEq(t.ticketsHeld(0, bob), 1);
        assertEq(t.getListing(id).seller, address(0));
        // resale buyers earn no rewards
        assertEq(t.fanPoints(bob), 0);
        assertFalse(t.seen(bob));
    }

    function test_BuyListed_FeeRoundsDown() public {
        vm.prank(alice);
        t.listForSale(id, 19);
        uint256 contractBefore = usdc.balanceOf(address(t));
        vm.prank(bob);
        t.buyListed(id, 19);
        assertEq(usdc.balanceOf(address(t)), contractBefore); // fee 0
        // relist at 39 -> fee 1
        vm.prank(bob);
        t.listForSale(id, 39);
        vm.prank(carol);
        t.buyListed(id, 39);
        assertEq(usdc.balanceOf(address(t)), contractBefore + 1);
    }

    function test_BuyListed_MaxPriceGuard() public {
        vm.prank(alice);
        t.listForSale(id, 50e6);
        vm.expectRevert(abi.encodeWithSelector(BlackpinkTickets.PriceTooHigh.selector, 50e6, 50e6 - 1));
        vm.prank(bob);
        t.buyListed(id, 50e6 - 1);
        assertEq(t.ownerOf(id), alice);
        assertEq(usdc.balanceOf(bob), FUNDS);
        // exact cap succeeds
        vm.prank(bob);
        t.buyListed(id, 50e6);
        assertEq(t.ownerOf(id), bob);
        // higher cap than price also fine; pays listed price only
    }

    function test_BuyListed_PayingOnlyListedPriceWhenMaxHigher() public {
        vm.prank(alice);
        t.listForSale(id, 40e6);
        vm.prank(bob);
        t.buyListed(id, type(uint256).max);
        assertEq(usdc.balanceOf(bob), FUNDS - 40e6);
    }

    function test_BuyListed_Reverts() public {
        vm.expectRevert(abi.encodeWithSelector(BlackpinkTickets.ListingNotFound.selector, id));
        vm.prank(bob);
        t.buyListed(id, 100e6);
        vm.prank(alice);
        t.listForSale(id, 5e6);
        vm.expectRevert(BlackpinkTickets.CannotBuyOwnListing.selector);
        vm.prank(alice);
        t.buyListed(id, 5e6);
    }

    function test_BuyListed_RevertsWhenPaused() public {
        vm.prank(alice);
        t.listForSale(id, 5e6);
        vm.prank(owner);
        t.pause();
        vm.expectRevert(Pausable.EnforcedPause.selector);
        vm.prank(bob);
        t.buyListed(id, 5e6);
    }

    function test_BuyListed_AllowedWhenShowClosed() public {
        vm.prank(alice);
        t.listForSale(id, 5e6);
        vm.prank(owner);
        t.setShowOpen(0, false);
        vm.prank(bob);
        t.buyListed(id, 5e6);
        assertEq(t.ownerOf(id), bob);
    }

    function test_BuyListed_RevertsWhenBuyerAtCap_AtomicRollback() public {
        _buyRange(bob, 0, 10, 6);
        vm.prank(alice);
        t.listForSale(id, 20e6);
        uint256 bobBal = usdc.balanceOf(bob);
        vm.expectRevert(abi.encodeWithSelector(BlackpinkTickets.WalletCapExceeded.selector, uint8(0), bob));
        vm.prank(bob);
        t.buyListed(id, 20e6);
        assertEq(usdc.balanceOf(bob), bobBal);
        assertEq(t.ownerOf(id), alice);
        assertEq(t.getListing(id).price, 20e6);
        assertEq(t.ticketsHeld(0, bob), 6);
    }

    // --------------------------------------------- stale listing / transfers
    function test_PlainTransfer_ClearsListing_BuyListedReverts() public {
        vm.prank(alice);
        t.listForSale(id, 5e6);
        vm.expectEmit(true, true, false, false, address(t));
        emit BlackpinkTickets.ListingCancelled(id, alice);
        vm.prank(alice);
        t.transferFrom(alice, carol, id);
        assertEq(t.getListing(id).seller, address(0));
        assertEq(t.ticketsHeld(0, alice), 0);
        assertEq(t.ticketsHeld(0, carol), 1);
        // The StaleListing branch is shadowed because _update already cancels the listing.
        vm.expectRevert(abi.encodeWithSelector(BlackpinkTickets.ListingNotFound.selector, id));
        vm.prank(bob);
        t.buyListed(id, 5e6);
    }

    function test_PlainTransferBackToSeller_DoesNotRevive_Listing() public {
        vm.prank(alice);
        t.listForSale(id, 5e6);
        vm.prank(alice);
        t.transferFrom(alice, carol, id);
        vm.prank(carol);
        t.transferFrom(carol, alice, id);
        vm.expectRevert(abi.encodeWithSelector(BlackpinkTickets.ListingNotFound.selector, id));
        vm.prank(bob);
        t.buyListed(id, 5e6);
    }

    function test_Transfers_WorkWhilePaused() public {
        vm.prank(owner);
        t.pause();
        vm.prank(alice);
        t.transferFrom(alice, bob, id);
        assertEq(t.ownerOf(id), bob);
        vm.prank(bob);
        t.approve(carol, id);
        vm.prank(carol);
        t.transferFrom(bob, carol, id);
        assertEq(t.ownerOf(id), carol);
    }

    function test_PlainTransfer_RevertsWhenRecipientAtCap() public {
        _buyRange(bob, 0, 10, 6);
        vm.expectRevert(abi.encodeWithSelector(BlackpinkTickets.WalletCapExceeded.selector, uint8(0), bob));
        vm.prank(alice);
        t.transferFrom(alice, bob, id);
        assertEq(t.ownerOf(id), alice);
        // different show doesn't count toward cap
        _buy(alice, 1, 0);
        vm.prank(alice);
        t.transferFrom(alice, bob, _tid(1, 0));
        assertEq(t.ticketsHeld(1, bob), 1);
    }

    function test_PlainTransfer_CapCountsTransferredTicketsInBuy() public {
        _buyRange(bob, 0, 10, 5);
        vm.prank(alice);
        t.transferFrom(alice, bob, id); // bob now holds 6
        vm.expectRevert(abi.encodeWithSelector(BlackpinkTickets.WalletCapExceeded.selector, uint8(0), bob));
        vm.prank(bob);
        t.buyTickets(0, _one(200));
    }

    // -------------------------------------------------------------- upgrade
    function test_Upgrade_StandingToVip() public {
        uint256 newId = _tid(0, 250);
        uint256 bal = usdc.balanceOf(alice);
        vm.expectEmit(true, true, true, true, address(t));
        emit BlackpinkTickets.SeatUpgraded(alice, id, newId, 1, 15e6);
        vm.prank(alice);
        t.upgradeSeat(id, 250);
        assertEq(usdc.balanceOf(alice), bal - 15e6);
        assertEq(t.ownerOf(newId), alice);
        vm.expectRevert(abi.encodeWithSelector(IERC721Errors.ERC721NonexistentToken.selector, id));
        t.ownerOf(id);
        assertEq(t.ticketsHeld(0, alice), 1);
        // points: 10 (standing) + 40 diff
        assertEq(t.fanPoints(alice), 50);
        assertEq(t.vipTickets(alice), 1);
        assertEq(t.lightsticks(alice), 1); // unchanged by upgrade
        // bitmap: seat 0 cleared, seat 250 set
        uint256[2] memory bm = t.getSoldBitmap(0);
        assertEq(bm[0], uint256(1) << 250);
        assertEq(bm[1], 0);
    }

    function test_Upgrade_VipToVvip_NoExtraVipCount() public {
        _buy(bob, 0, 241);
        vm.prank(bob);
        t.upgradeSeat(_tid(0, 241), 330);
        assertEq(usdc.balanceOf(address(t)), 10e6 + 25e6 + 75e6);
        assertEq(t.fanPoints(bob), 50 + 450);
        assertEq(t.vipTickets(bob), 1); // from the primary VIP; none added by upgrade from tier 1
    }

    function test_Upgrade_StandingToVvipPaysDifference() public {
        uint256 before_ = usdc.balanceOf(address(t));
        vm.prank(alice);
        t.upgradeSeat(id, 340);
        assertEq(usdc.balanceOf(address(t)), before_ + 90e6);
    }

    function test_Upgrade_ReleasesOldSeatForOthers() public {
        vm.prank(alice);
        t.upgradeSeat(id, 250);
        _buy(bob, 0, 0);
        assertEq(t.ownerOf(id), bob);
    }

    function test_Upgrade_CancelsOldListing() public {
        vm.prank(alice);
        t.listForSale(id, 5e6);
        vm.expectEmit(true, true, false, false, address(t));
        emit BlackpinkTickets.ListingCancelled(id, alice);
        vm.prank(alice);
        t.upgradeSeat(id, 250);
        assertEq(t.getListing(id).seller, address(0));
        // seat re-minted by someone else must not inherit the old listing
        _buy(bob, 0, 0);
        vm.expectRevert(abi.encodeWithSelector(BlackpinkTickets.ListingNotFound.selector, id));
        vm.prank(carol);
        t.buyListed(id, type(uint256).max);
    }

    function test_Upgrade_AtCapWithSixHeld() public {
        _buyRange(bob, 0, 20, 6);
        assertEq(t.ticketsHeld(0, bob), 6);
        vm.prank(bob);
        t.upgradeSeat(_tid(0, 20), 321);
        assertEq(t.ticketsHeld(0, bob), 6);
        assertEq(t.ownerOf(_tid(0, 321)), bob);
        // still capped for further buys
        vm.expectRevert(abi.encodeWithSelector(BlackpinkTickets.WalletCapExceeded.selector, uint8(0), bob));
        vm.prank(bob);
        t.buyTickets(0, _one(100));
    }

    function test_Upgrade_Reverts() public {
        vm.expectRevert(abi.encodeWithSelector(BlackpinkTickets.NotTicketOwner.selector, id, bob));
        vm.prank(bob);
        t.upgradeSeat(id, 250);
        vm.expectRevert(abi.encodeWithSelector(BlackpinkTickets.HigherTierRequired.selector, uint8(0), uint8(0)));
        vm.prank(alice);
        t.upgradeSeat(id, 5);
        vm.expectRevert(abi.encodeWithSelector(BlackpinkTickets.InvalidSeat.selector, uint16(344)));
        vm.prank(alice);
        t.upgradeSeat(id, 344);
        // downgrade
        _buy(bob, 0, 250);
        vm.expectRevert(abi.encodeWithSelector(BlackpinkTickets.HigherTierRequired.selector, uint8(1), uint8(0)));
        vm.prank(bob);
        t.upgradeSeat(_tid(0, 250), 3);
        // seat taken
        _buy(carol, 0, 251);
        vm.expectRevert(abi.encodeWithSelector(BlackpinkTickets.SeatTaken.selector, uint8(0), uint16(251)));
        vm.prank(alice);
        t.upgradeSeat(id, 251);
        // unknown token
        vm.expectRevert(abi.encodeWithSelector(IERC721Errors.ERC721NonexistentToken.selector, uint256(1100)));
        vm.prank(alice);
        t.upgradeSeat(1100, 250);
    }

    function test_Upgrade_RevertsWhenShowClosedOrPaused() public {
        vm.prank(owner);
        t.setShowOpen(0, false);
        vm.expectRevert(abi.encodeWithSelector(BlackpinkTickets.ShowClosed.selector, uint8(0)));
        vm.prank(alice);
        t.upgradeSeat(id, 250);
        vm.startPrank(owner);
        t.setShowOpen(0, true);
        t.pause();
        vm.stopPrank();
        vm.expectRevert(Pausable.EnforcedPause.selector);
        vm.prank(alice);
        t.upgradeSeat(id, 250);
    }

    function test_Upgrade_AfterResaleBuyerCanUpgrade() public {
        vm.prank(alice);
        t.listForSale(id, 5e6);
        vm.prank(bob);
        t.buyListed(id, 5e6);
        vm.prank(bob);
        t.upgradeSeat(id, 250);
        assertEq(t.fanPoints(bob), 40);
        assertEq(t.vipTickets(bob), 1);
    }
}
