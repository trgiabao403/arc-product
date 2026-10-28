// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Base64} from "@openzeppelin/contracts/utils/Base64.sol";
import {Strings} from "@openzeppelin/contracts/utils/Strings.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";

/**
 * @title BlackpinkTickets
 * @notice Seat tickets for BLACKPINK WORLD TOUR - BORN PINK ENCORE, paid in six-decimal USDC.
 * @dev Non-upgradeable. Configure the trusted USDC ERC-20 view in the constructor;
 * on Arc Testnet its address is 0x3600000000000000000000000000000000000000.
 * Only primary purchases, resale purchases, upgrades and shop purchases are paused.
 * Purchases and marketplace delivery intentionally do not invoke ERC721 receiver callbacks.
 * Rewards are historical, stay with the earning address, and are never transferred or revoked.
 * No refunds are offered; all USDC held by the contract is withdrawable revenue.
 */
contract BlackpinkTickets is ERC721, Ownable2Step, Pausable, ReentrancyGuard {
    using SafeERC20 for IERC20;
    using Strings for uint256;

    uint8 public constant SHOW_COUNT = 2;
    uint16 public constant SEATS_PER_SHOW = 344;
    uint256 public constant MAX_PER_WALLET_PER_SHOW = 6;
    uint256 public constant STANDING_PRICE = 10e6;
    uint256 public constant VIP_PRICE = 25e6;
    uint256 public constant VVIP_PRICE = 100e6;
    uint256 public constant LIGHTSTICK_PRICE = 5e6;
    uint256 public constant FEE_BPS = 500;
    uint256 public constant BPS_DENOMINATOR = 10_000;

    IERC20 public immutable usdc;

    struct Listing {
        address seller;
        uint256 price;
    }

    mapping(uint8 showId => bool) public showOpen;
    /// @notice Tickets currently held per show/holder, capped at six.
    /// @dev Applies to primary purchases, resale and plain ERC-721 transfers; upgrades net to zero.
    mapping(uint8 showId => mapping(address holder => uint256 count)) public ticketsHeld;
    mapping(uint8 showId => uint256[2] words) private _soldBitmap;
    mapping(uint256 tokenId => Listing listing) public listings;
    mapping(address fan => uint256 points) public fanPoints;
    /// @notice VIP-or-higher primary acquisitions and upgrades from tier zero; never decremented.
    mapping(address fan => uint256 count) public vipTickets;
    mapping(address fan => uint256 count) public lightsticks;
    address[] public fans;
    mapping(address fan => bool registered) public seen;

    error ZeroAddress();
    error InvalidShow(uint8 showId);
    error InvalidSeat(uint16 seatId);
    error InvalidTier(uint8 tier);
    error InvalidTokenId(uint256 tokenId);
    error ShowClosed(uint8 showId);
    error InvalidTicketQuantity(uint256 quantity);
    error WalletCapExceeded(uint8 showId, address buyer);
    error SeatTaken(uint8 showId, uint16 seatId);
    error DuplicateSeat(uint16 seatId);
    error NotTicketOwner(uint256 tokenId, address caller);
    error InvalidLightstickQuantity(uint256 quantity);
    error InvalidListingPrice();
    error PriceTooHigh(uint256 listed, uint256 maxPrice);
    error ListingNotFound(uint256 tokenId);
    error StaleListing(uint256 tokenId);
    error CannotBuyOwnListing();
    error NotListingSellerOrOwner(uint256 tokenId, address caller);
    error HigherTierRequired(uint8 oldTier, uint8 newTier);
    error OwnershipRenunciationDisabled();

    event ShowOpenSet(uint8 indexed showId, bool open);
    event TicketPurchased(
        address indexed buyer,
        uint8 indexed showId,
        uint16 seatId,
        uint256 tokenId,
        uint8 tier,
        uint256 price
    );
    event FanRegistered(address indexed fan);
    event FanRewardsGranted(address indexed fan, uint256 points, uint256 vipCount, uint256 lightstickCount);
    event LightstickBought(address indexed buyer, uint256 quantity, uint256 totalPrice);
    event Listed(uint256 indexed tokenId, address indexed seller, uint256 price);
    event ListingCancelled(uint256 indexed tokenId, address indexed seller);
    event ListedSold(
        uint256 indexed tokenId, address indexed seller, address indexed buyer, uint256 price, uint256 fee
    );
    event SeatUpgraded(
        address indexed owner, uint256 indexed oldTokenId, uint256 indexed newTokenId, uint8 newTier, uint256 paid
    );
    event RevenueWithdrawn(address indexed to, uint256 amount);

    /// @param usdc_ Trusted six-decimal USDC ERC-20 contract, not a native-token payment path.
    /// @param initialOwner Initial administrator; cannot be zero and cannot renounce ownership.
    constructor(address usdc_, address initialOwner)
        ERC721("BLACKPINK BORN PINK ENCORE Ticket", "BPTIX")
        Ownable(initialOwner)
    {
        if (usdc_ == address(0)) revert ZeroAddress();
        // Ownable(initialOwner) rejects a zero initialOwner with its custom error.
        usdc = IERC20(usdc_);
        showOpen[0] = true;
        showOpen[1] = true;
        emit ShowOpenSet(0, true);
        emit ShowOpenSet(1, true);
    }

    /// @notice Returns tier 0 for seats 0..239, tier 1 for 240..319, or tier 2 for 320..343.
    function tierOf(uint16 seatId) public pure returns (uint8) {
        if (seatId >= SEATS_PER_SHOW) revert InvalidSeat(seatId);
        if (seatId < 240) return 0;
        if (seatId < 320) return 1;
        return 2;
    }

    /// @notice Returns the primary price in six-decimal USDC units.
    function priceOf(uint8 tier) public pure returns (uint256) {
        if (tier == 0) return STANDING_PRICE;
        if (tier == 1) return VIP_PRICE;
        if (tier == 2) return VVIP_PRICE;
        revert InvalidTier(tier);
    }

    /// @notice Returns historical reward points for acquiring a seat in a tier.
    function pointsOf(uint8 tier) public pure returns (uint256) {
        if (tier == 0) return 10;
        if (tier == 1) return 50;
        if (tier == 2) return 500;
        revert InvalidTier(tier);
    }

    /// @notice Computes the nonzero token ID, regardless of whether the seat is minted.
    function tokenIdOf(uint8 showId, uint16 seatId) public pure returns (uint256) {
        _validateShow(showId);
        if (seatId >= SEATS_PER_SHOW) revert InvalidSeat(seatId);
        return (uint256(showId) + 1) * 1000 + uint256(seatId);
    }

    /// @notice Decodes a structurally valid ticket ID; does not require a currently minted ticket.
    function decodeTokenId(uint256 tokenId) public pure returns (uint8 showId, uint16 seatId) {
        uint256 prefix = tokenId / 1000;
        uint256 seat = tokenId % 1000;
        if (prefix == 0 || prefix > SHOW_COUNT || seat >= SEATS_PER_SHOW) revert InvalidTokenId(tokenId);
        return (uint8(prefix - 1), uint16(seat));
    }

    /// @notice Bit i in the concatenated two words indicates that seat i is currently minted.
    /// @dev Word zero covers seats 0..255. Bits 88..255 of word one are always zero.
    function getSoldBitmap(uint8 showId) external view returns (uint256[2] memory) {
        _validateShow(showId);
        return _soldBitmap[showId];
    }

    /**
     * @notice Buys one to six available seats for a show.
     * @dev The cap is tickets currently held per wallet and show, including resale and plain ERC-721 transfers.
     * Upgrades leave current holdings unchanged.
     * Validate the holdings cap before pulling USDC, then mint and update holdings only after payment.
     * Duplicate detection uses a bounded two-word memory bitmap; both loops have at most six iterations.
     */
    function buyTickets(uint8 showId, uint16[] calldata seatIds) external whenNotPaused nonReentrant {
        _requireShowOpen(showId);
        uint256 quantity = seatIds.length;
        if (quantity == 0 || quantity > MAX_PER_WALLET_PER_SHOW) revert InvalidTicketQuantity(quantity);
        uint256 nextHeld = ticketsHeld[showId][msg.sender] + quantity;
        if (nextHeld > MAX_PER_WALLET_PER_SHOW) revert WalletCapExceeded(showId, msg.sender);

        uint256 total;
        uint256[2] memory selected;
        for (uint256 i; i < quantity; ++i) {
            uint16 seatId = seatIds[i];
            uint8 tier = tierOf(seatId);
            uint256 word = uint256(seatId) >> 8;
            uint256 mask = uint256(1) << (uint256(seatId) & 255);
            if ((selected[word] & mask) != 0) revert DuplicateSeat(seatId);
            selected[word] |= mask;
            if (_ownerOf(tokenIdOf(showId, seatId)) != address(0)) revert SeatTaken(showId, seatId);
            total += priceOf(tier);
        }

        usdc.safeTransferFrom(msg.sender, address(this), total);
        for (uint256 i; i < quantity; ++i) {
            _mintPurchasedSeat(msg.sender, showId, seatIds[i]);
        }
    }

    /// @notice Buys one to ten virtual lightsticks and earns 25 points per unit.
    function buyLightstick(uint256 qty) external whenNotPaused nonReentrant {
        if (qty == 0 || qty > 10) revert InvalidLightstickQuantity(qty);
        uint256 total = LIGHTSTICK_PRICE * qty;
        usdc.safeTransferFrom(msg.sender, address(this), total);
        _grantRewards(msg.sender, 25 * qty, 0, qty);
        emit LightstickBought(msg.sender, qty, total);
    }

    /// @notice Lists an owned ticket at any positive USDC price without escrow or approval.
    /// @dev Listing is permitted while paused or while its show is closed. Re-listing replaces the old listing.
    function listForSale(uint256 tokenId, uint256 price) external {
        if (ownerOf(tokenId) != msg.sender) revert NotTicketOwner(tokenId, msg.sender);
        if (price == 0) revert InvalidListingPrice();
        _cancelListing(tokenId);
        listings[tokenId] = Listing({seller: msg.sender, price: price});
        emit Listed(tokenId, msg.sender, price);
    }

    /// @notice Cancels a listing as its seller or the current ticket owner, even while paused.
    function cancelListing(uint256 tokenId) external {
        Listing memory listing = listings[tokenId];
        if (listing.seller == address(0)) revert ListingNotFound(tokenId);
        if (msg.sender != listing.seller && msg.sender != ownerOf(tokenId)) {
            revert NotListingSellerOrOwner(tokenId, msg.sender);
        }
        _cancelListing(tokenId);
    }

    /// @notice Purchases a listing, paying the seller 95% and the contract a 5% fee, rounded down.
    /// @dev Deletes the listing before either USDC interaction. No approval or receiver callback is needed.
    /// Show closure does not restrict resale; resale buyers receive no rewards.
    /// Reverts before any transfers if the listing price exceeds maxPrice.
    function buyListed(uint256 tokenId, uint256 maxPrice) external whenNotPaused nonReentrant {
        Listing memory listing = listings[tokenId];
        if (listing.seller == address(0)) revert ListingNotFound(tokenId);
        if (listing.price > maxPrice) revert PriceTooHigh(listing.price, maxPrice);
        if (listing.seller != ownerOf(tokenId)) revert StaleListing(tokenId);
        if (msg.sender == listing.seller) revert CannotBuyOwnListing();
        // Full-precision multiplication supports every positive uint256 listing price.
        uint256 fee = Math.mulDiv(listing.price, FEE_BPS, BPS_DENOMINATOR);
        delete listings[tokenId];
        usdc.safeTransferFrom(msg.sender, listing.seller, listing.price - fee);
        usdc.safeTransferFrom(msg.sender, address(this), fee);
        _transfer(listing.seller, msg.sender, tokenId);
        emit ListedSold(tokenId, listing.seller, msg.sender, listing.price, fee);
    }

    /// @notice Returns the current non-escrow listing, or zero fields if there is none.
    function getListing(uint256 tokenId) external view returns (Listing memory) {
        return listings[tokenId];
    }

    /**
     * @notice Exchanges an owned seat for an available higher-tier seat in the same open show.
     * @dev Pays the primary-price difference before burning/minting. The old seat becomes available again.
     * Rewards increase only by the points difference. Tier-zero upgrades add one historical VIP acquisition.
     * Tickets currently held per show and previously earned lightsticks remain unchanged.
     */
    function upgradeSeat(uint256 oldTokenId, uint16 newSeatId) external whenNotPaused nonReentrant {
        if (ownerOf(oldTokenId) != msg.sender) revert NotTicketOwner(oldTokenId, msg.sender);
        (uint8 showId, uint16 oldSeatId) = decodeTokenId(oldTokenId);
        _requireShowOpen(showId);
        uint8 oldTier = tierOf(oldSeatId);
        uint8 newTier = tierOf(newSeatId);
        if (newTier <= oldTier) revert HigherTierRequired(oldTier, newTier);
        uint256 newTokenId = tokenIdOf(showId, newSeatId);
        if (_ownerOf(newTokenId) != address(0)) revert SeatTaken(showId, newSeatId);
        uint256 paid = priceOf(newTier) - priceOf(oldTier);

        usdc.safeTransferFrom(msg.sender, address(this), paid);
        _burn(oldTokenId);
        _mint(msg.sender, newTokenId);
        _grantRewards(msg.sender, pointsOf(newTier) - pointsOf(oldTier), oldTier == 0 ? 1 : 0, 0);
        emit SeatUpgraded(msg.sender, oldTokenId, newTokenId, newTier, paid);
    }

    /// @notice Returns the number of distinct addresses that have earned rewards.
    function fanCount() external view returns (uint256) {
        return fans.length;
    }

    /// @notice Returns a clamped page of registered fans in first-earned order, not point order.
    function getFans(uint256 offset, uint256 limit) external view returns (address[] memory page) {
        uint256 length = fans.length;
        if (offset >= length) return new address[](0);
        uint256 count = length - offset;
        if (limit < count) count = limit;
        page = new address[](count);
        for (uint256 i; i < count; ++i) {
            page[i] = fans[offset + i];
        }
    }

    /// @notice Pauses only purchase, resale purchase, upgrade and lightstick purchase operations.
    function pause() external onlyOwner {
        _pause();
    }

    /// @notice Resumes the paused purchase operations.
    function unpause() external onlyOwner {
        _unpause();
    }

    /// @notice Sets primary-sale/upgrade availability for a show; does not restrict transfers or resale.
    function setShowOpen(uint8 showId, bool open) external onlyOwner {
        _validateShow(showId);
        showOpen[showId] = open;
        emit ShowOpenSet(showId, open);
    }

    /// @notice Withdraws the entire USDC balance, including primary sales, upgrades, shop sales and fees.
    function withdrawRevenue(address to) external onlyOwner nonReentrant {
        if (to == address(0)) revert ZeroAddress();
        uint256 amount = usdc.balanceOf(address(this));
        usdc.safeTransfer(to, amount);
        emit RevenueWithdrawn(to, amount);
    }

    /// @notice Always reverts to preserve an administrator for revenue and pause controls.
    function renounceOwnership() public override onlyOwner {
        revert OwnershipRenunciationDisabled();
    }

    /// @notice Returns on-chain Base64 JSON metadata for a currently minted ticket.
    /// @dev Show is the human-readable day (1 or 2); Seat is the original zero-based seat ID.
    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        _requireOwned(tokenId);
        (uint8 showId, uint16 seatId) = decodeTokenId(tokenId);
        string memory day = (uint256(showId) + 1).toString();
        string memory seat = uint256(seatId).toString();
        string memory tier = _tierName(tierOf(seatId));
        bytes memory json = abi.encodePacked(
            '{"name":"BLACKPINK BORN PINK ENCORE - Day ', day,
            ' - Seat ', seat,
            '","description":"Seat ticket for BLACKPINK WORLD TOUR - BORN PINK ENCORE.",',
            '"attributes":[{"trait_type":"Show","value":', day,
            '},{"trait_type":"Seat","value":', seat,
            '},{"trait_type":"Tier","value":"', tier, '"}]}'
        );
        return string.concat("data:application/json;base64,", Base64.encode(json));
    }

    /// @dev Centralizes listing invalidation, current holdings caps and current-mint bitmap maintenance on all ERC721 updates.
    /// Deliberately does not check paused(): ordinary transfers and approvals remain available.
    function _update(address to, uint256 tokenId, address auth) internal override returns (address from) {
        from = super._update(to, tokenId, auth);
        _cancelListing(tokenId);
        if (from != to) {
            (uint8 showId,) = decodeTokenId(tokenId);
            if (from != address(0)) {
                ticketsHeld[showId][from] -= 1;
            }
            if (to != address(0)) {
                uint256 nextHeld = ticketsHeld[showId][to] + 1;
                if (nextHeld > MAX_PER_WALLET_PER_SHOW) revert WalletCapExceeded(showId, to);
                ticketsHeld[showId][to] = nextHeld;
            }
        }
        if (from == address(0) || to == address(0)) {
            (uint8 showId, uint16 seatId) = decodeTokenId(tokenId);
            uint256 word = uint256(seatId) >> 8;
            uint256 mask = uint256(1) << (uint256(seatId) & 255);
            if (to == address(0)) {
                _soldBitmap[showId][word] &= ~mask;
            } else {
                _soldBitmap[showId][word] |= mask;
            }
        }
    }

    /// @dev Records one primary acquisition; mint and reward effects have no external callbacks.
    function _mintPurchasedSeat(address buyer, uint8 showId, uint16 seatId) private {
        uint8 tier = tierOf(seatId);
        uint256 tokenId = tokenIdOf(showId, seatId);
        _mint(buyer, tokenId);
        _grantRewards(buyer, pointsOf(tier), tier >= 1 ? 1 : 0, tier == 0 ? 1 : 0);
        emit TicketPurchased(buyer, showId, seatId, tokenId, tier, priceOf(tier));
    }

    /// @dev Registers reward recipients once and emits deltas for all historical perks.
    function _grantRewards(address fan, uint256 points, uint256 vipCount, uint256 lightstickCount) private {
        if (!seen[fan]) {
            seen[fan] = true;
            fans.push(fan);
            emit FanRegistered(fan);
        }
        fanPoints[fan] += points;
        vipTickets[fan] += vipCount;
        lightsticks[fan] += lightstickCount;
        emit FanRewardsGranted(fan, points, vipCount, lightstickCount);
    }

    /// @dev A successful sale deletes its listing directly and emits ListedSold instead of cancellation.
    function _cancelListing(uint256 tokenId) private {
        address seller = listings[tokenId].seller;
        if (seller != address(0)) {
            delete listings[tokenId];
            emit ListingCancelled(tokenId, seller);
        }
    }

    function _validateShow(uint8 showId) private pure {
        if (showId >= SHOW_COUNT) revert InvalidShow(showId);
    }

    function _requireShowOpen(uint8 showId) private view {
        _validateShow(showId);
        if (!showOpen[showId]) revert ShowClosed(showId);
    }

    function _tierName(uint8 tier) private pure returns (string memory) {
        if (tier == 0) return "Standing / CAT1";
        if (tier == 1) return "VIP Pink Pit";
        if (tier == 2) return "VVIP Born Pink Skybox";
        revert InvalidTier(tier);
    }
}
