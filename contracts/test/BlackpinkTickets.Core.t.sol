// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import {IERC721Errors} from "@openzeppelin/contracts/interfaces/draft-IERC6093.sol";
import {BlackpinkTestBase, MockUSDC} from "./BlackpinkTickets.Base.t.sol";
import {BlackpinkTickets} from "../BlackpinkTickets.sol";

contract BlackpinkTicketsCoreTest is BlackpinkTestBase {
    // ---------------------------------------------------------------- deploy
    function test_Deploy_State() public view {
        assertEq(address(t.usdc()), address(usdc));
        assertEq(t.owner(), owner);
        assertEq(t.pendingOwner(), address(0));
        assertTrue(t.showOpen(0));
        assertTrue(t.showOpen(1));
        assertFalse(t.paused());
        assertEq(t.fanCount(), 0);
        assertEq(t.name(), "BLACKPINK BORN PINK ENCORE Ticket");
        assertEq(t.symbol(), "BPTIX");
    }

    function test_Deploy_EmitsShowOpenSet() public {
        vm.expectEmit(true, false, false, true);
        emit BlackpinkTickets.ShowOpenSet(0, true);
        vm.expectEmit(true, false, false, true);
        emit BlackpinkTickets.ShowOpenSet(1, true);
        new BlackpinkTickets(address(usdc), owner);
    }

    function test_Deploy_RevertsZeroUsdc() public {
        vm.expectRevert(BlackpinkTickets.ZeroAddress.selector);
        new BlackpinkTickets(address(0), owner);
    }

    function test_Deploy_RevertsZeroOwner() public {
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableInvalidOwner.selector, address(0)));
        new BlackpinkTickets(address(usdc), address(0));
    }

    // ------------------------------------------------------- pure helpers
    function test_TierOf_Boundaries() public view {
        assertEq(t.tierOf(0), 0);
        assertEq(t.tierOf(239), 0);
        assertEq(t.tierOf(240), 1);
        assertEq(t.tierOf(319), 1);
        assertEq(t.tierOf(320), 2);
        assertEq(t.tierOf(343), 2);
    }

    function test_TierOf_RevertsInvalidSeat() public {
        vm.expectRevert(abi.encodeWithSelector(BlackpinkTickets.InvalidSeat.selector, uint16(344)));
        t.tierOf(344);
    }

    function test_PriceAndPoints() public {
        assertEq(t.priceOf(0), 10e6);
        assertEq(t.priceOf(1), 25e6);
        assertEq(t.priceOf(2), 100e6);
        assertEq(t.pointsOf(0), 10);
        assertEq(t.pointsOf(1), 50);
        assertEq(t.pointsOf(2), 500);
        vm.expectRevert(abi.encodeWithSelector(BlackpinkTickets.InvalidTier.selector, uint8(3)));
        t.priceOf(3);
        vm.expectRevert(abi.encodeWithSelector(BlackpinkTickets.InvalidTier.selector, uint8(3)));
        t.pointsOf(3);
    }

    function test_TokenIdOf_And_Decode() public {
        assertEq(t.tokenIdOf(0, 0), 1000);
        assertEq(t.tokenIdOf(1, 343), 2343);
        (uint8 s, uint16 seat) = t.decodeTokenId(2343);
        assertEq(s, 1);
        assertEq(seat, 343);
        vm.expectRevert(abi.encodeWithSelector(BlackpinkTickets.InvalidShow.selector, uint8(2)));
        t.tokenIdOf(2, 0);
        vm.expectRevert(abi.encodeWithSelector(BlackpinkTickets.InvalidSeat.selector, uint16(344)));
        t.tokenIdOf(0, 344);
    }

    function test_DecodeTokenId_RevertsInvalid() public {
        uint256[4] memory bad = [uint256(0), 999, 1344, 3000];
        for (uint256 i; i < bad.length; ++i) {
            vm.expectRevert(abi.encodeWithSelector(BlackpinkTickets.InvalidTokenId.selector, bad[i]));
            t.decodeTokenId(bad[i]);
        }
    }

    // ------------------------------------------------------------- buyTickets
    function test_Buy_SingleStanding() public {
        _buy(alice, 0, 5);
        uint256 id = _tid(0, 5);
        assertEq(t.ownerOf(id), alice);
        assertEq(usdc.balanceOf(address(t)), 10e6);
        assertEq(usdc.balanceOf(alice), FUNDS - 10e6);
        assertEq(t.ticketsHeld(0, alice), 1);
        assertEq(t.ticketsHeld(1, alice), 0);
    }

    function test_Buy_EmitsEvents() public {
        uint256 id = _tid(0, 250);
        vm.expectEmit(true, true, true, true, address(t));
        emit IERC721.Transfer(address(0), alice, id);
        vm.expectEmit(true, false, false, true, address(t));
        emit BlackpinkTickets.FanRegistered(alice);
        vm.expectEmit(true, false, false, true, address(t));
        emit BlackpinkTickets.FanRewardsGranted(alice, 50, 1, 0);
        vm.expectEmit(true, true, false, true, address(t));
        emit BlackpinkTickets.TicketPurchased(alice, 0, 250, id, 1, 25e6);
        _buy(alice, 0, 250);
    }

    function test_Buy_MixedTiersTotalAndRewards() public {
        uint16[] memory seats = new uint16[](3);
        seats[0] = 1; // standing 10
        seats[1] = 250; // vip 25
        seats[2] = 330; // vvip 100
        vm.prank(alice);
        t.buyTickets(1, seats);
        assertEq(usdc.balanceOf(address(t)), 135e6);
        assertEq(t.fanPoints(alice), 10 + 50 + 500);
        assertEq(t.vipTickets(alice), 2);
        assertEq(t.ticketsHeld(1, alice), 3);
        assertEq(t.fanCount(), 1);
    }

    function test_Buy_FanPoints_10_50_500() public {
        _buy(alice, 0, 0);
        assertEq(t.fanPoints(alice), 10);
        _buy(alice, 0, 240);
        assertEq(t.fanPoints(alice), 60);
        _buy(alice, 0, 320);
        assertEq(t.fanPoints(alice), 560);
        assertEq(t.vipTickets(alice), 2);
        assertEq(t.lightsticks(alice), 1); // contract grants one lightstick per standing ticket
    }

    function test_Buy_SoldBitmapWordsAndBits() public {
        _buy(alice, 0, 0);
        _buy(alice, 0, 255);
        _buy(alice, 0, 256);
        _buy(alice, 0, 343);
        uint256[2] memory bm = t.getSoldBitmap(0);
        assertEq(bm[0], uint256(1) | (uint256(1) << 255));
        assertEq(bm[1], uint256(1) | (uint256(1) << 87));
        uint256[2] memory other = t.getSoldBitmap(1);
        assertEq(other[0], 0);
        assertEq(other[1], 0);
    }

    function test_GetSoldBitmap_RevertsInvalidShow() public {
        vm.expectRevert(abi.encodeWithSelector(BlackpinkTickets.InvalidShow.selector, uint8(2)));
        t.getSoldBitmap(2);
    }

    function test_Buy_SixAllowedSeventhReverts() public {
        _buyRange(alice, 0, 0, 6);
        assertEq(t.ticketsHeld(0, alice), 6);
        vm.expectRevert(abi.encodeWithSelector(BlackpinkTickets.WalletCapExceeded.selector, uint8(0), alice));
        vm.prank(alice);
        t.buyTickets(0, _one(100));
        // other show still fine
        _buy(alice, 1, 0);
        assertEq(t.ticketsHeld(1, alice), 1);
    }

    function test_Buy_RevertsQuantityZeroAndSeven() public {
        uint16[] memory none = new uint16[](0);
        vm.expectRevert(abi.encodeWithSelector(BlackpinkTickets.InvalidTicketQuantity.selector, uint256(0)));
        vm.prank(alice);
        t.buyTickets(0, none);
        uint16[] memory seven = new uint16[](7);
        for (uint16 i; i < 7; ++i) seven[i] = i;
        vm.expectRevert(abi.encodeWithSelector(BlackpinkTickets.InvalidTicketQuantity.selector, uint256(7)));
        vm.prank(alice);
        t.buyTickets(0, seven);
    }

    function test_Buy_RevertsSeatTaken() public {
        _buy(alice, 0, 7);
        vm.expectRevert(abi.encodeWithSelector(BlackpinkTickets.SeatTaken.selector, uint8(0), uint16(7)));
        vm.prank(bob);
        t.buyTickets(0, _one(7));
        _buy(bob, 1, 7); // same seat, other show is fine
    }

    function test_Buy_RevertsDuplicateSeatInOnePurchase() public {
        uint16[] memory d = new uint16[](2);
        d[0] = 5;
        d[1] = 5;
        vm.expectRevert(abi.encodeWithSelector(BlackpinkTickets.DuplicateSeat.selector, uint16(5)));
        vm.prank(alice);
        t.buyTickets(0, d);
        // duplicate in the second bitmap word, non-adjacent
        uint16[] memory e = new uint16[](3);
        e[0] = 300;
        e[1] = 2;
        e[2] = 300;
        vm.expectRevert(abi.encodeWithSelector(BlackpinkTickets.DuplicateSeat.selector, uint16(300)));
        vm.prank(alice);
        t.buyTickets(0, e);
        assertEq(usdc.balanceOf(address(t)), 0);
    }

    function test_Buy_RevertsInvalidSeatAndShow() public {
        vm.expectRevert(abi.encodeWithSelector(BlackpinkTickets.InvalidSeat.selector, uint16(344)));
        vm.prank(alice);
        t.buyTickets(0, _one(344));
        vm.expectRevert(abi.encodeWithSelector(BlackpinkTickets.InvalidShow.selector, uint8(2)));
        vm.prank(alice);
        t.buyTickets(2, _one(0));
    }

    function test_Buy_RevertsShowClosed_ReopenWorks() public {
        vm.prank(owner);
        t.setShowOpen(0, false);
        vm.expectRevert(abi.encodeWithSelector(BlackpinkTickets.ShowClosed.selector, uint8(0)));
        vm.prank(alice);
        t.buyTickets(0, _one(1));
        _buy(alice, 1, 1); // other show unaffected
        vm.prank(owner);
        t.setShowOpen(0, true);
        _buy(alice, 0, 1);
        assertEq(t.ownerOf(_tid(0, 1)), alice);
    }

    function test_Buy_RevertsWithoutAllowance() public {
        address dave = makeAddr("dave");
        usdc.mint(dave, 100e6);
        vm.expectRevert(bytes("allowance"));
        vm.prank(dave);
        t.buyTickets(0, _one(1));
    }

    function test_Buy_RevertsWhenPaused() public {
        vm.prank(owner);
        t.pause();
        vm.expectRevert(Pausable.EnforcedPause.selector);
        vm.prank(alice);
        t.buyTickets(0, _one(1));
    }

    // ------------------------------------------------------------ lightstick
    function test_Lightstick_HappyAndEvents() public {
        vm.expectEmit(true, false, false, true, address(t));
        emit BlackpinkTickets.FanRewardsGranted(alice, 75, 0, 3);
        vm.expectEmit(true, false, false, true, address(t));
        emit BlackpinkTickets.LightstickBought(alice, 3, 15e6);
        vm.prank(alice);
        t.buyLightstick(3);
        assertEq(usdc.balanceOf(address(t)), 15e6);
        assertEq(t.fanPoints(alice), 75);
        assertEq(t.lightsticks(alice), 3);
        assertEq(t.fanCount(), 1);
    }

    function test_Lightstick_RevertsBadQuantity() public {
        vm.expectRevert(abi.encodeWithSelector(BlackpinkTickets.InvalidLightstickQuantity.selector, uint256(0)));
        vm.prank(alice);
        t.buyLightstick(0);
        vm.expectRevert(abi.encodeWithSelector(BlackpinkTickets.InvalidLightstickQuantity.selector, uint256(11)));
        vm.prank(alice);
        t.buyLightstick(11);
        vm.prank(alice);
        t.buyLightstick(10); // max OK
        assertEq(t.lightsticks(alice), 10);
    }

    function test_Lightstick_RevertsWhenPaused() public {
        vm.prank(owner);
        t.pause();
        vm.expectRevert(Pausable.EnforcedPause.selector);
        vm.prank(alice);
        t.buyLightstick(1);
    }

    // --------------------------------------------------------- fan registry
    function test_Fans_RegisteredOnceInFirstEarnedOrder() public {
        _buy(bob, 0, 1);
        _buy(alice, 0, 2);
        _buy(bob, 0, 3); // no duplicate registration
        vm.prank(carol);
        t.buyLightstick(1);
        assertEq(t.fanCount(), 3);
        address[] memory all = t.getFans(0, 10);
        assertEq(all.length, 3);
        assertEq(all[0], bob);
        assertEq(all[1], alice);
        assertEq(all[2], carol);
        assertTrue(t.seen(bob));
        assertEq(t.fans(1), alice);
    }

    function test_GetFans_PaginationClamping() public {
        _buy(alice, 0, 1);
        _buy(bob, 0, 2);
        _buy(carol, 0, 3);
        address[] memory p = t.getFans(1, 1);
        assertEq(p.length, 1);
        assertEq(p[0], bob);
        p = t.getFans(2, 100); // clamps to remaining
        assertEq(p.length, 1);
        assertEq(p[0], carol);
        assertEq(t.getFans(3, 5).length, 0); // offset == length
        assertEq(t.getFans(99, 5).length, 0); // offset > length
        assertEq(t.getFans(0, 0).length, 0); // zero limit
        assertEq(t.getFans(0, 3).length, 3);
    }

    // ----------------------------------------------------------------- admin
    function test_Pause_OnlyOwner() public {
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, alice));
        vm.prank(alice);
        t.pause();
        vm.prank(owner);
        t.pause();
        assertTrue(t.paused());
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, alice));
        vm.prank(alice);
        t.unpause();
        vm.prank(owner);
        t.unpause();
        assertFalse(t.paused());
    }

    function test_SetShowOpen_EventAccessInvalid() public {
        vm.expectEmit(true, false, false, true, address(t));
        emit BlackpinkTickets.ShowOpenSet(1, false);
        vm.prank(owner);
        t.setShowOpen(1, false);
        assertFalse(t.showOpen(1));
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, alice));
        vm.prank(alice);
        t.setShowOpen(1, true);
        vm.expectRevert(abi.encodeWithSelector(BlackpinkTickets.InvalidShow.selector, uint8(2)));
        vm.prank(owner);
        t.setShowOpen(2, true);
    }

    function test_WithdrawRevenue_HappyAndEvent() public {
        _buy(alice, 0, 250);
        address treasury = makeAddr("treasury");
        vm.expectEmit(true, false, false, true, address(t));
        emit BlackpinkTickets.RevenueWithdrawn(treasury, 25e6);
        vm.prank(owner);
        t.withdrawRevenue(treasury);
        assertEq(usdc.balanceOf(treasury), 25e6);
        assertEq(usdc.balanceOf(address(t)), 0);
    }

    function test_WithdrawRevenue_EmptyBalanceOk() public {
        vm.prank(owner);
        t.withdrawRevenue(bob);
        assertEq(usdc.balanceOf(bob), FUNDS);
    }

    function test_WithdrawRevenue_Reverts() public {
        vm.expectRevert(BlackpinkTickets.ZeroAddress.selector);
        vm.prank(owner);
        t.withdrawRevenue(address(0));
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, alice));
        vm.prank(alice);
        t.withdrawRevenue(alice);
    }

    function test_WithdrawRevenue_WorksWhilePaused() public {
        _buy(alice, 0, 1);
        vm.prank(owner);
        t.pause();
        vm.prank(owner);
        t.withdrawRevenue(owner);
        assertEq(usdc.balanceOf(owner), 10e6);
    }

    // ------------------------------------------------------------ ownership
    function test_Ownable2Step_TransferAndAccept() public {
        vm.expectEmit(true, true, false, false, address(t));
        emit Ownable2Step.OwnershipTransferStarted(owner, alice);
        vm.prank(owner);
        t.transferOwnership(alice);
        assertEq(t.owner(), owner);
        assertEq(t.pendingOwner(), alice);

        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, bob));
        vm.prank(bob);
        t.acceptOwnership();

        vm.expectEmit(true, true, false, false, address(t));
        emit Ownable.OwnershipTransferred(owner, alice);
        vm.prank(alice);
        t.acceptOwnership();
        assertEq(t.owner(), alice);
        assertEq(t.pendingOwner(), address(0));

        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, owner));
        vm.prank(owner);
        t.pause();
    }

    function test_Ownable2Step_TransferOnlyOwner() public {
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, alice));
        vm.prank(alice);
        t.transferOwnership(alice);
    }

    function test_RenounceOwnership_AlwaysReverts() public {
        vm.expectRevert(BlackpinkTickets.OwnershipRenunciationDisabled.selector);
        vm.prank(owner);
        t.renounceOwnership();
        assertEq(t.owner(), owner);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, alice));
        vm.prank(alice);
        t.renounceOwnership();
    }

    // -------------------------------------------------------------- tokenURI
    function test_TokenURI_Nonexistent() public {
        vm.expectRevert(abi.encodeWithSelector(IERC721Errors.ERC721NonexistentToken.selector, uint256(1000)));
        t.tokenURI(1000);
    }

    function test_TokenURI_DecodesToExpectedJson() public {
        _buy(alice, 1, 330);
        string memory uri = t.tokenURI(_tid(1, 330));
        bytes memory u = bytes(uri);
        bytes memory prefix = bytes("data:application/json;base64,");
        for (uint256 i; i < prefix.length; ++i) {
            assertEq(u[i], prefix[i]);
        }
        bytes memory b64 = new bytes(u.length - prefix.length);
        for (uint256 i; i < b64.length; ++i) {
            b64[i] = u[i + prefix.length];
        }
        string memory json = string(_decode(b64));
        assertEq(
            json,
            '{"name":"BLACKPINK BORN PINK ENCORE - Day 2 - Seat 330","description":"Seat ticket for BLACKPINK WORLD TOUR - BORN PINK ENCORE.","attributes":[{"trait_type":"Show","value":2},{"trait_type":"Seat","value":330},{"trait_type":"Tier","value":"VVIP Born Pink Skybox"}]}'
        );
        // also valid JSON with parsed fields
        assertEq(vm.parseJsonUint(json, ".attributes[0].value"), 2);
        assertEq(vm.parseJsonUint(json, ".attributes[1].value"), 330);
        assertEq(vm.parseJsonString(json, ".attributes[2].value"), "VVIP Born Pink Skybox");
    }

    function test_TokenURI_TierNames() public {
        _buy(alice, 0, 0);
        _buy(alice, 0, 240);
        assertEq(vm.parseJsonString(string(_payload(0, 0)), ".attributes[2].value"), "Standing / CAT1");
        assertEq(vm.parseJsonString(string(_payload(0, 240)), ".attributes[2].value"), "VIP Pink Pit");
    }

    function _payload(uint8 show, uint16 seat) internal view returns (bytes memory) {
        bytes memory u = bytes(t.tokenURI(_tid(show, seat)));
        bytes memory b64 = new bytes(u.length - 29);
        for (uint256 i; i < b64.length; ++i) {
            b64[i] = u[i + 29];
        }
        return _decode(b64);
    }

    function _decode(bytes memory data) internal pure returns (bytes memory out) {
        uint256 len = data.length;
        uint256 pad = data[len - 1] == "=" ? (data[len - 2] == "=" ? 2 : 1) : 0;
        out = new bytes(len / 4 * 3 - pad);
        uint256 o;
        for (uint256 i; i < len; i += 4) {
            uint256 n = (_v(data[i]) << 18) | (_v(data[i + 1]) << 12) | (_v(data[i + 2]) << 6) | _v(data[i + 3]);
            if (o < out.length) out[o++] = bytes1(uint8(n >> 16));
            if (o < out.length) out[o++] = bytes1(uint8(n >> 8));
            if (o < out.length) out[o++] = bytes1(uint8(n));
        }
    }

    function _v(bytes1 c) internal pure returns (uint256) {
        uint8 b = uint8(c);
        if (b >= 65 && b <= 90) return b - 65;
        if (b >= 97 && b <= 122) return b - 71;
        if (b >= 48 && b <= 57) return b + 4;
        if (b == 43) return 62;
        if (b == 47) return 63;
        return 0;
    }
}
