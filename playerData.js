const players = new Map();

function createPlayer(playerId) {
    if (!players.has(playerId)) {
        players.set(playerId, {
            stardust: 0,
            discovered: ["moon"],
            equipped: "moon",
            totalDiscoveries: 1,
            rarest: "common"
        });
    }

    return players.get(playerId);
}

function getPlayer(playerId) {
    return players.get(playerId);
}

module.exports = {
    players,
    createPlayer,
    getPlayer
};