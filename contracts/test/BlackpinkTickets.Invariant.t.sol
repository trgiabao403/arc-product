// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test, console2} from "forge-std/Test.sol";
import {BlackpinkTestBase, MockUSDC} from "./BlackpinkTickets.Base.t.sol";
import {BlackpinkTickets} from "../BlackpinkTickets.sol";

/// @dev Drives bounded random actions over a small seat pool (16 seats per show) so
///      conflicts, resales, upgrades and the 6-ticket wallet cap are all exercised often.
contract BlackpinkHandler is Test {
    BlackpinkTickets public t;
    MockUSDC public usdc;
    address public admin;
    address public treasury = address(0xBEEF);
    address[] public actors;

    uint256 public ghostPaidIn;
    uint256 public ghostWithdrawn;
    mapping(bytes32 => uint256) public ok; // successful call counters

    constructor(BlackpinkTickets t_, MockUSDC usdc_, address admin_, address[] memory actors_) {
        t = t_;
        usdc = usdc_;
        admin = admin_;
        actors = actors_;
    }

    function actorCount() external view returns (uint256) {
        return actors.length;
    }

    // ----- helpers
    function poolSeat(uint256 i) public pure returns (uint16) {
        i = i % 16;
        if (i < 8) return uint16(i);
        if (i < 12) return uint16(240 + (i - 8));
        return uint16(320 + (i - 12));
    }

    function poolToken(uint256 idx) public pure returns (uint256) {
        idx = idx % 32;
        return (idx / 16 + 1) * 1000 + poolSeat(idx % 16);
    }

    function _actor(uint256 s) internal view returns (address) {
        return actors[s % actors.length];
    }

    function _findOwned(address who, uint256 seed) internal view returns (bool, uint256) {
        for (uint256 k; k < 32; ++k) {
            uint256 id = poolToken(seed + k);
            try t.ownerOf(id) returns (address o) {
                if (o == who) return (true, id);
            } catch {}
        }
        return (false, 0);
    }

    // ----- actions
    function buy(uint256 actorSeed, uint256 showSeed, uint256 qtySeed, uint256 seatSeed) external {
        address a = _actor(actorSeed);
        uint8 show = uint8(showSeed % 2);
        uint256 qty = 1 + (qtySeed % 4);
        uint16[] memory seats = new uint16[](qty);
        uint256 total;
        for (uint256 i; i < qty; ++i) {
            seats[i] = poolSeat(seatSeed + i);
            total += t.priceOf(t.tierOf(seats[i]));
        }
        vm.prank(a);
        try t.buyTickets(show, seats) {
            ghostPaidIn += total;
            ok["buy"]++;
        } catch {}
    }

    function lightstick(uint256 actorSeed, uint256 qtySeed) external {
        uint256 qty = 1 + (qtySeed % 10);
        vm.prank(_actor(actorSeed));
        try t.buyLightstick(qty) {
            ghostPaidIn += 5e6 * qty;
            ok["lightstick"]++;
        } catch {}
    }

    function list(uint256 actorSeed, uint256 tokenSeed, uint256 price) external {
        address a = _actor(actorSeed);
        (bool found, uint256 id) = _findOwned(a, tokenSeed);
        if (!found) return;
        vm.prank(a);
        try t.listForSale(id, bound(price, 1, 1e9)) {
            ok["list"]++;
        } catch {}
    }

    function buyListed(uint256 buyerSeed, uint256 tokenSeed) external {
        for (uint256 k; k < 32; ++k) {
            uint256 id = poolToken(tokenSeed + k);
            BlackpinkTickets.Listing memory l = t.getListing(id);
            if (l.seller == address(0)) continue;
            uint256 fee = (l.price * 500) / 10_000;
            vm.prank(_actor(buyerSeed));
            try t.buyListed(id, l.price) {
                ghostPaidIn += fee;
                ok["buyListed"]++;
            } catch {}
            return;
        }
    }

    function transfer(uint256 fromSeed, uint256 toSeed, uint256 tokenSeed) external {
        address from = _actor(fromSeed);
        address to = _actor(toSeed);
        (bool found, uint256 id) = _findOwned(from, tokenSeed);
        if (!found) return;
        vm.prank(from);
        try t.transferFrom(from, to, id) {
            ok["transfer"]++;
        } catch {}
    }

    function upgrade(uint256 actorSeed, uint256 tokenSeed, uint256 newSeatSeed) external {
        address a = _actor(actorSeed);
        (bool found, uint256 id) = _findOwned(a, tokenSeed);
        if (!found) return;
        uint16 newSeat = poolSeat(8 + (newSeatSeed % 8)); // bias to VIP/VVIP seats
        uint8 oldTier = t.tierOf(uint16(id % 1000));
        uint8 newTier = t.tierOf(newSeat);
        uint256 paid = newTier > oldTier ? t.priceOf(newTier) - t.priceOf(oldTier) : 0;
        vm.prank(a);
        try t.upgradeSeat(id, newSeat) {
            ghostPaidIn += paid;
            ok["upgrade"]++;
        } catch {}
    }

    function withdraw() external {
        uint256 amount = usdc.balanceOf(address(t));
        vm.prank(admin);
        try t.withdrawRevenue(treasury) {
            ghostWithdrawn += amount;
            ok["withdraw"]++;
        } catch {}
    }

    /// @dev Pause is rare (1 in 8) so that purchase paths stay well exercised.
    function togglePause(uint256 s) external {
        vm.startPrank(admin);
        if (s % 8 == 0 && !t.paused()) t.pause();
        else if (s % 8 != 0 && t.paused()) t.unpause();
        vm.stopPrank();
    }

    /// @dev Closing is rare (1 in 8); otherwise the show is (re)opened.
    function setShowOpen(uint256 showSeed, uint256 s) external {
        vm.prank(admin);
        t.setShowOpen(uint8(showSeed % 2), s % 8 != 0);
    }
}

/// forge-config: default.invariant.runs = 32
/// forge-config: default.invariant.depth = 200
contract BlackpinkTicketsInvariantTest is BlackpinkTestBase {
    BlackpinkHandler internal h;
    address[] internal actors;

    function setUp() public override {
        super.setUp();
        actors.push(alice);
        actors.push(bob);
        actors.push(carol);
        h = new BlackpinkHandler(t, usdc, owner, actors);
        targetContract(address(h));
    }

    function _exists(uint256 id) internal view returns (bool) {
        try t.ownerOf(id) returns (address) {
            return true;
        } catch {
            return false;
        }
    }

    /// PROPERTY: contract USDC balance == total paid in - total withdrawn.
    function invariant_UsdcBalanceEqualsPaidInMinusWithdrawn() public view {
        assertEq(usdc.balanceOf(address(t)), h.ghostPaidIn() - h.ghostWithdrawn());
    }

    /// PROPERTY: sold bitmap bit i set iff token for seat i currently exists.
    function invariant_SoldBitmapBitSetIffTokenExists() public view {
        for (uint8 show; show < 2; ++show) {
            uint256[2] memory expected;
            for (uint256 i; i < 16; ++i) {
                uint16 seat = h.poolSeat(i);
                if (_exists(t.tokenIdOf(show, seat))) {
                    expected[uint256(seat) >> 8] |= uint256(1) << (uint256(seat) & 255);
                }
            }
            uint256[2] memory actual = t.getSoldBitmap(show);
            assertEq(actual[0], expected[0], "bitmap word0");
            assertEq(actual[1], expected[1], "bitmap word1");
        }
    }

    /// PROPERTY: ticketsHeld never exceeds 6 and equals the number of tokens actually owned.
    function invariant_TicketsHeldNeverAboveSixAndMatchesOwnership() public view {
        for (uint256 a; a < actors.length; ++a) {
            uint256 totalOwned;
            for (uint8 show; show < 2; ++show) {
                uint256 count;
                for (uint256 i; i < 16; ++i) {
                    uint256 id = t.tokenIdOf(show, h.poolSeat(i));
                    if (_exists(id) && t.ownerOf(id) == actors[a]) count++;
                }
                uint256 held = t.ticketsHeld(show, actors[a]);
                assertLe(held, 6, "cap exceeded");
                assertEq(held, count, "held != owned");
                totalOwned += count;
            }
            assertEq(t.balanceOf(actors[a]), totalOwned);
        }
    }

    /// PROPERTY: a listing only exists for a token that exists and is owned by the listed seller.
    function invariant_ListingsAlwaysMatchOwner() public view {
        for (uint256 i; i < 32; ++i) {
            uint256 id = h.poolToken(i);
            BlackpinkTickets.Listing memory l = t.getListing(id);
            if (l.seller != address(0)) {
                assertTrue(_exists(id));
                assertEq(t.ownerOf(id), l.seller);
                assertGt(l.price, 0);
            }
        }
    }

    function afterInvariant() public view {
        console2.log("buy", h.ok("buy"));
        console2.log("buyListed", h.ok("buyListed"));
        console2.log("upgrade", h.ok("upgrade"));
        console2.log("transfer", h.ok("transfer"));
        console2.log("withdraw", h.ok("withdraw"));
    }
}
